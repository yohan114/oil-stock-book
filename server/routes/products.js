import { Router } from 'express';
import { db } from '../db.js';
import { currentBalance } from '../ledger.js';
import { h, TXN_SELECT, decorate, round3 } from '../util.js';

const router = Router();

const consumedSince = db.prepare(
  `SELECT COALESCE(SUM(qty_issued),0) AS q FROM transactions
   WHERE product_id=? AND voided=0 AND kind='issue' AND txn_date >= date('now', ?)`);
const lastDate = db.prepare(
  `SELECT MAX(txn_date) AS d FROM transactions WHERE product_id=? AND voided=0`);

function enrich(p) {
  const balance = round3(currentBalance(p.id));
  const c30 = consumedSince.get(p.id, '-30 day').q;
  const c90 = consumedSince.get(p.id, '-90 day').q;
  const avgDaily = c90 / 90;
  const daysLeft = avgDaily > 0 ? Math.round(balance / avgDaily) : null;
  return {
    ...p,
    active: !!p.active,
    balance,
    value: p.unit_price ? round3(balance * p.unit_price) : null,
    consumption30: round3(c30),
    consumption90: round3(c90),
    avg_daily: round3(avgDaily),
    days_left: daysLeft,
    last_txn_date: lastDate.get(p.id).d,
    low_stock: p.reorder_level != null && balance <= p.reorder_level,
  };
}

router.get('/', h((req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY sort_order, name').all();
  res.json(rows.map(enrich));
}));

router.get('/:id', h((req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(enrich(p));
}));

router.get('/:id/ledger', h((req, res) => {
  const rows = db.prepare(`${TXN_SELECT} WHERE t.product_id=? AND t.voided=0 ORDER BY t.txn_date ASC, t.id ASC`).all(req.params.id);
  res.json(rows.map(decorate));
}));

router.patch('/:id', h((req, res) => {
  const fields = ['name', 'unit', 'category', 'reorder_level', 'unit_price', 'active'];
  const sets = [], vals = [];
  for (const f of fields) {
    if (f in req.body) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push(`updated_at=datetime('now')`);
  vals.push(req.params.id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  res.json(enrich(p));
}));

export default router;
