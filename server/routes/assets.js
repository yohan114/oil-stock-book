import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError, TXN_SELECT, decorate, normalize, round3 } from '../util.js';
import { requireRole } from '../auth.js';

const router = Router();

router.get('/', h((req, res) => {
  const { search, type, class: cls, status } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 1000);
  const where = [], args = {};
  if (search) {
    where.push('(ec_code LIKE @s OR registration LIKE @s OR brand LIKE @s OR type LIKE @s OR model_no LIKE @s)');
    args.s = `%${search}%`;
  }
  if (type)   { where.push('type = @type'); args.type = type; }
  if (cls)    { where.push('asset_class = @cls'); args.cls = cls; }
  if (status) { where.push('status = @status'); args.status = status; }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT id, ec_code, registration, brand, type, model_no, capacity, yom, asset_class, site, status, created_at
     FROM fleet_assets ${w} ORDER BY status='pending' DESC, ec_code LIMIT @limit`).all({ ...args, limit });
  res.json(rows);
}));

router.get('/types', h((req, res) => {
  const rows = db.prepare(
    `SELECT type, COUNT(*) AS n FROM fleet_assets WHERE type IS NOT NULL GROUP BY type ORDER BY type`).all();
  res.json(rows);
}));

// Create a vehicle/machine on the fly (e.g. when issuing to one not yet in the
// fleet). Defaults to 'pending' so an admin is prompted to complete registration.
router.post('/', requireRole('admin', 'storekeeper'), h((req, res) => {
  const ec_code = String(req.body.ec_code || '').trim() || null;
  const registration = String(req.body.registration || '').trim() || null;
  if (!ec_code && !registration) httpError(400, 'Enter an E&C code or a registration number');
  const ec_norm = ec_code ? normalize(ec_code) : null;
  const reg_norm = registration ? normalize(registration) : null;

  // Avoid duplicates — reuse an existing asset if the identifier already exists.
  const existing = db.prepare(
    `SELECT * FROM fleet_assets WHERE (ec_code_norm IS NOT NULL AND ec_code_norm = @ec)
        OR (registration_norm IS NOT NULL AND registration_norm = @reg) LIMIT 1`).get({ ec: ec_norm, reg: reg_norm });
  if (existing) return res.json({ ...existing, existing: true });

  const status = req.body.status === 'registered' ? 'registered' : 'pending';
  const info = db.prepare(`
    INSERT INTO fleet_assets (ec_code, ec_code_norm, registration, registration_norm, brand, type, model_no, asset_class, status, created_by)
    VALUES (@ec_code,@ec_norm,@registration,@reg_norm,@brand,@type,@model_no,@asset_class,@status,@created_by)`).run({
    ec_code, ec_norm, registration, reg_norm,
    brand: req.body.brand || null, type: req.body.type || null, model_no: req.body.model_no || null,
    asset_class: req.body.asset_class || 'plant', status, created_by: req.user.id,
  });
  res.status(201).json(db.prepare('SELECT * FROM fleet_assets WHERE id=?').get(info.lastInsertRowid));
}));

// Complete/edit a registration (admin & store keeper).
router.patch('/:id', requireRole('admin', 'storekeeper'), h((req, res) => {
  const a = db.prepare('SELECT * FROM fleet_assets WHERE id=?').get(req.params.id);
  if (!a) httpError(404, 'Asset not found');
  const b = req.body;
  const ec_code = 'ec_code' in b ? (String(b.ec_code || '').trim() || null) : a.ec_code;
  const registration = 'registration' in b ? (String(b.registration || '').trim() || null) : a.registration;
  if (!ec_code && !registration) httpError(400, 'An E&C code or registration is required');
  const fields = {
    ec_code, ec_code_norm: ec_code ? normalize(ec_code) : null,
    registration, registration_norm: registration ? normalize(registration) : null,
    brand: 'brand' in b ? (b.brand || null) : a.brand,
    type: 'type' in b ? (b.type || null) : a.type,
    model_no: 'model_no' in b ? (b.model_no || null) : a.model_no,
    capacity: 'capacity' in b ? (b.capacity || null) : a.capacity,
    yom: 'yom' in b ? (b.yom || null) : a.yom,
    asset_class: 'asset_class' in b ? (b.asset_class || 'plant') : a.asset_class,
    site: 'site' in b ? (b.site || null) : a.site,
    status: b.status === 'registered' || b.status === 'pending' ? b.status : a.status,
    id: a.id,
  };
  db.prepare(`UPDATE fleet_assets SET ec_code=@ec_code, ec_code_norm=@ec_code_norm, registration=@registration,
      registration_norm=@registration_norm, brand=@brand, type=@type, model_no=@model_no, capacity=@capacity,
      yom=@yom, asset_class=@asset_class, site=@site, status=@status WHERE id=@id`).run(fields);
  res.json(db.prepare('SELECT * FROM fleet_assets WHERE id=?').get(a.id));
}));

router.get('/:id', h((req, res) => {
  const a = db.prepare('SELECT * FROM fleet_assets WHERE id=?').get(req.params.id);
  if (!a) httpError(404, 'Asset not found');
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
