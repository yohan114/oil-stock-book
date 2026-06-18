import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, ROOT, hasData } from './db.js';
import { startBackupScheduler } from './backup.js';

import products from './routes/products.js';
import transactions from './routes/transactions.js';
import assets from './routes/assets.js';
import projects from './routes/projects.js';
import analytics from './routes/analytics.js';
import aliases from './routes/aliases.js';
import settings from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// First-run convenience: seed the database from the bundled Excel files.
if (!hasData()) {
  const src = path.join(ROOT, 'data', 'source');
  if (fs.existsSync(path.join(src, 'stockbook.xlsx'))) {
    console.log('Empty database detected — importing bundled Excel data…');
    try { const { runImport } = await import('../scripts/import.js'); runImport(); }
    catch (e) { console.error('Auto-import failed (run `npm run import` manually):', e.message); }
  } else {
    console.warn('No data found. Add the Excel files to data/source/ and run `npm run import`.');
  }
}

// Start daily backup scheduler
startBackupScheduler();

const app = express();
app.use(express.json());

app.use('/api/products', products);
app.use('/api/transactions', transactions);
app.use('/api/assets', assets);
app.use('/api/projects', projects);
app.use('/api/aliases', aliases);
app.use('/api/settings', settings);
app.use('/api', analytics); // /api/dashboard/*, /api/trends/*, /api/forecast, /api/consumption/*

app.get('/api/health', (req, res) => res.json({ ok: true, products: db.prepare('SELECT COUNT(*) n FROM products').get().n }));

// Serve the built client (production) with SPA fallback.
const dist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  console.warn('⚠  Client build not found. Run `npm run build` to serve the web UI (API is still available at /api).');
}

app.listen(PORT, () => console.log(`\n🛢  Oil Stock Book running at http://localhost:${PORT}\n`));
