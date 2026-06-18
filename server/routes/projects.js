import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError, TXN_SELECT, decorate, normalize, round3 } from '../util.js';
import { requireRole, canAccessProject, managerProjectIds } from '../auth.js';

const router = Router();

// Managers only ever see their assigned projects.
function scopeWhere(user) {
  if (user.role === 'manager') {
    const ids = managerProjectIds(user.id);
    return ids.length ? `pr.id IN (${ids.join(',')})` : 'pr.id IN (0)';
  }
  return '1';
}

// Managers' totals reflect only the materials they personally issued.
function ownIssueFilter(user) {
  return user.role === 'manager' ? ` AND user_id = ${Number(user.id)}` : '';
}

router.get('/', h((req, res) => {
  const f = ownIssueFilter(req.user);
  const rows = db.prepare(`
    SELECT pr.*,
      (SELECT COALESCE(SUM(qty_issued),0) FROM transactions WHERE project_id=pr.id AND voided=0 AND kind='issue'${f}) AS total_qty,
      (SELECT COUNT(*) FROM transactions WHERE project_id=pr.id AND voided=0 AND kind='issue'${f}) AS txn_count,
      (SELECT COUNT(*) FROM sites WHERE project_id=pr.id AND active=1) AS site_count
    FROM projects pr WHERE ${scopeWhere(req.user)} ORDER BY total_qty DESC`).all();
  res.json(rows.map((r) => ({ ...r, active: !!r.active, total_qty: round3(r.total_qty) })));
}));

router.get('/:id', h((req, res) => {
  if (!canAccessProject(req.user, req.params.id)) httpError(403, 'That project is not assigned to you');
  const pr = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!pr) httpError(404, 'Project not found');
  // Managers see only the materials they personally issued to this project.
  const f = req.user.role === 'manager' ? ` AND t.user_id = ${Number(req.user.id)}` : '';
  const byProduct = db.prepare(
    `SELECT p.name AS product, p.unit AS unit, p.unit_price AS unit_price,
            COALESCE(SUM(t.qty_issued),0) AS qty, COUNT(*) AS n
     FROM transactions t JOIN products p ON p.id=t.product_id
     WHERE t.project_id=? AND t.voided=0 AND t.kind='issue'${f}
     GROUP BY p.id ORDER BY qty DESC`).all(req.params.id);
  const txns = db.prepare(
    `${TXN_SELECT} WHERE t.project_id=? AND t.voided=0${f} ORDER BY t.txn_date DESC, t.id DESC LIMIT 300`).all(req.params.id);
  const sites = db.prepare('SELECT * FROM sites WHERE project_id=? ORDER BY name').all(req.params.id);
  const cost = round3(byProduct.reduce((s, r) => s + (r.unit_price ? r.qty * r.unit_price : 0), 0));
  res.json({
    project: pr,
    sites: sites.map((s) => ({ ...s, active: !!s.active })),
    by_product: byProduct.map((r) => ({ ...r, qty: round3(r.qty), cost: r.unit_price ? round3(r.qty * r.unit_price) : null })),
    cost, transactions: txns.map(decorate),
  });
}));

router.post('/', requireRole('admin', 'storekeeper'), h((req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) httpError(400, 'name is required');
  const existing = db.prepare('SELECT * FROM projects WHERE name=?').get(name);
  if (existing) return res.json(existing);
  const info = db.prepare('INSERT INTO projects (name, name_norm, location) VALUES (?,?,?)')
    .run(name, normalize(name), req.body.location || null);
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id=?').get(info.lastInsertRowid));
}));

// ── Sites ─────────────────────────────────────────────────────────────────────
router.get('/:id/sites', h((req, res) => {
  if (!canAccessProject(req.user, req.params.id)) httpError(403, 'That project is not assigned to you');
  const rows = db.prepare('SELECT * FROM sites WHERE project_id=? ORDER BY name').all(req.params.id);
  res.json(rows.map((s) => ({ ...s, active: !!s.active })));
}));

router.post('/:id/sites', requireRole('admin', 'storekeeper'), h((req, res) => {
  const pr = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id);
  if (!pr) httpError(404, 'Project not found');
  const name = String(req.body.name || '').trim();
  if (!name) httpError(400, 'Site name is required');
  const norm = normalize(name);
  if (db.prepare('SELECT 1 FROM sites WHERE project_id=? AND name_norm=?').get(pr.id, norm)) {
    httpError(409, 'That site already exists in this project');
  }
  const info = db.prepare('INSERT INTO sites (project_id, name, name_norm) VALUES (?,?,?)').run(pr.id, name, norm);
  res.status(201).json(db.prepare('SELECT * FROM sites WHERE id=?').get(info.lastInsertRowid));
}));

export default router;
