import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorMsg, Icon, Empty, Modal } from '../components/ui.jsx';
import IssueTimeline from '../components/IssueTimeline.jsx';
import { qty, date, CHART_COLORS } from '../lib/format.js';

export default function Projects() {
  const { user } = useAuth();
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const [view, setView] = useState('overview');
  const [showNew, setShowNew] = useState(false);
  const { data, loading, error, reload } = useApi('/projects');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Projects &amp; sites — totals, issue history, and the locations stock is sent to.</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {[['overview', 'Overview'], ['issues', 'All issues']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${view === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          {staff && <button className="btn-primary" onClick={() => setShowNew(true)}><Icon name="plus" className="w-4 h-4" /> New project</button>}
        </div>
      </div>

      {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> :
        view === 'overview' ? <Overview data={data} /> : <AllIssues projects={data} />}

      {showNew && <ProjectForm onClose={() => setShowNew(false)} onSaved={reload} />}
    </div>
  );
}

function Overview({ data }) {
  if (!data.length) return <Empty>No projects yet. Use “New project” to add one.</Empty>;
  const withIssues = data.filter((p) => p.total_qty > 0);
  const max = Math.max(...data.map((p) => p.total_qty), 1);
  return (
    <>
      {withIssues.length > 0 && (
        <div className="card p-5">
          <h2 className="font-bold text-ink mb-4">Total oil issued by project</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={withIssues} margin={{ left: -10, right: 10, bottom: 30 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-20} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="total_qty" name="Issued" radius={[4, 4, 0, 0]}>
                {withIssues.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((p, i) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card p-0 overflow-hidden hover:shadow-md transition group">
            <div className="h-1.5" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-bold text-ink group-hover:text-brand-600 truncate">{p.name}</h3>
                  <p className="text-xs text-slate-400">{p.location || 'Project / site'}</p>
                </div>
                <Icon name="project" className="w-5 h-5 text-slate-300 shrink-0" />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold text-ink tabular-nums">{qty(p.total_qty)}</div>
                  <div className="text-xs text-slate-400">{p.txn_count} issues</div>
                </div>
                <div className="h-12 w-20 flex items-end">
                  <div className="w-full bg-slate-100 rounded-md overflow-hidden h-2 self-center">
                    <div className="h-full rounded-md" style={{ width: `${Math.max(6, (p.total_qty / max) * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>{p.site_count || 0} site{p.site_count === 1 ? '' : 's'}</span>
                <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition">View →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function AllIssues({ projects }) {
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const q = useMemo(() => {
    const p = new URLSearchParams({ consumerType: 'project', limit: '1000' });
    if (projectId) p.set('projectId', projectId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p.toString();
  }, [projectId, from, to]);

  const { data, loading, error } = useApi(`/transactions?${q}`, [q]);
  const total = data?.rows?.reduce((s, r) => s + (r.qty_issued || 0), 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 card p-4">
        <div>
          <label className="label">Project</label>
          <select className="input w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label">From</label><input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {(projectId || from || to) && <button className="btn-ghost" onClick={() => { setProjectId(''); setFrom(''); setTo(''); }}>Clear</button>}
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Total issued</div>
          <div className="text-xl font-bold text-ink">{qty(total)} <span className="text-sm font-normal text-slate-400">· {data?.rows?.length || 0} issues</span></div>
        </div>
      </div>

      <div className="card p-5">
        {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> : (
          <IssueTimeline issues={data?.rows || []} showProject emptyText="No project issues match these filters." />
        )}
      </div>
    </div>
  );
}

function ProjectForm({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr('Enter a project name');
    setBusy(true);
    try {
      await api.post('/projects', { name: name.trim(), location: location || null });
      onSaved?.();
      onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Project name</label>
          <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Hambantota Port Project" />
        </div>
        <div>
          <label className="label">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hambantota" />
        </div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create project'}</button>
        </div>
      </form>
    </Modal>
  );
}
