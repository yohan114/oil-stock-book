import { Router } from 'express';
import { db } from '../db.js';
import { recomputeLedger } from '../ledger.js';
import { h, httpError, round3 } from '../util.js';
import { requireRole } from '../auth.js';

const router = Router();

const PERIOD_RE = /^\d{4}-\d{2}$/;
const thisMonth = () => new Date().toISOString().slice(0, 7);

// Book (system) balance for a product as at the last day of `period`.
const bookAt = db.prepare(
  `SELECT COALESCE(SUM(qty_received - qty_issued), 0) AS book
   FROM transactions
   WHERE product_id = ? AND voided = 0
     AND txn_date <= date(? || '-01', '+1 month', '-1 day')`);

const periodEnd = (period) =>
  db.prepare(`SELECT date(? || '-01', '+1 month', '-1 day') AS d`).get(period).d;

function overdueFor(period) {
  const end = periodEnd(period);
  const due = db.prepare(`SELECT date(?, '+7 days') AS d`).get(end).d;
  const today = new Date().toISOString().slice(0, 10);
  const total = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active=1').get().n;
  const counted = db.prepare('SELECT COUNT(*) AS n FROM stock_counts WHERE period=?').get(period).n;
  const complete = total > 0 && counted >= total;
  return {
    period, period_end: end, due_date: due,
    total, counted, complete,
    overdue: !complete && today > due,
  };
}

// ── GET /api/tally/status?period=YYYY-MM ──────────────────────────────────────
router.get('/status', h((req, res) => {
  const period = PERIOD_RE.test(req.query.period) ? req.query.period : thisMonth();
  const end = periodEnd(period);
  const products = db.prepare('SELECT * FROM products WHERE active=1 ORDER BY sort_order, name').all();
  const existing = new Map(
    db.prepare(`SELECT sc.*, u.full_name AS counted_by_name FROM stock_counts sc
                LEFT JOIN users u ON u.id = sc.counted_by WHERE sc.period=?`).all(period).map((r) => [r.product_id, r]));

  const rows = products.map((p) => {
    const book = round3(bookAt.get(p.id, period).book);
    const c = existing.get(p.id);
    return {
      product_id: p.id, name: p.name, unit: p.unit, category: p.category, unit_price: p.unit_price,
      book_qty: book,
      counted_qty: c ? c.counted_qty : null,
      variance: c ? round3(c.variance) : null,
      adjusted: c ? !!c.adjusted : false,
      note: c ? c.note : null,
      counted_by_name: c ? c.counted_by_name : null,
      counted_at: c ? c.updated_at : null,
    };
  });
  res.json({ ...overdueFor(period), period_end: end, products: rows });
}));

// ── GET /api/tally/overdue — for the month that has most recently ended ───────
router.get('/overdue', h((req, res) => {
  const prev = db.prepare(`SELECT strftime('%Y-%m', date('now','-1 month')) AS p`).get().p;
  res.json(overdueFor(prev));
}));

// ── POST /api/tally — save counts (storekeeper/admin), optionally adjust ──────
router.post('/', requireRole('admin', 'storekeeper'), h((req, res) => {
  const period = req.body.period;
  if (!PERIOD_RE.test(period)) httpError(400, 'A valid period (YYYY-MM) is required');
  const counts = Array.isArray(req.body.counts) ? req.body.counts : [];
  if (!counts.length) httpError(400, 'No counts submitted');
  const postAdjust = !!req.body.post_adjustments;
  const end = periodEnd(period);

  const upsert = db.prepare(`
    INSERT INTO stock_counts (product_id, period, book_qty, counted_qty, variance, note, counted_by)
    VALUES (@product_id, @period, @book_qty, @counted_qty, @variance, @note, @counted_by)
    ON CONFLICT(product_id, period) DO UPDATE SET
      book_qty=excluded.book_qty, counted_qty=excluded.counted_qty, variance=excluded.variance,
      note=excluded.note, counted_by=excluded.counted_by, updated_at=datetime('now')`);
  const markAdjusted = db.prepare(`UPDATE stock_counts SET adjusted=1, updated_at=datetime('now') WHERE product_id=? AND period=?`);
  const insAdj = db.prepare(`
    INSERT INTO transactions (product_id, txn_date, kind, qty_received, qty_issued, balance_after, user_id, description, remark, source)
    VALUES (?, ?, 'adjustment', ?, ?, 0, ?, 'Stock-take adjustment', ?, 'tally')`);

  const tx = db.transaction(() => {
    let adjustedCount = 0;
    for (const c of counts) {
      if (c.counted_qty == null || c.counted_qty === '') continue;
      const product = db.prepare('SELECT id FROM products WHERE id=?').get(c.product_id);
      if (!product) continue;
      const counted = round3(Number(c.counted_qty) || 0);
      const book = round3(bookAt.get(c.product_id, period).book);
      const variance = round3(counted - book);
      upsert.run({
        product_id: c.product_id, period, book_qty: book, counted_qty: counted,
        variance, note: c.note || null, counted_by: req.user.id,
      });
      const already = db.prepare('SELECT adjusted FROM stock_counts WHERE product_id=? AND period=?').get(c.product_id, period);
      if (postAdjust && Math.abs(variance) > 1e-6 && !(already && already.adjusted)) {
        insAdj.run(c.product_id, end,
          variance > 0 ? variance : 0,
          variance < 0 ? -variance : 0,
          req.user.id, `Physical ${counted} vs book ${book}`);
        recomputeLedger(c.product_id);
        markAdjusted.run(c.product_id, period);
        adjustedCount++;
      }
    }
    return adjustedCount;
  });
  const adjusted = tx();
  res.json({ ok: true, adjusted, ...overdueFor(period) });
}));

export default router;
