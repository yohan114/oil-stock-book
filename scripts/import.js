import XLSX from 'xlsx';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db, ROOT } from '../server/db.js';
import { recomputeLedger } from '../server/ledger.js';
import {
  normalize, round3, resolveDate, classifyKind, classifyConsumer,
  PRODUCT_MAP, SKIP_SHEETS, PROJECTS,
} from './lib.js';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh');
const files = args.filter((a) => !a.startsWith('--'));
const STOCKBOOK = files[0] || path.join(ROOT, 'data', 'source', 'stockbook.xlsx');
const MACHINES = files[1] || path.join(ROOT, 'data', 'source', 'machinelist.xlsx');

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function resetData() {
  const tables = ['transactions', 'aliases', 'projects', 'fleet_assets', 'products'];
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of tables) db.exec(`DELETE FROM ${t}`);
  const hasSeq = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`).get();
  if (hasSeq) db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map((t) => `'${t}'`).join(',')})`);
  db.exec('PRAGMA foreign_keys = ON');
}

// ── Fleet assets ──────────────────────────────────────────────────────────────
function importFleet() {
  const wb = XLSX.readFile(MACHINES);
  const insert = db.prepare(`
    INSERT INTO fleet_assets
      (ec_code, ec_code_norm, registration, registration_norm, brand, type,
       model_no, capacity, yom, serial_no, chassis_no, engine_no, asset_class, site)
    VALUES (@ec_code,@ec_code_norm,@registration,@registration_norm,@brand,@type,
            @model_no,@capacity,@yom,@serial_no,@chassis_no,@engine_no,@asset_class,@site)`);
  const seen = new Set();
  let n = 0;

  const handle = (rows, cls, isBike) => {
    for (const row of rows) {
      const ec = str(row[1]);
      const reg = str(row[5]);
      if (!ec && !reg) continue;
      const a0 = String(row[0] ?? '').toUpperCase();
      if (a0 === 'NO' || (ec && /E&C|E AND C|NUMBER/i.test(ec))) continue; // header rows
      const key = normalize(ec || '') + '|' + normalize(reg || '');
      if (seen.has(key)) continue;
      seen.add(key);
      insert.run({
        ec_code: ec, ec_code_norm: ec ? normalize(ec) : null,
        registration: reg, registration_norm: reg ? normalize(reg) : null,
        brand: str(row[2]), type: str(row[3]), model_no: str(row[4]),
        capacity: str(row[6]),
        yom: isBike ? null : str(row[7]),
        serial_no: isBike ? str(row[7]) : str(row[8]),
        chassis_no: isBike ? null : str(row[9]),
        engine_no: isBike ? null : str(row[10]),
        asset_class: cls,
        site: isBike ? str(row[8]) : null,
      });
      n++;
    }
  };

  for (const sn of wb.SheetNames) {
    const low = sn.toLowerCase();
    if (low.includes('summery') || low.includes('summary')) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, blankrows: false });
    handle(rows, low.includes('bike') ? 'bike' : 'plant', low.includes('bike'));
  }
  return n;
}

// ── Products ──────────────────────────────────────────────────────────────────
function importProducts(stockWb) {
  const insert = db.prepare(
    `INSERT INTO products (name, sheet_name, unit, category, sort_order) VALUES (?,?,?,?,?)`
  );
  const map = {}; // sheetName -> productId
  let order = 0;
  for (const sn of stockWb.SheetNames) {
    if (SKIP_SHEETS.has(sn) || !PRODUCT_MAP[sn]) continue;
    const meta = PRODUCT_MAP[sn];
    const info = insert.run(meta.name, sn, meta.unit, meta.category, order++);
    map[sn] = info.lastInsertRowid;
  }
  return map;
}

// ── Projects ──────────────────────────────────────────────────────────────────
function importProjects() {
  const insert = db.prepare(
    `INSERT INTO projects (name, name_norm, location) VALUES (?,?,?)`
  );
  return PROJECTS.map((p) => {
    const info = insert.run(p.name, normalize(p.name), p.location || null);
    return { id: info.lastInsertRowid, patterns: p.patterns };
  });
}

function buildContext(projectRows) {
  const ecMap = new Map();
  const regMap = new Map();
  for (const a of db.prepare('SELECT id, ec_code_norm, registration_norm FROM fleet_assets').all()) {
    if (a.ec_code_norm && !ecMap.has(a.ec_code_norm)) ecMap.set(a.ec_code_norm, a.id);
    if (a.registration_norm && !regMap.has(a.registration_norm)) regMap.set(a.registration_norm, a.id);
  }
  return { ecMap, regMap, projects: projectRows, aliasMap: new Map() };
}

// ── Transactions ──────────────────────────────────────────────────────────────
// Find the header row (the one containing a "Description" cell) so we are immune
// to the variable number of title/blank rows that precede each ledger.
function findDataStart(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => typeof c === 'string' && /^description$/i.test(c.trim()))) return i + 1;
  }
  return 5;
}
function firstValidISO(rows, start) {
  for (let i = start; i < rows.length; i++) {
    const { iso, bad } = resolveDate(rows[i][0], null);
    if (!bad) return iso;
  }
  return '2025-06-01';
}

function importTransactions(stockWb, productMap, ctx) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (product_id, txn_date, kind, qty_received, qty_issued, balance_after,
       consumer_type, asset_id, project_id, description, mr_no, mtn_no, remark, import_hash, source)
    VALUES (@product_id,@txn_date,@kind,@qty_received,@qty_issued,0,
            @consumer_type,@asset_id,@project_id,@description,@mr_no,@mtn_no,@remark,@import_hash,'import')`);
  const bumpAlias = db.prepare(`
    INSERT INTO aliases (raw_text, raw_norm, hit_count) VALUES (?, ?, 1)
    ON CONFLICT(raw_norm) DO UPDATE SET hit_count = hit_count + 1, updated_at = datetime('now')`);

  const stats = { rows: 0, receipts: 0, issues: 0, openings: 0, adjustments: 0, badDates: 0,
    reconciled: 0, asset: 0, project: 0, internal: 0, unknown: 0 };

  for (const [sheet, productId] of Object.entries(productMap)) {
    const rows = XLSX.utils.sheet_to_json(stockWb.Sheets[sheet], { header: 1, raw: true, blankrows: false });
    const start = findDataStart(rows);
    let prevISO = firstValidISO(rows, start); // seed so a dateless opening row inherits the first real date
    let running = 0;
    let firstMovement = true;

    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const desc = str(r[3]);
      const received = num(r[4]);
      const issued = num(r[5]);
      const balRaw = r[6];
      const hasBal = typeof balRaw === 'number';
      if (desc && /^(date|description)$/i.test(desc)) continue;
      if (desc === null && received === 0 && issued === 0 && !hasBal) continue; // truly empty

      const { iso, bad } = resolveDate(r[0], prevISO);
      prevISO = iso;

      // Decide movement. Reconcile against the book's Balance column when present.
      let kind, qtyR = 0, qtyI = 0;
      if (received === 0 && issued === 0) {
        if (!hasBal) continue;
        const delta = round3(balRaw - running);
        if (Math.abs(delta) <= 0.01) continue;            // trailing balance-carry row → skip
        kind = firstMovement ? 'opening' : 'adjustment';
        if (delta >= 0) qtyR = delta; else qtyI = -delta;
      } else if (issued > 0) {
        kind = 'issue'; qtyI = round3(issued); qtyR = round3(received);
      } else {
        kind = 'receipt'; qtyR = round3(received);
      }
      if (kind === 'receipt' && /^(BF|BFBALANCE|BALANCE|OPENING)/.test(normalize(desc)) && firstMovement) kind = 'opening';

      // Fold any residual so the stored movements reproduce the book's balance exactly.
      let reconciled = false;
      if (hasBal) {
        const projected = round3(running + qtyR - qtyI);
        const residual = round3(balRaw - projected);
        if (Math.abs(residual) > 0.01) {
          if (residual >= 0) qtyR = round3(qtyR + residual); else qtyI = round3(qtyI - residual);
          reconciled = true;
        }
      }
      running = round3(running + qtyR - qtyI);

      let consumer = { consumer_type: null, asset_id: null, project_id: null };
      if (kind === 'issue') {
        consumer = classifyConsumer(desc, ctx);
        stats[consumer.consumer_type] = (stats[consumer.consumer_type] || 0) + 1;
        if (consumer.consumer_type === 'unknown' && desc) bumpAlias.run(desc, normalize(desc));
      }

      let remark = str(r[7]);
      if (bad) remark = (remark ? remark + ' ' : '') + `[BAD_DATE:${r[0]}]`;
      if (reconciled) remark = (remark ? remark + ' ' : '') + '[balance reconciled]';

      const hash = crypto.createHash('sha1')
        .update(`${sheet}|${i}|${iso}|${desc || ''}|${qtyR}|${qtyI}`).digest('hex');

      insert.run({
        product_id: productId, txn_date: iso, kind,
        qty_received: qtyR, qty_issued: qtyI,
        consumer_type: consumer.consumer_type, asset_id: consumer.asset_id, project_id: consumer.project_id,
        description: desc, mr_no: str(r[1]), mtn_no: str(r[2]), remark, import_hash: hash,
      });

      firstMovement = false;
      stats.rows++;
      stats[kind === 'opening' ? 'openings' : kind === 'adjustment' ? 'adjustments'
        : kind === 'receipt' ? 'receipts' : 'issues']++;
      if (bad) stats.badDates++;
      if (reconciled) stats.reconciled++;
    }
  }
  return stats;
}

// ── Default reorder levels (≈ one month of recent issues) ─────────────────────
function setDefaultReorderLevels() {
  const products = db.prepare('SELECT id FROM products').all();
  const monthly = db.prepare(`
    SELECT COALESCE(SUM(qty_issued),0) AS issued
    FROM transactions
    WHERE product_id = ? AND voided = 0 AND kind='issue'
      AND txn_date >= date('now','-90 day')`);
  const upd = db.prepare('UPDATE products SET reorder_level = ? WHERE id = ?');
  for (const p of products) {
    const issued = monthly.get(p.id).issued;
    const level = round3(issued / 3); // ~monthly burn
    upd.run(level > 0 ? level : 10, p.id);
  }
}

// ── Summery cross-check ───────────────────────────────────────────────────────
function summeryCrossCheck(stockWb) {
  const ws = stockWb.Sheets['Summery'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
  // The Summery sheet's range starts at column B, so find Item/Qty by header.
  let itemCol = -1, qtyCol = -1, hdr = -1;
  for (let i = 0; i < rows.length && hdr < 0; i++) {
    rows[i].forEach((v, c) => {
      const t = String(v ?? '').trim().toLowerCase();
      if (t === 'item') itemCol = c;
      if (t === 'qty' || t === 'quantity') qtyCol = c;
    });
    if (itemCol >= 0 && qtyCol >= 0) hdr = i;
  }
  if (hdr < 0) return [];
  const products = db.prepare('SELECT id, name FROM products').all().map((p) => ({ ...p, norm: normalize(p.name) }));
  const balOf = db.prepare(
    `SELECT balance_after FROM transactions WHERE product_id=? AND voided=0 ORDER BY txn_date DESC, id DESC LIMIT 1`);
  const diffs = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const item = str(rows[i][itemCol]);
    const qty = rows[i][qtyCol];
    if (!item || typeof qty !== 'number') continue;
    const itemNorm = normalize(item);
    const match = products.find((p) => p.norm === itemNorm)
      || products.find((p) => itemNorm.includes(p.norm) || p.norm.includes(itemNorm));
    if (!match) continue;
    const computed = (balOf.get(match.id) || {}).balance_after ?? 0;
    diffs.push({ item: match.name, summery: qty, computed, diff: round3(computed - qty) });
  }
  return diffs;
}

// ── Run ───────────────────────────────────────────────────────────────────────
function run() {
  for (const f of [STOCKBOOK, MACHINES]) {
    if (!fs.existsSync(f)) { console.error(`Missing source file: ${f}`); process.exit(1); }
  }
  console.log(`Importing\n  stock book : ${STOCKBOOK}\n  machines   : ${MACHINES}${FRESH ? '\n  (--fresh: wiping existing data)' : ''}\n`);

  const result = db.transaction(() => {
    if (FRESH) resetData();
    const stockWb = XLSX.readFile(STOCKBOOK);
    const fleetN = importFleet();
    const productMap = importProducts(stockWb);
    const projectRows = importProjects();
    const ctx = buildContext(projectRows);
    const stats = importTransactions(stockWb, productMap, ctx);
    return { fleetN, productN: Object.keys(productMap).length, projectN: projectRows.length, stats, stockWb };
  })();

  // Recompute balances + defaults outside the bulk insert transaction.
  for (const p of db.prepare('SELECT id FROM products').all()) recomputeLedger(p.id);
  setDefaultReorderLevels();
  const diffs = summeryCrossCheck(result.stockWb);
  const unresolved = db.prepare('SELECT COUNT(*) AS n FROM aliases WHERE resolved=0').get().n;

  const s = result.stats;
  console.log('── Import summary ─────────────────────────────');
  console.log(`  Products        : ${result.productN}`);
  console.log(`  Fleet assets    : ${result.fleetN}`);
  console.log(`  Projects        : ${result.projectN}`);
  console.log(`  Transactions    : ${s.rows}  (receipts ${s.receipts}, issues ${s.issues}, openings ${s.openings}, adjustments ${s.adjustments})`);
  console.log(`  Issue linkage   : asset ${s.asset}, project ${s.project}, internal ${s.internal}, unknown ${s.unknown}`);
  console.log(`  Bad dates fixed : ${s.badDates}  |  rows reconciled to book balance : ${s.reconciled}`);
  console.log(`  Unresolved aliases (need mapping) : ${unresolved}`);
  console.log('\n── Summery cross-check (computed vs spreadsheet) ──');
  for (const d of diffs) {
    const flag = Math.abs(d.diff) > 0.01 ? `  <-- diff ${d.diff}` : '';
    console.log(`  ${d.item.padEnd(26)} computed ${String(d.computed).padStart(9)} | summery ${String(d.summery).padStart(9)}${flag}`);
  }
  console.log('\nDone.');
}

export { run as runImport };

// Only auto-run when executed directly (`node scripts/import.js`), not when imported.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/scripts/import.js')) run();
