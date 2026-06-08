import { Router } from 'express';
import { db } from '../db.js';
import { h, TXN_SELECT, decorate, normalize, round3 } from '../util.js';

const router = Router();

router.get('/', h((req, res) => {
  const rows = db.prepare(`
    SELECT pr.*,
      (SELECT COALESCE(SUM(qty_issued),0) FROM transactions WHERE project_id=pr.id AND voided=0 AND kind='issue') AS total_qty,
      (SELECT COUNT(*) FROM transactions WHERE project_id=pr.id AND voided=0 AND kind='issue') AS txn_count
    FROM projects pr ORDER BY total_qty DESC`).all();
  res.json(rows.map((r) => ({ ...r, active: !!r.active, total_qty: round3(r.total_qty) })));
}));

router.get('/:id', h((req, res) => {
  const pr = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!pr) return res.status(404).json({ error: 'Project not found' });
  const byProduct = db.prepare(
    `SELECT p.name AS product, p.unit AS unit, p.unit_price AS unit_price,
            COALESCE(SUM(t.qty_issued),0) AS qty, COUNT(*) AS n
     FROM transactions t JOIN products p ON p.id=t.product_id
     WHERE t.project_id=? AND t.voided=0 AND t.kind='issue'
     GROUP BY p.id ORDER BY qty DESC`).all(req.params.id);
  const txns = db.prepare(
    `${TXN_SELECT} WHERE t.project_id=? AND t.voided=0 ORDER BY t.txn_date DESC, t.id DESC LIMIT 300`).all(req.params.id);
  const cost = round3(byProduct.reduce((s, r) => s + (r.unit_price ? r.qty * r.unit_price : 0), 0));
  res.json({
    project: pr,
    by_product: byProduct.map((r) => ({ ...r, qty: round3(r.qty), cost: r.unit_price ? round3(r.qty * r.unit_price) : null })),
    cost, transactions: txns.map(decorate),
  });
}));

router.post('/', h((req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const existing = db.prepare('SELECT * FROM projects WHERE name=?').get(name);
  if (existing) return res.json(existing);
  const info = db.prepare('INSERT INTO projects (name, name_norm, location) VALUES (?,?,?)')
    .run(name, normalize(name), req.body.location || null);
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id=?').get(info.lastInsertRowid));
}));

export default router;
