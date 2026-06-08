import { NavLink, useLocation } from 'react-router-dom';
import { useApi } from '../api.js';
import { Icon } from './ui.jsx';

const NAV = [
  { to: '/', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/ledger', icon: 'ledger', label: 'Stock Ledger' },
  { to: '/machines', icon: 'machine', label: 'Machines' },
  { to: '/projects', icon: 'project', label: 'Projects' },
  { to: '/trends', icon: 'trend', label: 'Trends & Forecast' },
  { to: '/mapping', icon: 'map', label: 'Mapping' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

export default function Layout({ children }) {
  const { data: settings } = useApi('/settings');
  const { data: stock } = useApi('/dashboard/stock');
  const loc = useLocation();
  const lowCount = stock?.totals?.low_stock ?? 0;
  const unresolved = stock?.totals?.unresolved_aliases ?? 0;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-ink text-slate-300 flex flex-col fixed inset-y-0 no-print">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-oil-light/20 text-oil-light grid place-items-center">
            <Icon name="oil" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-white font-bold leading-tight text-[15px]">Oil Stock Book</div>
            <div className="text-[11px] text-slate-400">Issue · Receive · Monitor</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white shadow' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}>
              <Icon name={n.icon} className="w-[18px] h-[18px]" />
              <span>{n.label}</span>
              {n.to === '/mapping' && unresolved > 0 && (
                <span className="ml-auto text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold">{unresolved}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-[11px] text-slate-500 border-t border-white/10">
          {settings?.company_name || 'Edward & Christie (Pvt) Ltd'}
          <div className="text-slate-600">{settings?.company_subtitle}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-60 print:ml-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-7 sticky top-0 z-30 no-print">
          <div>
            <h1 className="font-bold text-ink text-lg">{titleFor(loc.pathname)}</h1>
          </div>
          <div className="flex items-center gap-4">
            {lowCount > 0 && (
              <NavLink to="/" className="pill bg-rose-100 text-rose-700">
                <Icon name="alert" className="w-4 h-4" /> {lowCount} need attention
              </NavLink>
            )}
            <div className="text-right">
              <div className="text-xs text-slate-400">Today</div>
              <div className="text-sm font-semibold text-slate-600">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </header>
        <main className="p-7 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

function titleFor(path) {
  if (path === '/') return 'Dashboard';
  if (path.startsWith('/ledger') || path.startsWith('/products')) return 'Stock Ledger';
  if (path.startsWith('/machines')) return 'Machines & Consumption';
  if (path.startsWith('/projects')) return 'Projects & Sites';
  if (path.startsWith('/trends')) return 'Trends & Forecast';
  if (path.startsWith('/mapping')) return 'Description Mapping';
  if (path.startsWith('/settings')) return 'Settings';
  if (path.startsWith('/report')) return 'Stock Book Report';
  return 'Oil Stock Book';
}
