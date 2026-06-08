import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, StatusBadge, Stat, Icon } from '../components/ui.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { qty, date, money, CATEGORY } from '../lib/format.js';

export default function ProductDetail() {
  const { id } = useParams();
  const { data: p, loading, error, reload } = useApi(`/products/${id}`);
  const { data: ledger, reload: reloadLedger } = useApi(`/products/${id}/ledger`);
  const { data: trend } = useApi(`/trends/monthly?productId=${id}&months=12`);
  const { data: settings } = useApi('/settings');
  const [reorder, setReorder] = useState('');
  const [price, setPrice] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { if (p) { setReorder(p.reorder_level ?? ''); setPrice(p.unit_price ?? ''); } }, [p]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  const sym = settings?.currency_symbol || 'Rs.';

  async function save() {
    await api.patch(`/products/${id}`, {
      reorder_level: reorder === '' ? null : Number(reorder),
      unit_price: price === '' ? null : Number(price),
    });
    reload();
  }
  const refresh = () => { reload(); reloadLedger(); };

  return (
    <div className="space-y-6">
      <Link to="/ledger" className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1"><Icon name="back" className="w-4 h-4" /> Back to ledger</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink">{p.name}</h1>
            <StatusBadge status={p.status || (p.low_stock ? 'critical' : 'ok')} />
          </div>
          <p className="text-slate-400 text-sm mt-1">{CATEGORY[p.category] || p.category} · measured in {p.unit}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/report/${id}`} className="btn-ghost"><Icon name="print" className="w-4 h-4" /> Print book</Link>
          <button className="btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" className="w-4 h-4" /> Movement</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="In stock" value={qty(p.balance, p.unit)} icon="oil" />
        <Stat label="Avg daily use" value={qty(p.avg_daily, p.unit)} sub="last 90 days" icon="trend" />
        <Stat label="Days of cover" value={p.days_left == null ? '—' : `${p.days_left} days`} accent="text-amber-600"
          sub={p.days_left != null ? `runs out ~${date(new Date(Date.now() + p.days_left * 86400000).toISOString().slice(0, 10))}` : 'no recent issues'} icon="alert" />
        <Stat label="Stock value" value={p.value == null ? '—' : money(p.value, sym)} sub={p.unit_price ? `${money(p.unit_price, sym)}/${p.unit}` : 'set a unit price'} icon="ledger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-bold text-ink mb-4">Monthly received vs issued</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend || []} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="issued" name="Issued" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-ink mb-4">Reorder &amp; pricing</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Reorder level ({p.unit})</label>
              <input type="number" className="input" value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="e.g. 50" />
              <p className="text-xs text-slate-400 mt-1">Alert when stock falls to or below this.</p>
            </div>
            <div>
              <label className="label">Unit price ({sym} per {p.unit})</label>
              <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="optional" />
              <p className="text-xs text-slate-400 mt-1">Enables stock valuation &amp; project cost.</p>
            </div>
            <button className="btn-primary w-full justify-center" onClick={save}>Save settings</button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-bold text-ink">Ledger ({ledger?.length || 0} entries)</h2></div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200">
              <th className="th">Date</th><th className="th">Description</th><th className="th text-right">Received</th>
              <th className="th text-right">Issued</th><th className="th text-right">Balance</th><th className="th">Remark</th>
            </tr></thead>
            <tbody>
              {ledger?.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="td whitespace-nowrap text-slate-500">{date(t.txn_date)}</td>
                  <td className="td">{t.consumer_label}</td>
                  <td className="td text-right tabular-nums text-emerald-600">{t.qty_received || ''}</td>
                  <td className="td text-right tabular-nums text-rose-600">{t.qty_issued || ''}</td>
                  <td className="td text-right tabular-nums font-semibold">{qty(t.balance_after, t.unit)}</td>
                  <td className="td text-xs text-slate-400">{t.remark || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} defaultProductId={Number(id)} onSaved={refresh} />}
    </div>
  );
}
