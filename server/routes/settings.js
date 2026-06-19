import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { h } from '../util.js';
import { requireRole } from '../auth.js';

const router = Router();

router.get('/', h((req, res) => res.json(getSettings())));

router.put('/', requireRole('admin', 'storekeeper'), h((req, res) => {
  const up = db.prepare(`INSERT INTO settings(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  const tx = db.transaction((obj) => { for (const [k, v] of Object.entries(obj)) up.run(k, String(v)); });
  tx(req.body || {});
  res.json(getSettings());
}));

export default router;
