import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorMsg, Stat, Icon, Empty, Pill } from '../components/ui.jsx';
import IssueTimeline from '../components/IssueTimeline.jsx';
import { qty, money, date } from '../lib/format.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const { data, loading, error, reload } = useApi(`/projects/${id}`);
  const { data: settings } = useApi('/settings');

  const monthly = useMemo(() => {
    if (!data) return [];
    const m = {};
    for (const t of data.transactions) {
      const key = (t.txn_date || '').slice(0, 7);
      if (key) m[key] = (m[key] || 0) + (t.qty_issued || 0);
    }
    return Object.entries(m).sort().map(([month, issued]) => ({ month, issued: Math.round(issued * 100) / 100 }));
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  const { project, by_product, cost, transactions, sites = [] } = data;
  const sym = settings?.currency_symbol || 'Rs.';
  const totalOil = by_product.reduce((s, b) => s + b.qty, 0);
  const dates = transactions.map((t) => t.txn_date).filter(Boolean).sort();
  const range = dates.length ? `${date(dates[0])} → ${date(dates[dates.length - 1])}` : '—';

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1"><Icon name="back" className="w-4 h-4" /> Back to projects</Link>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center shadow"><Icon name="project" className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
          <p className="text-slate-400 text-sm">{project.location || 'Project / site'} · {range}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total oil issued" value={qty(totalOil)} icon="oil" />
        <Stat label="Estimated cost" value={cost ? money(cost, sym) : '—'} sub={cost ? '' : 'set unit prices'} icon="ledger" accent="text-emerald-600" />
        <Stat label="Total issues" value={transactions.length} icon="ledger" />
        <Stat label="Products used" value={by_product.length} icon="trend" accent="text-violet-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-bold text-ink mb-3">Oil by product</h2>
          {!by_product.length ? <Empty /> : (
            <div className="space-y-2.5">
              {by_product.map((b) => {
                const max = by_product[0].qty || 1;
                return (
                  <div key={b.product}>
                    <div className="flex justify-between text-sm mb-0.5"><span className="text-slate-600">{b.product}</span><span className="font-semibold tabular-nums">{qty(b.qty, b.unit)}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.qty / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="lg:col-span-3 card p-5">
          <h2 className="font-bold text-ink mb-3">Monthly issues</h2>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={monthly} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="issued" name="Issued" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Sites projectId={id} sites={sites} staff={staff} onChange={reload} />

      <div className="card p-5">
        <h2 className="font-bold text-ink mb-4">Issues by date</h2>
        <IssueTimeline issues={transactions} emptyText="No issues recorded for this project." />
      </div>
    </div>
  );
}

function Sites({ projectId, sites, staff, onChange }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function add(e) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return;
    setBusy(true);
    try { await api.post(`/projects/${projectId}/sites`, { name: name.trim() }); setName(''); onChange?.(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-ink">Sites</h2>
        <span className="text-xs text-slate-400">{sites.length} location{sites.length === 1 ? '' : 's'}</span>
      </div>
      {!sites.length ? <Empty>No sites added. Stock can still be issued to the whole project.</Empty> : (
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => <Pill key={s.id} className="bg-slate-100 text-slate-700"><Icon name="map" className="w-3.5 h-3.5" /> {s.name}</Pill>)}
        </div>
      )}
      {staff && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2">
          <input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a site / location…" />
          <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add site'}</button>
          {err && <span className="text-sm text-rose-600">⚠ {err}</span>}
        </form>
      )}
    </div>
  );
}
