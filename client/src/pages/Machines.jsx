import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon, Pill, Empty } from '../components/ui.jsx';
import { qty, date } from '../lib/format.js';

const SEV = {
  'very-high': 'bg-rose-600 text-white',
  high: 'bg-amber-100 text-amber-700',
  normal: 'bg-slate-100 text-slate-400',
};

export default function Machines() {
  const { data, loading, error } = useApi('/consumption/by-asset?limit=1000');
  const { data: types } = useApi('/assets/types');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.filter((r) =>
      (!type || r.type === type) &&
      (!onlyAbnormal || r.abnormal) &&
      (!needle || `${r.ec_code} ${r.registration} ${r.brand} ${r.type}`.toLowerCase().includes(needle)));
  }, [data, q, type, onlyAbnormal]);

  const abnormalCount = data?.filter((r) => r.abnormal).length || 0;

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
                      {r.ec_code && r.registration && <span className="text-xs text-slate-400 ml-2">{r.registration}</span>}</td>
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
    </div>
  );
}
