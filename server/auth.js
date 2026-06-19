import crypto from 'node:crypto';
import { db } from './db.js';

// ── Password hashing (scrypt — built in, no external dependency) ──────────────
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Sessions (token in `sessions` table, 30-day sliding expiry) ───────────────
const SESSION_DAYS = 30;

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`
  ).run(token, userId);
  return token;
}

export function sessionUser(token) {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).get(token);
  return row || null;
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ── Project scoping ───────────────────────────────────────────────────────────
export function managerProjectIds(userId) {
  return db.prepare('SELECT project_id FROM user_projects WHERE user_id = ?').all(userId).map((r) => r.project_id);
}

export function canAccessProject(user, projectId) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'storekeeper') return true;
  if (!projectId) return false;
  return managerProjectIds(user.id).includes(Number(projectId));
}

export function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return { ...rest, active: !!rest.active, projects: u.role === 'manager' ? managerProjectIds(u.id) : null };
}

// ── Express middleware ────────────────────────────────────────────────────────
function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function authenticate(req, res, next) {
  const user = sessionUser(bearer(req));
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  req.token = bearer(req);
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission for this action' });
    next();
  };
}

// ── First-run seed: a default admin so the app is reachable ───────────────────
export function seedAdmin() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (n > 0) return;
  db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)')
    .run('admin', hashPassword('admin123'), 'Administrator', 'admin');
  console.log('\n⚠  Seeded default admin account → username: admin  password: admin123');
  console.log('   Change this password in Settings → Users immediately.\n');
}
