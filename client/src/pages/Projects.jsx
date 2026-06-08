import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon, Empty } from '../components/ui.jsx';
import { qty, money, date, CHART_COLORS } from '../lib/format.js';

export default function Projects() {
  const { data, loading, error } = useApi('/consumption/by-project');
  const { data: settings } = useApi('/settings');
  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  const sym = settings?.currency_symbol || 'Rs.';
  const hasCost = data.some((d) => d.cost > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Oil issued to each project / site. Set unit prices on products to see cost allocation.</p>

      {!data.length ? <Empty>No project issues recorded.</Empty> : (
        <>
          <div className="card p-5">
            <h2 className="font-bold text-ink mb-4">Total oil issued by project</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} margin={{ left: -10, right: 10, bottom: 30 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-20} textAnchor="end" interval={0} height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Bar dataKey="total_qty" name="Issued" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-bold text-ink">Project breakdown</h2></div>
            <table className="w-full">
              <thead><tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="th">Project / Site</th><th className="th">Location</th>
                <th className="th text-right">Total issued</th>{hasCost && <th className="th text-right">Est. cost</th>}
                <th className="th text-right">Issues</th><th className="th">Last activity</th>
              </tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="td font-semibold text-ink">{p.name}</td>
                    <td className="td text-slate-500">{p.location || '—'}</td>
                    <td className="td text-right tabular-nums font-semibold">{qty(p.total_qty)}</td>
                    {hasCost && <td className="td text-right tabular-nums text-slate-600">{p.cost ? money(p.cost, sym) : '—'}</td>}
                    <td className="td text-right tabular-nums text-slate-400">{p.txn_count}</td>
                    <td className="td text-slate-400 text-xs whitespace-nowrap">{date(p.last_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
