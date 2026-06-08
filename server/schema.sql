-- Oil Stock Book — SQLite schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  sheet_name    TEXT,
  unit          TEXT NOT NULL DEFAULT 'L',
  category      TEXT,
  reorder_level REAL,
  unit_price    REAL,
  active        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fleet_assets (
  id                 INTEGER PRIMARY KEY,
  ec_code            TEXT,
  ec_code_norm       TEXT,
  registration       TEXT,
  registration_norm  TEXT,
  brand              TEXT,
  type               TEXT,
  model_no           TEXT,
  capacity           TEXT,
  yom                TEXT,
  serial_no          TEXT,
  chassis_no         TEXT,
  engine_no          TEXT,
  asset_class        TEXT NOT NULL DEFAULT 'plant',
  site               TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_ec  ON fleet_assets(ec_code_norm);
CREATE INDEX IF NOT EXISTS idx_assets_reg ON fleet_assets(registration_norm);

CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  name_norm  TEXT NOT NULL,
  location   TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_norm ON projects(name_norm);

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  txn_date      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('receipt','issue','opening','adjustment')),
  qty_received  REAL NOT NULL DEFAULT 0,
  qty_issued    REAL NOT NULL DEFAULT 0,
  balance_after REAL NOT NULL DEFAULT 0,
  consumer_type TEXT CHECK (consumer_type IN ('asset','project','internal','unknown')),
  asset_id      INTEGER REFERENCES fleet_assets(id),
  project_id    INTEGER REFERENCES projects(id),
  description   TEXT,
  mr_no         TEXT,
  mtn_no        TEXT,
  remark        TEXT,
  voided        INTEGER NOT NULL DEFAULT 0,
  import_hash   TEXT,
  source        TEXT NOT NULL DEFAULT 'manual',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txn_product_order ON transactions(product_id, txn_date, id);
CREATE INDEX IF NOT EXISTS idx_txn_asset   ON transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_txn_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_txn_date    ON transactions(txn_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_import_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS aliases (
  id          INTEGER PRIMARY KEY,
  raw_text    TEXT NOT NULL,
  raw_norm    TEXT NOT NULL UNIQUE,
  target_type TEXT CHECK (target_type IN ('asset','project','internal')),
  asset_id    INTEGER REFERENCES fleet_assets(id),
  project_id  INTEGER REFERENCES projects(id),
  resolved    INTEGER NOT NULL DEFAULT 0,
  hit_count   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aliases_resolved ON aliases(resolved);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
