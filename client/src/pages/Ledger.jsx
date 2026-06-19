import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon, Pill, Empty } from '../components/ui.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { qty, date } from '../lib/format.js';

const KIND_STYLE = {
  issue: 'bg-rose-50 text-rose-600',
  receipt: 'bg-emerald-50 text-emerald-600',
  opening: 'bg-slate-100 text-slate-500',
  adjustment: 'bg-amber-50 text-amber-600',
};

export default function Ledger() {
  const { data: products } = useApi('/products');
  const [productId, setProductId] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams({ limit: '150' });
    if (productId) p.set('productId', productId);
    if (kind) p.set('kind', kind);
    if (q) p.set('q', q);
    return p.toString();
  }, [productId, kind, q]);

  const { data, error, loading, reload } = useApi(`/transactions?${queryStr}`);

  async function voidTxn(id) {
    if (!confirm('Void this transaction? Balances will be recalculated.')) return;
    try { await api.post(`/transactions/${id}/void`); reload(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-56" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input w-36" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>
            <option value="issue">Issues</option>
            <option value="receipt">Receipts</option>
            <option value="opening">Opening</option>
          </select>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="w-4 h-4" /></span>
            <input className="input pl-9 w-56" placeholder="Search description / MR" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" className="w-4 h-4" /> Record movement</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="th">Date</th><th className="th">Product</th><th className="th">Type</th>
                <th className="th">Consumer / Source</th><th className="th text-right">Received</th>
                <th className="th text-right">Issued</th><th className="th text-right">Balance</th>
                <th className="th">MR / MTN</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {!data?.rows?.length && <tr><td colSpan={9}><Empty>No transactions match the filters.</Empty></td></tr>}
                {data?.rows?.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60 group">
                    <td className="td whitespace-nowrap text-slate-500">{date(t.txn_date)}</td>
                    <td className="td"><Link to={`/products/${t.product_id}`} className="text-ink hover:text-brand-600 font-medium">{t.product_name}</Link></td>
                    <td className="td"><span className={`pill ${KIND_STYLE[t.kind]}`}>{t.kind}</span></td>
                    <td className="td">
                      {t.asset_id ? <Link to={`/machines/${t.asset_id}`} className="text-brand-700 hover:underline font-medium">{t.consumer_label}</Link>
                        : t.consumer_label}
                      {t.consumer_type === 'unknown' && <Pill className="ml-2 bg-amber-100 text-amber-700">unmapped</Pill>}
                    </td>
                    <td className="td text-right tabular-nums text-emerald-600 font-medium">{t.qty_received ? qty(t.qty_received) : ''}</td>
                    <td className="td text-right tabular-nums text-rose-600 font-medium">{t.qty_issued ? qty(t.qty_issued) : ''}</td>
                    <td className="td text-right tabular-nums font-semibold">{qty(t.balance_after, t.unit)}</td>
                    <td className="td text-xs text-slate-400 whitespace-nowrap">{[t.mr_no, t.mtn_no].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="td">
                      <button onClick={() => voidTxn(t.id)} title="Void"
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 transition"><Icon name="close" className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100">Showing {data.rows.length} of {data.total} transactions</div>}
      </div>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} defaultProductId={productId ? Number(productId) : undefined} onSaved={reload} />}
    </div>
  );
}
