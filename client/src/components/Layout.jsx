import { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { useAuth, ROLE_LABEL } from '../auth.jsx';
import { Icon } from './ui.jsx';

// Nav items, each tagged with the roles allowed to see it.
const NAV = [
  { to: '/', icon: 'dashboard', label: 'Dashboard', end: true, roles: ['admin', 'storekeeper', 'manager'] },
  { to: '/ledger', icon: 'ledger', label: 'Stock Ledger', roles: ['admin', 'storekeeper'] },
  { to: '/requisitions', icon: 'inbox', label: 'Requisitions', roles: ['admin', 'storekeeper', 'manager'] },
  { to: '/batteries', icon: 'battery', label: 'Battery Stock', roles: ['admin', 'storekeeper', 'manager'] },
  { to: '/machines', icon: 'machine', label: 'Machines', roles: ['admin', 'storekeeper'] },
  { to: '/projects', icon: 'project', label: 'Projects', roles: ['admin', 'storekeeper', 'manager'] },
  { to: '/stock-take', icon: 'clipboard', label: 'Stock Take', roles: ['admin', 'storekeeper'] },
  { to: '/trends', icon: 'trend', label: 'Trends & Forecast', roles: ['admin', 'storekeeper'] },
  { to: '/mapping', icon: 'map', label: 'Mapping', roles: ['admin', 'storekeeper'] },
  { to: '/users', icon: 'users', label: 'Users', roles: ['admin'] },
  { to: '/settings', icon: 'settings', label: 'Settings', roles: ['admin', 'storekeeper'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { data: settings } = useApi('/settings');
  const { data: stock } = useApi('/dashboard/stock');
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const { data: overdue } = useApi(staff ? '/tally/overdue' : null);
  const { data: reqSummary } = useApi('/requisitions/summary');
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  // SK/admin act on pending requests; managers confirm receipt of sent dispatches.
  const reqBadge = staff ? (reqSummary?.pending ?? 0) : (reqSummary?.awaiting_receipt ?? 0);

  const lowCount = stock?.totals?.low_stock ?? 0;
  const unresolved = stock?.totals?.unresolved_aliases ?? 0;
  const pendingAssets = stock?.totals?.pending_assets ?? 0;
  const nav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 bg-ink/50 z-40 lg:hidden no-print" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`w-64 shrink-0 bg-ink text-slate-300 flex flex-col fixed inset-y-0 z-50 no-print
        transform transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-oil-light/20 text-oil-light grid place-items-center">
            <Icon name="oil" className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-white font-bold leading-tight text-[15px]">Oil Stock Book</div>
            <div className="text-[11px] text-slate-400">Issue · Receive · Monitor</div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white shadow' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}>
              <Icon name={n.icon} className="w-[18px] h-[18px]" />
              <span>{n.label}</span>
              {n.to === '/mapping' && unresolved > 0 && (
                <span className="ml-auto text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold">{unresolved}</span>
              )}
              {n.to === '/requisitions' && reqBadge > 0 && (
                <span className="ml-auto text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold">{reqBadge}</span>
              )}
              {n.to === '/machines' && pendingAssets > 0 && (
                <span className="ml-auto text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold">{pendingAssets}</span>
              )}
              {n.to === '/stock-take' && overdue?.overdue && (
                <span className="ml-auto text-[10px] bg-rose-500 text-white rounded-full px-1.5 py-0.5 font-bold">!</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User panel */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center text-slate-200"><Icon name="user" className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold truncate">{user.full_name || user.username}</div>
              <div className="text-[11px] text-slate-400">{ROLE_LABEL[user.role]}</div>
            </div>
            <button onClick={logout} title="Sign out" className="text-slate-400 hover:text-white"><Icon name="logout" className="w-[18px] h-[18px]" /></button>
          </div>
          <div className="px-2 pt-1 text-[10px] text-slate-600">{settings?.company_name || 'Edward & Christie (Pvt) Ltd'}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 print:ml-0 min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-7 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden text-slate-600 -ml-1" onClick={() => setOpen(true)}><Icon name="menu" /></button>
            <h1 className="font-bold text-ink text-base sm:text-lg truncate">{titleFor(loc.pathname)}</h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {lowCount > 0 && (
              <NavLink to="/" className="pill bg-rose-100 text-rose-700">
                <Icon name="alert" className="w-4 h-4" /> <span className="hidden sm:inline">{lowCount} need attention</span><span className="sm:hidden">{lowCount}</span>
              </NavLink>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400">Today</div>
              <div className="text-sm font-semibold text-slate-600">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </header>

        {/* New-vehicle registration notice */}
        {staff && pendingAssets > 0 && (
          <Link to="/machines" className="no-print flex items-center gap-2 bg-amber-500 text-white px-4 sm:px-7 py-2.5 text-sm font-semibold hover:bg-amber-600">
            <Icon name="machine" className="w-4 h-4 shrink-0" />
            <span>{pendingAssets} new vehicle/machine{pendingAssets > 1 ? 's' : ''} detected during issuing — please complete registration →</span>
          </Link>
        )}

        {/* Overdue stock-take notice */}
        {overdue?.overdue && (
          <Link to="/stock-take" className="no-print flex items-center gap-2 bg-rose-600 text-white px-4 sm:px-7 py-2.5 text-sm font-semibold hover:bg-rose-700">
            <Icon name="alert" className="w-4 h-4 shrink-0" />
            <span>Month-end stock take for {overdue.period} is overdue (due {overdue.due_date}). {overdue.counted}/{overdue.total} counted — complete it now →</span>
          </Link>
        )}

        <main className="p-4 sm:p-7 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

function titleFor(path) {
  if (path === '/') return 'Dashboard';
  if (path.startsWith('/ledger') || path.startsWith('/products')) return 'Stock Ledger';
  if (path.startsWith('/batteries')) return 'Battery Stock';
  if (path.startsWith('/machines')) return 'Machines & Consumption';
  if (path.startsWith('/projects')) return 'Projects & Sites';
  if (path.startsWith('/stock-take')) return 'Month-End Stock Take';
  if (path.startsWith('/trends')) return 'Trends & Forecast';
  if (path.startsWith('/mapping')) return 'Description Mapping';
  if (path.startsWith('/users')) return 'Users & Access';
  if (path.startsWith('/settings')) return 'Settings';
  if (path.startsWith('/report')) return 'Stock Book Report';
  return 'Oil Stock Book';
}
