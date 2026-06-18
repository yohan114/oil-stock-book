import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError, normalize } from '../util.js';
import { requireRole } from '../auth.js';
import { saveDataUrl, deleteUpload } from '../uploads.js';

const router = Router();

router.get('/', h((req, res) => {
  const { search } = req.query;
  const where = [], args = {};
  if (search) {
    where.push('(b.vehicle_no LIKE @s OR b.serial_no LIKE @s OR b.note LIKE @s)');
    args.s = `%${search}%`;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT b.*, u.full_name AS created_by_name
    FROM batteries b LEFT JOIN users u ON u.id = b.created_by
    ${w} ORDER BY b.created_at DESC`).all(args);
  res.json(rows);
}));

router.post('/', requireRole('admin', 'storekeeper'), h((req, res) => {
  const vehicle_no = String(req.body.vehicle_no || '').trim();
  const serial_no = String(req.body.serial_no || '').trim();
  if (!vehicle_no) httpError(400, 'Vehicle number is required');
  if (!serial_no) httpError(400, 'Battery serial number is required');
  if (!req.body.photo) httpError(400, 'A photo is required');

  const vnorm = normalize(vehicle_no);
  const snorm = normalize(serial_no);
  if (db.prepare('SELECT 1 FROM batteries WHERE vehicle_no_norm=?').get(vnorm)) {
    httpError(409, `Vehicle ${vehicle_no} already has a battery recorded`);
  }
  if (db.prepare('SELECT 1 FROM batteries WHERE serial_no_norm=?').get(snorm)) {
    httpError(409, `Battery serial ${serial_no} is already recorded`);
  }

  // Persist the photo first; mandatory.
  const photo_path = saveDataUrl(req.body.photo, 'batteries');

  try {
    const info = db.prepare(`
      INSERT INTO batteries (vehicle_no, vehicle_no_norm, serial_no, serial_no_norm, note, photo_path, created_by)
      VALUES (?,?,?,?,?,?,?)`).run(vehicle_no, vnorm, serial_no, snorm, req.body.note || null, photo_path, req.user.id);
    res.status(201).json(db.prepare('SELECT * FROM batteries WHERE id=?').get(info.lastInsertRowid));
  } catch (e) {
    deleteUpload(photo_path); // don't orphan the file if the insert raced a duplicate
    throw e;
  }
}));

router.delete('/:id', requireRole('admin', 'storekeeper'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  db.prepare('DELETE FROM batteries WHERE id=?').run(b.id);
  deleteUpload(b.photo_path);
  res.json({ ok: true });
}));

export default router;
