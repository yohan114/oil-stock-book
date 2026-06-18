import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'oilbook.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.transaction = function (fn) {
  return function (...args) {
    if (db.isTransaction) return fn.call(this, ...args);
    db.exec('BEGIN');
    try {
      const result = fn.call(this, ...args);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  };
};

// Apply schema (idempotent — uses IF NOT EXISTS).
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ── Lightweight migrations: add columns to existing tables when missing ───────
function columns(table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}
function addColumn(table, name, ddl) {
  if (!columns(table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
// Attribution + site link on transactions (v2).
addColumn('transactions', 'user_id', 'user_id INTEGER REFERENCES users(id)');
addColumn('transactions', 'site_id', 'site_id INTEGER REFERENCES sites(id)');

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
