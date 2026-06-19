import { Router } from 'express';
import { db } from '../db.js';
import { h, httpError } from '../util.js';
import {
  verifyPassword, hashPassword, createSession, deleteSession, sanitizeUser, authenticate,
} from '../auth.js';

const router = Router();

// POST /api/auth/login  (public)
router.post('/login', h((req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!username || !password) httpError(400, 'Username and password are required');
  const user = db.prepare('SELECT * FROM users WHERE lower(username) = ?').get(username);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    httpError(401, 'Invalid username or password');
  }
  const token = createSession(user.id);
  res.json({ token, user: sanitizeUser(user) });
}));

// POST /api/auth/logout
router.post('/logout', authenticate, h((req, res) => {
  deleteSession(req.token);
  res.json({ ok: true });
}));

// GET /api/auth/me
router.get('/me', authenticate, h((req, res) => res.json(sanitizeUser(req.user))));

// POST /api/auth/password  — change own password
router.post('/password', authenticate, h((req, res) => {
  const { current_password, new_password } = req.body;
  if (!verifyPassword(String(current_password || ''), req.user.password_hash)) {
    httpError(400, 'Current password is incorrect');
  }
  if (String(new_password || '').length < 6) httpError(400, 'New password must be at least 6 characters');
  db.prepare(`UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`)
    .run(hashPassword(new_password), req.user.id);
  res.json({ ok: true });
}));

export default router;
