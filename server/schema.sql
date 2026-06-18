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

-- ── v2: users, roles & sessions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin','storekeeper','manager')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which projects a (manager) user may issue to / see. Admin & storekeeper see all.
CREATE TABLE IF NOT EXISTS user_projects (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ── v2: sites under a project ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  name_norm  TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, name_norm)
);
CREATE INDEX IF NOT EXISTS idx_sites_project ON sites(project_id);

-- ── v2: month-end physical stock count / reconciliation ───────────────────────
CREATE TABLE IF NOT EXISTS stock_counts (
  id           INTEGER PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  period       TEXT NOT NULL,                       -- 'YYYY-MM' the count closes
  book_qty     REAL NOT NULL DEFAULT 0,             -- system balance at period end
  counted_qty  REAL NOT NULL DEFAULT 0,             -- physical count
  variance     REAL NOT NULL DEFAULT 0,             -- counted - book
  adjusted     INTEGER NOT NULL DEFAULT 0,          -- 1 if an adjustment txn was posted
  note         TEXT,
  counted_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, period)
);
CREATE INDEX IF NOT EXISTS idx_counts_period ON stock_counts(period);

-- ── v2: battery register (one battery per vehicle, both unique) ───────────────
CREATE TABLE IF NOT EXISTS batteries (
  id              INTEGER PRIMARY KEY,
  vehicle_no      TEXT NOT NULL,
  vehicle_no_norm TEXT NOT NULL UNIQUE,
  serial_no       TEXT NOT NULL,
  serial_no_norm  TEXT NOT NULL UNIQUE,
  note            TEXT,
  photo_path      TEXT NOT NULL,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
