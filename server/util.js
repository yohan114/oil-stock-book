import { db } from './db.js';
import { PROJECTS, classifyConsumer, normalize, round3 } from '../scripts/lib.js';

/** Wrap a synchronous route handler with error handling. */
export const h = (fn) => (req, res) => {
  try { fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ error: String(err.message || err) }); }
};

/** Build the in-memory lookup context used to auto-classify a consumer from free text. */
export function buildCtx() {
  const ecMap = new Map(), regMap = new Map();
  for (const a of db.prepare('SELECT id, ec_code_norm, registration_norm FROM fleet_assets').all()) {
    if (a.ec_code_norm && !ecMap.has(a.ec_code_norm)) ecMap.set(a.ec_code_norm, a.id);
    if (a.registration_norm && !regMap.has(a.registration_norm)) regMap.set(a.registration_norm, a.id);
  }
  const byName = Object.fromEntries(db.prepare('SELECT id, name FROM projects').all().map((p) => [p.name, p.id]));
  const projects = PROJECTS.map((p) => ({ id: byName[p.name], patterns: p.patterns })).filter((p) => p.id);
  const aliasMap = new Map();
  for (const a of db.prepare(`SELECT raw_norm, target_type, asset_id, project_id FROM aliases WHERE resolved=1`).all()) {
    aliasMap.set(a.raw_norm, { ...a, resolved: 1 });
  }
  return { ecMap, regMap, projects, aliasMap };
}

export function classifyText(desc) {
  return classifyConsumer(desc, buildCtx());
}

/** Human label for a transaction's consumer. */
export function consumerLabel(row) {
  if (row.asset_ec || row.asset_reg) {
    return [row.asset_ec, row.asset_reg].filter(Boolean).join(' / ');
  }
  if (row.project_name) return row.project_name;
  if (row.consumer_type === 'internal') return row.description || 'Internal';
  return row.description || '—';
}

export const TXN_SELECT = `
  SELECT t.*, p.name AS product_name, p.unit AS unit, p.category AS category,
         a.ec_code AS asset_ec, a.registration AS asset_reg, a.type AS asset_type, a.brand AS asset_brand,
         pr.name AS project_name
  FROM transactions t
  JOIN products p ON p.id = t.product_id
  LEFT JOIN fleet_assets a ON a.id = t.asset_id
  LEFT JOIN projects pr ON pr.id = t.project_id`;

export function decorate(row) {
  return { ...row, consumer_label: consumerLabel(row), voided: !!row.voided };
}

export { normalize, round3 };
