import { Router } from 'express';
import { db } from '../db.js';
import { recomputeLedger, currentBalance } from '../ledger.js';
import { h, httpError, round3 } from '../util.js';
import { requireRole, canAccessProject, managerProjectIds } from '../auth.js';

const router = Router();
const EPS = 1e-6;

const REQ_SELECT = `
  SELECT r.*, p.name AS product_name, p.unit AS unit,
         pr.name AS project_name, s.name AS site_name,
         ru.full_name AS requested_by_name, au.full_name AS approved_by_name, cu.full_name AS received_by_name
  FROM requisitions r
  JOIN products p ON p.id = r.product_id
  LEFT JOIN projects pr ON pr.id = r.project_id
  LEFT JOIN sites s ON s.id = r.site_id
  LEFT JOIN users ru ON ru.id = r.requested_by
  LEFT JOIN users au ON au.id = r.approved_by
  LEFT JOIN users cu ON cu.id = r.received_by`;

const getOne = (id) => {
  const r = db.prepare(`${REQ_SELECT} WHERE r.id=?`).get(id);
  return r ? { ...r, discrepancy: !!r.discrepancy } : null;
};

// Post the stock issue when a dispatch is sent. Returns the new transaction id.
function postIssue({ product_id, project_id, site_id, qty, user_id, label }) {
  const product = db.prepare('SELECT id, name, unit FROM products WHERE id=?').get(product_id);
  if (!product) httpError(400, 'Unknown product');
  const bal = round3(currentBalance(product.id));
  if (qty > bal + EPS) httpError(400, `Cannot send ${qty} ${product.unit} — only ${bal} ${product.unit} in stock`);
  const info = db.prepare(`
    INSERT INTO transactions
      (product_id, txn_date, kind, qty_received, qty_issued, balance_after, consumer_type, project_id, site_id, user_id, description, source)
    VALUES (?, date('now'), 'issue', 0, ?, 0, 'project', ?, ?, ?, ?, 'requisition')`)
    .run(product.id, qty, project_id, site_id || null, user_id, label);
  recomputeLedger(product.id);
  return info.lastInsertRowid;
}

// ── List (scoped) ─────────────────────────────────────────────────────────────
router.get('/', h((req, res) => {
  const where = [], args = {};
  if (req.user.role === 'manager') {
    const ids = managerProjectIds(req.user.id);
    where.push(ids.length ? `r.project_id IN (${ids.join(',')})` : 'r.project_id IN (0)');
  }
  if (['pending', 'sent', 'received', 'rejected', 'cancelled'].includes(req.query.status)) {
    where.push('r.status = @status'); args.status = req.query.status;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`${REQ_SELECT} ${w} ORDER BY
    CASE r.status WHEN 'pending' THEN 0 WHEN 'sent' THEN 1 ELSE 2 END, r.updated_at DESC`).all(args);
  res.json(rows.map((r) => ({ ...r, discrepancy: !!r.discrepancy })));
}));

// Counts for nav badges / dashboards.
router.get('/summary', h((req, res) => {
  if (req.user.role === 'manager') {
    const ids = managerProjectIds(req.user.id);
    const scope = ids.length ? `project_id IN (${ids.join(',')})` : 'project_id IN (0)';
    res.json({
      awaiting_receipt: db.prepare(`SELECT COUNT(*) n FROM requisitions WHERE status='sent' AND ${scope}`).get().n,
      pending: db.prepare(`SELECT COUNT(*) n FROM requisitions WHERE status='pending' AND ${scope}`).get().n,
    });
  } else {
    res.json({
      pending: db.prepare(`SELECT COUNT(*) n FROM requisitions WHERE status='pending'`).get().n,
      awaiting_receipt: db.prepare(`SELECT COUNT(*) n FROM requisitions WHERE status='sent'`).get().n,
    });
  }
}));

// ── Create: a site request (manager) or a direct dispatch (store/admin) ───────
router.post('/', h((req, res) => {
  const b = req.body;
  const product = db.prepare('SELECT id FROM products WHERE id=?').get(b.product_id);
  if (!product) httpError(400, 'Select a product');
  if (!b.project_id) httpError(400, 'Select a project');
  if (!canAccessProject(req.user, b.project_id)) httpError(403, 'That project is not assigned to you');
  if (b.site_id) {
    const site = db.prepare('SELECT project_id FROM sites WHERE id=?').get(b.site_id);
    if (!site || site.project_id !== Number(b.project_id)) httpError(400, 'That site is not in the selected project');
  }
  const label = [
    db.prepare('SELECT name FROM projects WHERE id=?').get(b.project_id)?.name,
    b.site_id ? db.prepare('SELECT name FROM sites WHERE id=?').get(b.site_id)?.name : null,
  ].filter(Boolean).join(' · ');

  // Store keeper / admin can dispatch directly (stock leaves now; site confirms later).
  if (b.send) {
    if (req.user.role === 'manager') httpError(403, 'Managers request stock; they cannot send it');
    const qty = round3(Number(b.qty_sent ?? b.qty) || 0);
    if (qty <= 0) httpError(400, 'Enter a quantity to send');
    const tx = db.transaction(() => {
      const txnId = postIssue({ product_id: b.product_id, project_id: b.project_id, site_id: b.site_id, qty, user_id: req.user.id, label });
      const info = db.prepare(`INSERT INTO requisitions
        (product_id, project_id, site_id, qty_sent, status, txn_id, note, approved_by, sent_at)
        VALUES (?,?,?,?, 'sent', ?, ?, ?, datetime('now'))`)
        .run(b.product_id, b.project_id, b.site_id || null, qty, txnId, b.note || null, req.user.id);
      return info.lastInsertRowid;
    });
    return res.status(201).json(getOne(tx()));
  }

  // Otherwise it's a request (anyone with project access).
  const qty = round3(Number(b.qty_requested ?? b.qty) || 0);
  if (qty <= 0) httpError(400, 'Enter the quantity you need');
  const info = db.prepare(`INSERT INTO requisitions
    (product_id, project_id, site_id, qty_requested, status, note, requested_by)
    VALUES (?,?,?,?, 'pending', ?, ?)`)
    .run(b.product_id, b.project_id, b.site_id || null, qty, b.note || null, req.user.id);
  res.status(201).json(getOne(info.lastInsertRowid));
}));

// ── Approve & send (store keeper / admin) ─────────────────────────────────────
router.post('/:id/approve', requireRole('admin', 'storekeeper'), h((req, res) => {
  const r = db.prepare('SELECT * FROM requisitions WHERE id=?').get(req.params.id);
  if (!r) httpError(404, 'Request not found');
  if (r.status !== 'pending') httpError(400, `This request is already ${r.status}`);
  const qty = round3(Number(req.body.qty_sent ?? r.qty_requested) || 0);
  if (qty <= 0) httpError(400, 'Enter a quantity to send');
  const label = [
    db.prepare('SELECT name FROM projects WHERE id=?').get(r.project_id)?.name,
    r.site_id ? db.prepare('SELECT name FROM sites WHERE id=?').get(r.site_id)?.name : null,
  ].filter(Boolean).join(' · ');
  const tx = db.transaction(() => {
    // Attribute the consumption to the requester so it shows in their own materials.
    const txnId = postIssue({ product_id: r.product_id, project_id: r.project_id, site_id: r.site_id, qty, user_id: r.requested_by || req.user.id, label });
    db.prepare(`UPDATE requisitions SET qty_sent=?, status='sent', txn_id=?, approved_by=?, sent_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
      .run(qty, txnId, req.user.id, r.id);
  });
  tx();
  res.json(getOne(r.id));
}));

router.post('/:id/reject', requireRole('admin', 'storekeeper'), h((req, res) => {
  const r = db.prepare('SELECT * FROM requisitions WHERE id=?').get(req.params.id);
  if (!r) httpError(404, 'Request not found');
  if (r.status !== 'pending') httpError(400, `This request is already ${r.status}`);
  db.prepare(`UPDATE requisitions SET status='rejected', reject_reason=?, approved_by=?, updated_at=datetime('now') WHERE id=?`)
    .run(String(req.body.reason || '').trim() || 'Rejected', req.user.id, r.id);
  res.json(getOne(r.id));
}));

// ── Confirm receipt (site manager of the project, or admin) ───────────────────
router.post('/:id/receive', h((req, res) => {
  const r = db.prepare('SELECT * FROM requisitions WHERE id=?').get(req.params.id);
  if (!r) httpError(404, 'Request not found');
  if (r.status !== 'sent') httpError(400, 'Only sent dispatches can be received');
  const allowed = req.user.role === 'admin' || (req.user.role === 'manager' && canAccessProject(req.user, r.project_id));
  if (!allowed) httpError(403, 'Only the site manager confirms receipt');
  const received = round3(req.body.qty_received != null ? Number(req.body.qty_received) : r.qty_sent);
  if (received < 0) httpError(400, 'Received quantity cannot be negative');
  const discrepancy = Math.abs(received - r.qty_sent) > EPS ? 1 : 0;
  db.prepare(`UPDATE requisitions SET qty_received=?, status='received', discrepancy=?, received_by=?, received_at=datetime('now'), note=COALESCE(?, note), updated_at=datetime('now') WHERE id=?`)
    .run(received, discrepancy, req.user.id, req.body.note || null, r.id);
  res.json(getOne(r.id));
}));

router.post('/:id/cancel', h((req, res) => {
  const r = db.prepare('SELECT * FROM requisitions WHERE id=?').get(req.params.id);
  if (!r) httpError(404, 'Request not found');
  if (r.status !== 'pending') httpError(400, 'Only pending requests can be cancelled');
  const allowed = req.user.role === 'admin' || req.user.role === 'storekeeper' || r.requested_by === req.user.id;
  if (!allowed) httpError(403, 'You cannot cancel this request');
  db.prepare(`UPDATE requisitions SET status='cancelled', updated_at=datetime('now') WHERE id=?`).run(r.id);
  res.json(getOne(r.id));
}));

export default router;
