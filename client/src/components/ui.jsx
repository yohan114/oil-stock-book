import { STATUS } from '../lib/format.js';

const PATHS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  ledger: 'M4 4h16v16H4zM4 9h16M9 4v16',
  machine: 'M3 17h2l1-4h12l1 4h2M5 13l1.5-5h11L19 13M7 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  project: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 13v.01M9 17v.01',
  trend: 'M3 3v18h18M7 14l4-4 3 3 5-6',
  map: 'M9 6l6-3 6 3v15l-6-3-6 3-6-3V3l6 3zm0 0v15',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.8-2.7 1.6 1.6 0 010-3.2 1.6 1.6 0 001.8-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-.7 1.6 1.6 0 013.2 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.7 2.7 1.6 1.6 0 010 3.2z',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z',
  alert: 'M12 9v4m0 4h.01M10.3 3.3L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.3a2 2 0 00-3.4 0z',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
  close: 'M18 6L6 18M6 6l12 12',
  oil: 'M7 21h10a2 2 0 002-2V8l-4-5H7a2 2 0 00-2 2v14a2 2 0 002 2zM9 3v4M13 12c0 1.5-2 3-2 3s-2-1.5-2-3a2 2 0 014 0z',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  back: 'M19 12H5m0 0l7 7m-7-7l7-7',
  battery: 'M3 8a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm18 3v2M7 10v4m3-4v4',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9',
  camera: 'M3 7h3l2-2h8l2 2h3a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1zm9 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5 5h14l3 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6l3-7z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  check: 'M20 6L9 17l-5-5',
};

export function Icon({ name, className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || ''} />
    </svg>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.idle;
  return (
    <span className={`pill ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Pill({ children, className = 'bg-slate-100 text-slate-600' }) {
  return <span className={`pill ${className}`}>{children}</span>;
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 text-slate-400 py-10 justify-center">
      <span className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorMsg({ error }) {
  return <div className="card p-4 text-rose-600 text-sm bg-rose-50 border-rose-200">⚠ {String(error)}</div>;
}

export function Empty({ children = 'No data' }) {
  return <div className="text-center text-slate-400 text-sm py-10">{children}</div>;
}

export function Stat({ icon, label, value, sub, accent = 'text-brand-600', onClick }) {
  return (
    <div className={`card p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        {icon && <span className={accent}><Icon name={icon} className="w-5 h-5" /></span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 overflow-y-auto no-print" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} mt-10 mb-10`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h3 className="font-bold text-ink">{title}</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
