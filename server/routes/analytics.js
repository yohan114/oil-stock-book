import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { currentBalance } from '../ledger.js';
import { h, round3 } from '../util.js';

const router = Router();

const consumed = db.prepare(
  `SELECT COALESCE(SUM(qty_issued),0) AS q FROM transactions
   WHERE product_id=? AND voided=0 AND kind='issue' AND txn_date >= date('now', ?)`);

function productStat(p) {
  const balance = round3(currentBalance(p.id));
  const window = Number(getSettings().forecast_window_days) || 90;
  const used = consumed.get(p.id, `-${window} day`).q;
  const avgDaily = used / window;
  const daysLeft = avgDaily > 0 ? Math.round(balance / avgDaily) : null;
  const lowDays = Number(getSettings().low_stock_days) || 14;
  let status = 'ok';
  if (balance <= 0) status = 'out';
  else if ((p.reorder_level != null && balance <= p.reorder_level) || (daysLeft != null && daysLeft <= lowDays)) status = 'critical';
  else if (daysLeft != null && daysLeft <= lowDays * 2) status = 'low';
  else if (avgDaily === 0) status = 'idle';
  const runOut = daysLeft != null ? new Date(Date.now() + daysLeft * 86400000).toISOString().slice(0, 10) : null;
  return {
    id: p.id, name: p.name, unit: p.unit, category: p.category,
    reorder_level: p.reorder_level, unit_price: p.unit_price,
    balance, value: p.unit_price ? round3(balance * p.unit_price) : null,
    avg_daily: round3(avgDaily), days_left: daysLeft, run_out_date: runOut, status,
    low_stock: p.reorder_level != null && balance <= p.reorder_level,
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/stock', h((req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active=1 ORDER BY sort_order, name').all().map(productStat);
  const totals = {
    products: products.length,
    low_stock: products.filter((p) => p.status === 'critical' || p.status === 'out').length,
    total_value: round3(products.reduce((s, p) => s + (p.value || 0), 0)),
    assets: db.prepare('SELECT COUNT(*) n FROM fleet_assets').get().n,
    pending_assets: db.prepare("SELECT COUNT(*) n FROM fleet_assets WHERE status='pending'").get().n,
    projects: db.prepare('SELECT COUNT(*) n FROM projects').get().n,
    transactions: db.prepare('SELECT COUNT(*) n FROM transactions WHERE voided=0').get().n,
    unresolved_aliases: db.prepare('SELECT COUNT(*) n FROM aliases WHERE resolved=0').get().n,
  };
  res.json({ products, totals });
}));

router.get('/dashboard/alerts', h((req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active=1').all().map(productStat)
    .filter((p) => p.status === 'out' || p.status === 'critical' || p.status === 'low')
    .sort((a, b) => (a.days_left ?? 1e9) - (b.days_left ?? 1e9));
  res.json(products);
}));

// ── Forecast ─────────────────────────────────────────────────────────────────
router.get('/forecast', h((req, res) => {
  const sql = req.query.productId ? 'SELECT * FROM products WHERE id=?' : 'SELECT * FROM products WHERE active=1 ORDER BY sort_order';
  const rows = req.query.productId ? [db.prepare(sql).get(req.query.productId)] : db.prepare(sql).all();
  res.json(rows.filter(Boolean).map(productStat));
}));

// ── Trends ───────────────────────────────────────────────────────────────────
router.get('/trends/monthly', h((req, res) => {
  const months = Math.min(Number(req.query.months) || 12, 36);
  const where = ['voided=0', `txn_date >= date('now', '-${months} month')`];
  const args = [];
  if (req.query.productId) { where.push('product_id=?'); args.push(req.query.productId); }
  const rows = db.prepare(
    `SELECT strftime('%Y-%m', txn_date) AS month,
            ROUND(SUM(qty_received),3) AS received, ROUND(SUM(qty_issued),3) AS issued
     FROM transactions WHERE ${where.join(' AND ')} GROUP BY month ORDER BY month`).all(...args);
  res.json(rows);
}));

router.get('/trends/top-consumers', h((req, res) => {
  const metric = req.query.metric === 'project' ? 'project' : 'asset';
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const dateWhere = [];
  if (req.query.from) dateWhere.push(`t.txn_date >= '${req.query.from}'`);
  if (req.query.to) dateWhere.push(`t.txn_date <= '${req.query.to}'`);
  const extra = dateWhere.length ? ' AND ' + dateWhere.join(' AND ') : '';
  let rows;
  if (metric === 'asset') {
    rows = db.prepare(
      `SELECT a.id, (a.ec_code || CASE WHEN a.registration IS NOT NULL THEN ' / '||a.registration ELSE '' END) AS label,
              a.type, ROUND(SUM(t.qty_issued),3) AS qty, COUNT(*) AS n
       FROM transactions t JOIN fleet_assets a ON a.id=t.asset_id
       WHERE t.voided=0 AND t.kind='issue'${extra}
       GROUP BY a.id ORDER BY qty DESC LIMIT ?`).all(limit);
  } else {
    rows = db.prepare(
      `SELECT pr.id, pr.name AS label, ROUND(SUM(t.qty_issued),3) AS qty, COUNT(*) AS n
       FROM transactions t JOIN projects pr ON pr.id=t.project_id
       WHERE t.voided=0 AND t.kind='issue'${extra}
       GROUP BY pr.id ORDER BY qty DESC LIMIT ?`).all(limit);
  }
  res.json(rows);
}));

// ── Consumption by asset (with abnormal-usage detection) ─────────────────────
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

router.get('/consumption/by-asset', h((req, res) => {
  const where = ["t.voided=0", "t.kind='issue'"];
  if (req.query.from) where.push(`t.txn_date >= '${req.query.from}'`);
  if (req.query.to) where.push(`t.txn_date <= '${req.query.to}'`);
  const rows = db.prepare(
    `SELECT a.id, a.ec_code, a.registration, a.type, a.brand, a.status,
            ROUND(SUM(t.qty_issued),3) AS total_qty,
            ROUND(SUM(CASE WHEN p.unit='L' THEN t.qty_issued ELSE 0 END),3) AS oil_qty,
            COUNT(*) AS txn_count, MAX(t.txn_date) AS last_date
     FROM transactions t
     JOIN fleet_assets a ON a.id=t.asset_id
     JOIN products p ON p.id=t.product_id
     WHERE ${where.join(' AND ')}
     GROUP BY a.id`).all();

  // Robust per-type outlier detection on oil consumption (median + MAD).
  const byType = {};
  for (const r of rows) (byType[r.type || 'Other'] ||= []).push(r.oil_qty);
  const stats = {};
  for (const [type, vals] of Object.entries(byType)) {
    const med = median(vals);
    const mad = median(vals.map((v) => Math.abs(v - med)));
    stats[type] = { med, threshold: med + 3 * 1.4826 * mad, avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
  }
  for (const r of rows) {
    const s = stats[r.type || 'Other'];
    const limit = s.count >= 5 && s.threshold > s.med ? s.threshold : s.avg * 2;
    const ratio = s.med > 0 ? r.oil_qty / s.med : 0;
    r.abnormal = r.oil_qty > limit && r.oil_qty > 0;
    r.severity = !r.abnormal ? 'normal' : ratio >= 3 ? 'very-high' : 'high';
    r.type_median = round3(s.med);
  }
  rows.sort((a, b) => b.total_qty - a.total_qty);
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json(rows.slice(0, limit));
}));

// ── Consumption by project ───────────────────────────────────────────────────
router.get('/consumption/by-project', h((req, res) => {
  const where = ["t.voided=0", "t.kind='issue'"];
  if (req.query.from) where.push(`t.txn_date >= '${req.query.from}'`);
  if (req.query.to) where.push(`t.txn_date <= '${req.query.to}'`);
  const rows = db.prepare(
    `SELECT pr.id, pr.name, pr.location,
            ROUND(SUM(t.qty_issued),3) AS total_qty,
            ROUND(SUM(t.qty_issued * COALESCE(p.unit_price,0)),2) AS cost,
            COUNT(*) AS txn_count, MAX(t.txn_date) AS last_date
     FROM transactions t
     JOIN projects pr ON pr.id=t.project_id
     JOIN products p ON p.id=t.product_id
     WHERE ${where.join(' AND ')}
     GROUP BY pr.id ORDER BY total_qty DESC`).all();
  res.json(rows);
}));

export default router;
