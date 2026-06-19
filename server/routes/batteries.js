import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError, normalize } from '../util.js';
import { requireRole } from '../auth.js';
import { saveDataUrl, deleteUpload } from '../uploads.js';

const router = Router();

const logEvent = db.prepare(`
  INSERT INTO battery_events (battery_id, action, serial_no, serial_no_norm, vehicle_no, from_vehicle_no, reason, photo_path, user_id)
  VALUES (@battery_id, @action, @serial_no, @serial_no_norm, @vehicle_no, @from_vehicle_no, @reason, @photo_path, @user_id)`);

// ── Active register ───────────────────────────────────────────────────────────
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

// ── Full audit history (active + decommissioned) ──────────────────────────────
router.get('/history', h((req, res) => {
  const { search } = req.query;
  const where = [], args = {};
  if (search) {
    where.push('(e.vehicle_no LIKE @s OR e.from_vehicle_no LIKE @s OR e.serial_no LIKE @s OR e.reason LIKE @s)');
    args.s = `%${search}%`;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT e.*, u.full_name AS user_name
    FROM battery_events e LEFT JOIN users u ON u.id = e.user_id
    ${w} ORDER BY e.created_at DESC, e.id DESC`).all(args);
  res.json(rows);
}));

// ── Add — admin, store keeper AND project manager ─────────────────────────────
router.post('/', requireRole('admin', 'storekeeper', 'manager'), h((req, res) => {
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

  const photo_path = saveDataUrl(req.body.photo, 'batteries');
  try {
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO batteries (vehicle_no, vehicle_no_norm, serial_no, serial_no_norm, note, photo_path, created_by)
        VALUES (?,?,?,?,?,?,?)`).run(vehicle_no, vnorm, serial_no, snorm, req.body.note || null, photo_path, req.user.id);
      logEvent.run({
        battery_id: info.lastInsertRowid, action: 'add', serial_no, serial_no_norm: snorm,
        vehicle_no, from_vehicle_no: null, reason: req.body.note || null, photo_path, user_id: req.user.id,
      });
      return info.lastInsertRowid;
    });
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM batteries WHERE id=?').get(id));
  } catch (e) {
    deleteUpload(photo_path);
    throw e;
  }
}));

// ── Transfer to another vehicle — admin & store keeper ────────────────────────
router.post('/:id/transfer', requireRole('admin', 'storekeeper'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  const to = String(req.body.vehicle_no || '').trim();
  if (!to) httpError(400, 'New vehicle number is required');
  const tonorm = normalize(to);
  if (tonorm === b.vehicle_no_norm) httpError(400, 'That is already this battery\'s vehicle');
  if (db.prepare('SELECT 1 FROM batteries WHERE vehicle_no_norm=? AND id<>?').get(tonorm, b.id)) {
    httpError(409, `Vehicle ${to} already has a battery — decommission it first`);
  }
  const tx = db.transaction(() => {
    db.prepare(`UPDATE batteries SET vehicle_no=?, vehicle_no_norm=? WHERE id=?`).run(to, tonorm, b.id);
    logEvent.run({
      battery_id: b.id, action: 'transfer', serial_no: b.serial_no, serial_no_norm: b.serial_no_norm,
      vehicle_no: to, from_vehicle_no: b.vehicle_no, reason: req.body.reason || null, photo_path: b.photo_path, user_id: req.user.id,
    });
  });
  tx();
  res.json(db.prepare('SELECT * FROM batteries WHERE id=?').get(b.id));
}));

// ── Decommission (dead/destroyed, vehicle removed — log kept) — admin & store ─
router.post('/:id/decommission', requireRole('admin', 'storekeeper'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  const reason = String(req.body.reason || '').trim() || 'Decommissioned';
  const tx = db.transaction(() => {
    // Snapshot into the audit log, then remove from the active register so the
    // vehicle & serial are freed while the history is preserved forever.
    logEvent.run({
      battery_id: b.id, action: 'decommission', serial_no: b.serial_no, serial_no_norm: b.serial_no_norm,
      vehicle_no: b.vehicle_no, from_vehicle_no: null, reason, photo_path: b.photo_path, user_id: req.user.id,
    });
    db.prepare('DELETE FROM batteries WHERE id=?').run(b.id);
  });
  tx();
  res.json({ ok: true });
}));

// ── Edit any field — admin only (others must request) ─────────────────────────
router.patch('/:id', requireRole('admin'), h((req, res) => {
  const b = db.prepare('SELECT * FROM batteries WHERE id=?').get(req.params.id);
  if (!b) httpError(404, 'Battery record not found');
  const vehicle_no = 'vehicle_no' in req.body ? String(req.body.vehicle_no || '').trim() : b.vehicle_no;
  const serial_no = 'serial_no' in req.body ? String(req.body.serial_no || '').trim() : b.serial_no;
  const note = 'note' in req.body ? (req.body.note || null) : b.note;
  if (!vehicle_no || !serial_no) httpError(400, 'Vehicle and serial number cannot be empty');
  const vnorm = normalize(vehicle_no), snorm = normalize(serial_no);
  if (db.prepare('SELECT 1 FROM batteries WHERE vehicle_no_norm=? AND id<>?').get(vnorm, b.id)) httpError(409, 'Another battery already uses that vehicle number');
  if (db.prepare('SELECT 1 FROM batteries WHERE serial_no_norm=? AND id<>?').get(snorm, b.id)) httpError(409, 'Another battery already uses that serial number');

  const tx = db.transaction(() => {
    db.prepare('UPDATE batteries SET vehicle_no=?, vehicle_no_norm=?, serial_no=?, serial_no_norm=?, note=? WHERE id=?')
      .run(vehicle_no, vnorm, serial_no, snorm, note, b.id);
    logEvent.run({
      battery_id: b.id, action: 'edit', serial_no, serial_no_norm: snorm, vehicle_no,
      from_vehicle_no: b.vehicle_no !== vehicle_no ? b.vehicle_no : null,
      reason: req.body.reason || 'Edited', photo_path: b.photo_path, user_id: req.user.id,
    });
  });
  tx();
  res.json(db.prepare('SELECT * FROM batteries WHERE id=?').get(b.id));
}));

export default router;
