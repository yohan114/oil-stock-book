import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'oilbook.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema (idempotent — uses IF NOT EXISTS).
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed default settings once.
const DEFAULT_SETTINGS = {
  company_name: 'Edward & Christie (Pvt) Ltd',
  company_subtitle: 'Central Work Shop - Badalgama',
  book_title: 'Fuel & Lubricant Stock Book',
  store_keeper: 'Bandula Ekanayake',
  currency_symbol: 'Rs.',
  low_stock_days: '14',
  forecast_window_days: '90',
};
const upsertSetting = db.prepare(
  'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO NOTHING'
);
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) upsertSetting.run(k, v);

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function hasData() {
  return db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0;
}
