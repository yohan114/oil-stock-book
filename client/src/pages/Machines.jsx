import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon, Pill, Empty, Modal } from '../components/ui.jsx';
import { qty, date } from '../lib/format.js';

const SEV = {
  'very-high': 'bg-rose-600 text-white',
  high: 'bg-amber-100 text-amber-700',
  normal: 'bg-slate-100 text-slate-400',
};

export default function Machines() {
  const { data, loading, error, reload } = useApi('/consumption/by-asset?limit=1000');
  const { data: types } = useApi('/assets/types');
  const { data: pending, reload: reloadPending } = useApi('/assets?status=pending&limit=200');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [registering, setRegistering] = useState(null); // asset

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.filter((r) =>
      (!type || r.type === type) &&
      (!onlyAbnormal || r.abnormal) &&
      (!needle || `${r.ec_code} ${r.registration} ${r.brand} ${r.type}`.toLowerCase().includes(needle)));
  }, [data, q, type, onlyAbnormal]);

  const abnormalCount = data?.filter((r) => r.abnormal).length || 0;
  const refresh = () => { reload(); reloadPending(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Oil issued per machine. Outliers vs. same-type machines are flagged — a likely leak, fault, or mis-entry.</p>
        {abnormalCount > 0 && (
          <button onClick={() => setOnlyAbnormal((v) => !v)} className={`pill ${onlyAbnormal ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
            <Icon name="alert" className="w-4 h-4" /> {abnormalCount} abnormal {onlyAbnormal ? '(showing)' : ''}
          </button>
        )}
      </div>

      {/* New vehicles auto-added during issuing — admin completes registration */}
      {pending?.length > 0 && (
        <div className="card border-amber-300 bg-amber-50/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <span className="text-amber-600"><Icon name="alert" className="w-5 h-5" /></span>
            <h2 className="font-bold text-ink">New vehicles/machines to register ({pending.length})</h2>
          </div>
          <div className="divide-y divide-amber-100">
            {pending.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{a.ec_code || a.registration}</div>
                  <div className="text-xs text-slate-500">added {date(a.created_at?.slice(0, 10))} · needs brand, type &amp; details</div>
                </div>
                <button className="btn-primary py-1.5 shrink-0" onClick={() => setRegistering(a)}>Register</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="w-4 h-4" /></span>
          <input className="input pl-9 w-64" placeholder="Search E&C, registration, brand…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-52" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All machine types</option>
          {types?.map((t) => <option key={t.type} value={t.type}>{t.type} ({t.n})</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="th">Machine</th><th className="th">Type</th><th className="th">Brand</th>
                <th className="th text-right">Total issued</th><th className="th text-right">Oil (L)</th>
                <th className="th text-right">Type median</th><th className="th text-right">Issues</th>
                <th className="th">Last</th><th className="th">Usage</th>
              </tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={9}><Empty>No machines match.</Empty></td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${r.abnormal ? 'bg-rose-50/40' : ''}`}>
                    <td className="td"><Link to={`/machines/${r.id}`} className="font-semibold text-ink hover:text-brand-600">{r.ec_code || r.registration}</Link>
                      {r.ec_code && r.registration && <span className="text-xs text-slate-400 ml-2">{r.registration}</span>}
                      {r.status === 'pending' && <button onClick={() => setRegistering(r)} className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold hover:bg-amber-200">register</button>}</td>
                    <td className="td text-slate-500">{r.type}</td>
                    <td className="td text-slate-500">{r.brand}</td>
                    <td className="td text-right tabular-nums font-semibold">{qty(r.total_qty)}</td>
                    <td className="td text-right tabular-nums">{qty(r.oil_qty)}</td>
                    <td className="td text-right tabular-nums text-slate-400">{qty(r.type_median)}</td>
                    <td className="td text-right tabular-nums text-slate-400">{r.txn_count}</td>
                    <td className="td whitespace-nowrap text-slate-400 text-xs">{date(r.last_date)}</td>
                    <td className="td"><Pill className={SEV[r.severity] || SEV.normal}>{r.severity === 'normal' ? 'normal' : r.severity}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {registering && <RegisterForm asset={registering} onClose={() => setRegistering(null)} onSaved={refresh} />}
    </div>
  );
}

function RegisterForm({ asset, onClose, onSaved }) {
  const [form, setForm] = useState({
    ec_code: asset.ec_code || '', registration: asset.registration || '',
    brand: asset.brand || '', type: asset.type || '', model_no: asset.model_no || '',
    asset_class: asset.asset_class || 'plant',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!form.ec_code.trim() && !form.registration.trim()) return setErr('Enter an E&C code or registration');
    setBusy(true);
    try {
      await api.patch(`/assets/${asset.id}`, { ...form, status: 'registered' });
      onSaved?.(); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title="Register vehicle / machine" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">E&C code</label><input className="input" value={form.ec_code} onChange={set('ec_code')} /></div>
          <div><label className="label">Registration no.</label><input className="input" value={form.registration} onChange={set('registration')} /></div>
          <div><label className="label">Brand</label><input className="input" value={form.brand} onChange={set('brand')} placeholder="e.g. Komatsu, Tata" /></div>
          <div><label className="label">Type</label><input className="input" value={form.type} onChange={set('type')} placeholder="e.g. Excavator, Tipper" /></div>
          <div><label className="label">Model</label><input className="input" value={form.model_no} onChange={set('model_no')} /></div>
          <div>
            <label className="label">Class</label>
            <select className="input" value={form.asset_class} onChange={set('asset_class')}>
              <option value="plant">Plant / machine</option>
              <option value="vehicle">Vehicle</option>
            </select>
          </div>
        </div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save registration'}</button>
        </div>
      </form>
    </Modal>
  );
}
