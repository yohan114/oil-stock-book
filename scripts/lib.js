// Shared utilities for import + runtime classification.

/** Normalize an identifier/description for matching: uppercase, strip non-alphanumerics. */
export function normalize(s) {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

/** Convert an Excel serial date (1900 system) to ISO 'YYYY-MM-DD'. */
export function serialToISO(n) {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = 1970-01-01
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const DATE_MIN = '2024-06-01';
const DATE_MAX = '2027-12-31';

/**
 * Tolerant date resolution. Returns { iso, bad }.
 * Blank cells silently inherit prevISO (common in these ledgers — the date is
 * written once per day). Only a present-but-invalid value is flagged `bad`.
 */
export function resolveDate(raw, prevISO) {
  const blank = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
  if (blank) return { iso: prevISO || '2025-06-01', bad: false };
  let iso = null;
  if (typeof raw === 'number') iso = serialToISO(raw);
  else if (raw instanceof Date && !isNaN(raw.getTime())) iso = raw.toISOString().slice(0, 10);
  else if (typeof raw === 'string') {
    const t = Date.parse(raw);
    if (!isNaN(t)) iso = new Date(t).toISOString().slice(0, 10);
  }
  if (iso && iso > '2026-06-12') {
    iso = '2025' + iso.slice(4);
  }
  if (iso && iso >= DATE_MIN && iso <= DATE_MAX) return { iso, bad: false };
  return { iso: prevISO || iso || '2025-06-01', bad: true };
}

// ── Stock-book sheet → canonical product mapping ──────────────────────────────
export const SKIP_SHEETS = new Set(['Summery', 'Chart1', 'Sheet1', 'Sheet2', 'Sheet3']);

export const PRODUCT_MAP = {
  '15W40(CI-04)Valvoline': { name: '15W40 (CI-04) Valvoline', unit: 'L', category: 'engine_oil' },
  '15W40(servo)':          { name: '15W40 (CI-04) Servo',     unit: 'L', category: 'engine_oil' },
  '15W40(Delogold)':       { name: '15W40 (CI-04) Delogold',  unit: 'L', category: 'engine_oil' },
  'DS-10 Oil':             { name: 'DS-10',                   unit: 'L', category: 'engine_oil' },
  '20W-50':                { name: '20W-50',                  unit: 'L', category: 'engine_oil' },
  'SAE-30':                { name: 'SAE-30',                  unit: 'L', category: 'engine_oil' },
  'HD-68 Hy-Oil Caltex':   { name: 'HD-68 Hy/Oil Caltex',     unit: 'L', category: 'hydraulic' },
  'SERVO-68 HY-OIL':       { name: 'SERVO-68 Hy/Oil',         unit: 'L', category: 'hydraulic' },
  'HD-46 Hy-Oil-Caltex':   { name: 'HD-46 Hy/Oil Caltex',     unit: 'L', category: 'hydraulic' },
  'HD-46 Hy Oil SERVO':    { name: 'HD-46 Hy/Oil Servo',      unit: 'L', category: 'hydraulic' },
  'Power Oil-1888':        { name: 'Power Oil-1888',          unit: 'L', category: 'hydraulic' },
  'MP-90 Gear Oil':        { name: 'MP-90 Gear Oil',          unit: 'L', category: 'gear_oil' },
  '80W90 (Caltex)':        { name: '80W90 Gear Oil Caltex',   unit: 'L', category: 'gear_oil' },
  '80W90 G-Oil (Servo)':   { name: '80W90 Gear Oil Servo',    unit: 'L', category: 'gear_oil' },
  'MP-140 G-Oil':          { name: 'MP-140 Gear Oil',         unit: 'L', category: 'gear_oil' },
  'Grease':                { name: 'Grease',                  unit: 'kg', category: 'grease' },
  'K-Oil':                 { name: 'Karosine Oil',            unit: 'L', category: 'fuel' },
  'PETROL':                { name: 'Petrol',                  unit: 'L', category: 'fuel' },
  'HUB GREASE':            { name: 'Hub Grease',              unit: 'kg', category: 'grease' },
  'cotten waste':          { name: 'Cotton Waste',            unit: 'kg', category: 'other' },
};

// ── Projects / sites (canonical + normalized match patterns) ──────────────────
export const PROJECTS = [
  { name: 'CEP-03 Project',          location: '',            patterns: ['CEP'] },
  { name: 'Ruwanwella Water Project', location: 'Ruwanwella', patterns: ['RUWANWELLA'] },
  { name: 'Marawila Road Project',    location: 'Marawila',   patterns: ['MARAWILA'] },
  { name: 'Batticaloa Project',       location: 'Batticaloa', patterns: ['BATTICOLOA', 'BATTICALOA', 'BATTIC'] },
  { name: 'Muthur Plant',             location: 'Muthur',     patterns: ['MUTHUR'] },
  { name: 'Asphalt Plant',            location: '',           patterns: ['ASPHALT'] },
  { name: 'Iginimitiya Project',      location: 'Iginimitiya', patterns: ['IGINIMITIYA', 'IGINI'] },
  { name: 'Port City',                location: 'Colombo',    patterns: ['PORTCITY'] },
  { name: 'Kilinochchi Project',      location: 'Kilinochchi', patterns: ['KILINOCHCHI', 'KILINOCH'] },
];

// Internal / workshop consumers (normalized substring → label is the raw description)
const INTERNAL_PATTERNS = ['SERVICE', 'LATHE', 'WORKSHOP', 'WHEREHOUSE', 'LOCALPURCH', 'PILEDRIVER'];

// Receipt / opening detection
const OPENING_RE = /^(BF|BFBALANCE|BALANCE|BROUGHTFORWARD|BROUGHT|OPENING|OPENINGBALANCE)$/;
const RECEIPT_RE = /(MAINSTORE|EXCESSRECEIVED|LOCALPURCH|RECEIVE|RECEIVED)/;

/** Decide transaction kind from description + numeric columns. */
export function classifyKind(desc, received, issued) {
  const n = normalize(desc);
  const hasR = received > 0;
  const hasI = issued > 0;
  if (OPENING_RE.test(n)) return 'opening';
  if (hasR && !hasI) return 'receipt';
  if (hasI) return 'issue';
  if (RECEIPT_RE.test(n)) return 'receipt';
  return hasR ? 'receipt' : 'issue';
}

/**
 * Classify an issue's consumer against in-memory lookups.
 * ctx = { ecMap:Map, regMap:Map, projects:[{id,patterns}], aliasMap:Map }
 * Returns { consumer_type, asset_id, project_id }.
 */
export function classifyConsumer(desc, ctx) {
  const n = normalize(desc);
  if (!n) return { consumer_type: 'unknown', asset_id: null, project_id: null };

  // 1. Learned/resolved alias wins.
  const al = ctx.aliasMap && ctx.aliasMap.get(n);
  if (al && al.resolved) {
    return { consumer_type: al.target_type, asset_id: al.asset_id || null, project_id: al.project_id || null };
  }

  // 2. Direct fleet match (whole string), then per-token.
  if (ctx.ecMap.has(n))  return { consumer_type: 'asset', asset_id: ctx.ecMap.get(n),  project_id: null };
  if (ctx.regMap.has(n)) return { consumer_type: 'asset', asset_id: ctx.regMap.get(n), project_id: null };
  for (const tok of String(desc).split(/[^A-Za-z0-9]+/)) {
    const tn = normalize(tok);
    if (tn.length < 4) continue;
    if (ctx.ecMap.has(tn))  return { consumer_type: 'asset', asset_id: ctx.ecMap.get(tn),  project_id: null };
    if (ctx.regMap.has(tn)) return { consumer_type: 'asset', asset_id: ctx.regMap.get(tn), project_id: null };
  }

  // 3. Project / site.
  for (const p of ctx.projects) {
    if (p.patterns.some((pat) => n.includes(pat))) {
      return { consumer_type: 'project', asset_id: null, project_id: p.id };
    }
  }

  // 4. Internal / workshop.
  if (INTERNAL_PATTERNS.some((pat) => n.includes(pat))) {
    return { consumer_type: 'internal', asset_id: null, project_id: null };
  }

  return { consumer_type: 'unknown', asset_id: null, project_id: null };
}
