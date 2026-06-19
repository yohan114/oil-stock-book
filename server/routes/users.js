import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError } from '../util.js';
import { hashPassword, sanitizeUser, requireRole } from '../auth.js';

const router = Router();

// All user management is admin-only.
router.use(requireRole('admin'));

const ROLES = ['admin', 'storekeeper', 'manager'];

function setProjects(userId, projectIds) {
  db.prepare('DELETE FROM user_projects WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)');
  for (const pid of projectIds || []) ins.run(userId, Number(pid));
}

router.get('/', h((req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY role, username').all();
  res.json(rows.map(sanitizeUser));
}));

router.post('/', h((req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const role = ROLES.includes(req.body.role) ? req.body.role : 'manager';
  if (!username) httpError(400, 'Username is required');
  if (password.length < 6) httpError(400, 'Password must be at least 6 characters');
  if (db.prepare('SELECT 1 FROM users WHERE lower(username)=lower(?)').get(username)) {
    httpError(409, 'That username already exists');
  }
  const tx = db.transaction(() => {
    const info = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)')
      .run(username, hashPassword(password), req.body.full_name || null, role);
    if (role === 'manager') setProjects(info.lastInsertRowid, req.body.projects);
    return info.lastInsertRowid;
  });
  const id = tx();
  res.status(201).json(sanitizeUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)));
}));

router.patch('/:id', h((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) httpError(404, 'User not found');
  const b = req.body;
  const sets = [], vals = [];
  if ('full_name' in b) { sets.push('full_name=?'); vals.push(b.full_name || null); }
  if ('role' in b && ROLES.includes(b.role)) { sets.push('role=?'); vals.push(b.role); }
  if ('active' in b) { sets.push('active=?'); vals.push(b.active ? 1 : 0); }
  if (b.password) {
    if (String(b.password).length < 6) httpError(400, 'Password must be at least 6 characters');
    sets.push('password_hash=?'); vals.push(hashPassword(b.password));
  }
  const tx = db.transaction(() => {
    if (sets.length) {
      sets.push(`updated_at=datetime('now')`);
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).run(...vals, u.id);
    }
    if ('projects' in b) setProjects(u.id, b.projects);
  });
  tx();
  res.json(sanitizeUser(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)));
}));

router.delete('/:id', h((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) httpError(404, 'User not found');
  if (u.id === req.user.id) httpError(400, 'You cannot delete your own account');
  if (u.role === 'admin' && db.prepare(`SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1`).get().n <= 1) {
    httpError(400, 'Cannot delete the last admin');
  }
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);
  res.json({ ok: true });
}));

export default router;
