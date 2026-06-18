export const fmt = (n, d = 2) =>
  n == null || n === '' || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });

export const qty = (n, unit) => (n == null ? '—' : `${fmt(n)}${unit ? ' ' + unit : ''}`);

export const money = (n, sym = 'Rs.') => (n == null ? '—' : `${sym} ${fmt(n, 2)}`);

export const date = (s) =>
  !s ? '—' : new Date(s + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

export const STATUS = {
  ok: { label: 'Healthy', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  low: { label: 'Low', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  critical: { label: 'Critical', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  out: { label: 'Out of stock', cls: 'bg-rose-600 text-white', dot: 'bg-white' },
  idle: { label: 'Idle', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

export const CATEGORY = {
  engine_oil: 'Engine Oil',
  hydraulic: 'Hydraulic Oil',
  gear_oil: 'Gear Oil',
  grease: 'Grease',
  fuel: 'Fuel',
  coolant: 'Coolant',
  filter: 'Filter',
  spare_part: 'Spare Part',
  tyre: 'Tyre / Tube',
  battery: 'Battery',
  consumable: 'Consumable',
  other: 'Other',
};

export const categoryLabel = (c) => CATEGORY[c] || c || 'Uncategorised';

// Common units of measure for general materials.
export const UNITS = ['L', 'kg', 'pcs', 'set', 'box', 'can', 'drum', 'm', 'roll', 'pair'];

export const CHART_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
