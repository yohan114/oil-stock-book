import { Router } from 'express';
import { db } from '../db.js';
import { h, normalize } from '../util.js';
import { requireRole } from '../auth.js';

const router = Router();

router.get('/', h((req, res) => {
  const where = [];
  if (req.query.resolved != null) where.push(`a.resolved = ${req.query.resolved === '1' ? 1 : 0}`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT a.*, fa.ec_code AS asset_ec, fa.registration AS asset_reg, pr.name AS project_name
    FROM aliases a
    LEFT JOIN fleet_assets fa ON fa.id=a.asset_id
    LEFT JOIN projects pr ON pr.id=a.project_id
    ${w} ORDER BY a.resolved ASC, a.hit_count DESC, a.raw_text`).all();
  res.json(rows.map((r) => ({ ...r, resolved: !!r.resolved })));
}));

router.post('/:id/resolve', requireRole('admin', 'storekeeper'), h((req, res) => {
  const alias = db.prepare('SELECT * FROM aliases WHERE id=?').get(req.params.id);
  if (!alias) return res.status(404).json({ error: 'Alias not found' });
  let { target_type, asset_id = null, project_id = null, new_project_name } = req.body;

  if (new_project_name) {
    const name = String(new_project_name).trim();
    const existing = db.prepare('SELECT id FROM projects WHERE name=?').get(name);
    project_id = existing ? existing.id
      : db.prepare('INSERT INTO projects (name, name_norm) VALUES (?,?)').run(name, normalize(name)).lastInsertRowid;
    target_type = 'project';
  }
  if (asset_id) target_type = 'asset';
  if (!target_type) return res.status(400).json({ error: 'target_type, asset_id or project_id required' });

  db.prepare(`UPDATE aliases SET target_type=?, asset_id=?, project_id=?, resolved=1, updated_at=datetime('now') WHERE id=?`)
    .run(target_type, asset_id, project_id, alias.id);

  // Back-fill historical unknown transactions whose description normalizes to this alias.
  const candidates = db.prepare(
    `SELECT id, description FROM transactions WHERE voided=0 AND (consumer_type='unknown' OR consumer_type IS NULL) AND kind='issue'`).all();
  const upd = db.prepare('UPDATE transactions SET consumer_type=?, asset_id=?, project_id=?, updated_at=datetime(\'now\') WHERE id=?');
  let updated = 0;
  const apply = db.transaction(() => {
    for (const c of candidates) {
      if (c.description && normalize(c.description) === alias.raw_norm) {
        upd.run(target_type, asset_id, project_id, c.id);
        updated++;
      }
    }
  });
  apply();
  res.json({ ok: true, updated });
}));

export default router;
