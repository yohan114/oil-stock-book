import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useApi } from '../api.js';
import { Spinner, ErrorMsg, StatusBadge, Empty } from '../components/ui.jsx';
import { qty, date } from '../lib/format.js';

export default function Trends() {
  const { data: products } = useApi('/products');
  const [productId, setProductId] = useState('');
  const [metric, setMetric] = useState('asset');
  const { data: trend } = useApi(`/trends/monthly?months=12${productId ? `&productId=${productId}` : ''}`, [productId]);
  const { data: top } = useApi(`/trends/top-consumers?metric=${metric}&limit=12`, [metric]);
  const { data: forecast, loading } = useApi('/forecast');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink">Monthly trend</h2>
            <select className="input w-48" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">All products</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend || []} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip /><Legend />
              <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="issued" name="Issued" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink">Top consumers</h2>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {[['asset', 'Machines'], ['project', 'Projects']].map(([v, l]) => (
                <button key={v} onClick={() => setMetric(v)} className={`px-3 py-1 rounded-md text-sm font-medium ${metric === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top || []} layout="vertical" margin={{ left: 30, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip />
              <Bar dataKey="qty" name="Issued" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-bold text-ink">Run-out forecast</h2></div>
        {loading ? <Spinner /> : !forecast?.length ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="th">Product</th><th className="th text-right">Balance</th>
                <th className="th text-right">Avg daily use</th><th className="th text-right">Days left</th>
                <th className="th">Projected run-out</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {forecast.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="td"><Link to={`/products/${f.id}`} className="font-medium text-ink hover:text-brand-600">{f.name}</Link></td>
                    <td className="td text-right tabular-nums font-semibold">{qty(f.balance, f.unit)}</td>
                    <td className="td text-right tabular-nums text-slate-500">{qty(f.avg_daily, f.unit)}</td>
                    <td className="td text-right tabular-nums">{f.days_left == null ? '—' : `${f.days_left}d`}</td>
                    <td className="td text-slate-500">{f.run_out_date ? date(f.run_out_date) : '—'}</td>
                    <td className="td"><StatusBadge status={f.status} /></td>
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
