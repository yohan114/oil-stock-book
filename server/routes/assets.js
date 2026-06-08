import { Router } from 'express';
import { db } from '../db.js';
import { h, TXN_SELECT, decorate, round3 } from '../util.js';

const router = Router();

router.get('/', h((req, res) => {
  const { search, type, class: cls } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 1000);
  const where = [], args = {};
  if (search) {
    where.push('(ec_code LIKE @s OR registration LIKE @s OR brand LIKE @s OR type LIKE @s OR model_no LIKE @s)');
    args.s = `%${search}%`;
  }
  if (type) { where.push('type = @type'); args.type = type; }
  if (cls)  { where.push('asset_class = @cls'); args.cls = cls; }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT id, ec_code, registration, brand, type, model_no, capacity, yom, asset_class, site
     FROM fleet_assets ${w} ORDER BY ec_code LIMIT @limit`).all({ ...args, limit });
  res.json(rows);
}));

router.get('/types', h((req, res) => {
  const rows = db.prepare(
    `SELECT type, COUNT(*) AS n FROM fleet_assets WHERE type IS NOT NULL GROUP BY type ORDER BY type`).all();
  res.json(rows);
}));

router.get('/:id', h((req, res) => {
  const a = db.prepare('SELECT * FROM fleet_assets WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Asset not found' });
  const byProduct = db.prepare(
    `SELECT p.name AS product, p.unit AS unit, COALESCE(SUM(t.qty_issued),0) AS qty, COUNT(*) AS n
     FROM transactions t JOIN products p ON p.id=t.product_id
     WHERE t.asset_id=? AND t.voided=0 AND t.kind='issue'
     GROUP BY p.id ORDER BY qty DESC`).all(req.params.id);
  const txns = db.prepare(
    `${TXN_SELECT} WHERE t.asset_id=? AND t.voided=0 ORDER BY t.txn_date DESC, t.id DESC LIMIT 200`).all(req.params.id);
  const total = round3(byProduct.reduce((s, r) => s + r.qty, 0));
  res.json({ asset: a, by_product: byProduct.map((r) => ({ ...r, qty: round3(r.qty) })), total, transactions: txns.map(decorate) });
}));

export default router;
