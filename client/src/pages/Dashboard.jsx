import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Stat, Spinner, ErrorMsg, StatusBadge, Icon, Empty } from '../components/ui.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import ProductForm from '../components/ProductForm.jsx';
import ManagerDashboard from './ManagerDashboard.jsx';
import { qty, fmt, money, CHART_COLORS } from '../lib/format.js';

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'manager' ? <ManagerDashboard /> : <StaffDashboard />;
}

function StaffDashboard() {
  const { user } = useAuth();
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const { data, error, loading, reload } = useApi('/dashboard/stock');
  const { data: alerts, reload: reloadAlerts } = useApi('/dashboard/alerts');
  const { data: top } = useApi('/trends/top-consumers?metric=asset&limit=6');
  const { data: trend } = useApi('/trends/monthly?months=9');
  const { data: settings } = useApi('/settings');
  const [showForm, setShowForm] = useState(false);
  const [showProduct, setShowProduct] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  const { products, totals } = data;
  const sym = settings?.currency_symbol || 'Rs.';
  const refresh = () => { reload(); reloadAlerts(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-500 text-sm">Live overview of fuel &amp; lubricant stock, alerts and consumption.</p>
        <div className="flex items-center gap-2">
          {staff && <button className="btn-ghost" onClick={() => setShowProduct(true)}><Icon name="plus" className="w-4 h-4" /> Add product</button>}
          {staff
            ? <button className="btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" className="w-4 h-4" /> Record movement</button>
            : <Link to="/requisitions" className="btn-primary"><Icon name="inbox" className="w-4 h-4" /> Request material</Link>}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon="oil" label="Products tracked" value={totals.products} sub={`${fmt(products.reduce((s, p) => s + p.balance, 0), 0)} units in stock`} />
        <Stat icon="alert" label="Need attention" value={totals.low_stock} accent="text-rose-600"
          sub="below reorder / running out" />
        <Stat icon="machine" label="Fleet machines" value={totals.assets} sub={`${totals.projects} active projects`} />
        <Stat icon="ledger" label="Transactions" value={fmt(totals.transactions, 0)} sub={totals.total_value ? money(totals.total_value, sym) + ' valued' : `${totals.unresolved_aliases} to map`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Stock table */}
        <div className="xl:col-span-2 card">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-ink">Stock levels</h2>
            <Link to="/ledger" className="text-xs font-semibold text-brand-600 hover:underline">Open ledger →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100">
                <th className="th">Product</th><th className="th text-right">Balance</th>
                <th className="th w-40">Level</th><th className="th text-right">30-day use</th>
                <th className="th text-right">Days left</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {products.map((p) => {
                  const pct = p.reorder_level ? Math.min(100, (p.balance / (p.reorder_level * 2)) * 100) : 50;
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="td"><Link to={`/products/${p.id}`} className="font-medium text-ink hover:text-brand-600">{p.name}</Link></td>
                      <td className="td text-right font-semibold tabular-nums">{qty(p.balance, p.unit)}</td>
                      <td className="td">
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${p.status === 'out' || p.status === 'critical' ? 'bg-rose-500' : p.status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(4, pct)}%` }} />
                        </div>
                      </td>
                      <td className="td text-right tabular-nums text-slate-500">{fmt(p.consumption30 ?? p.avg_daily * 30, 0)}</td>
                      <td className="td text-right tabular-nums">{p.days_left == null ? '—' : `${p.days_left}d`}</td>
                      <td className="td"><StatusBadge status={p.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <span className="text-rose-600"><Icon name="alert" className="w-5 h-5" /></span>
            <h2 className="font-bold text-ink">Reorder alerts</h2>
          </div>
          <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
            {!alerts?.length && <Empty>All stock levels healthy 🎉</Empty>}
            {alerts?.map((a) => (
              <Link key={a.id} to={`/products/${a.id}`} className="block p-3 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50/40">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-ink">{a.name}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500 flex justify-between">
                  <span>{qty(a.balance, a.unit)} left</span>
                  <span>{a.days_left == null ? 'no recent use' : `~${a.days_left} days`}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Trend + top consumers */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card p-5">
          <h2 className="font-bold text-ink mb-4">Consumption trend (all products)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend || []} margin={{ left: -18, right: 8, top: 5 }}>
              <defs>
                <linearGradient id="gIss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Area type="monotone" dataKey="received" name="Received" stroke="#10b981" fill="url(#gRec)" strokeWidth={2} />
              <Area type="monotone" dataKey="issued" name="Issued" stroke="#ef4444" fill="url(#gIss)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink">Top machines</h2>
            <Link to="/machines" className="text-xs font-semibold text-brand-600 hover:underline">All →</Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top || []} layout="vertical" margin={{ left: 20, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip />
              <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                {(top || []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} onSaved={refresh} />}
      {showProduct && <ProductForm onClose={() => setShowProduct(false)} onSaved={refresh} />}
    </div>
  );
}
