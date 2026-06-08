import { useParams, Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { Spinner, ErrorMsg, Stat, Icon, Empty } from '../components/ui.jsx';
import { qty, date } from '../lib/format.js';

const FIELDS = [
  ['brand', 'Brand'], ['type', 'Type'], ['model_no', 'Model'], ['registration', 'Registration'],
  ['capacity', 'Capacity'], ['yom', 'Year'], ['serial_no', 'Serial No.'], ['chassis_no', 'Chassis No.'],
  ['engine_no', 'Engine No.'], ['site', 'Site'],
];

export default function AssetDetail() {
  const { id } = useParams();
  const { data, loading, error } = useApi(`/assets/${id}`);
  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  const { asset, by_product, total, transactions } = data;

  return (
    <div className="space-y-6">
      <Link to="/machines" className="text-sm text-slate-400 hover:text-brand-600 inline-flex items-center gap-1"><Icon name="back" className="w-4 h-4" /> Back to machines</Link>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Icon name="machine" className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-ink">{asset.ec_code || asset.registration}</h1>
          <p className="text-slate-400 text-sm">{asset.brand} {asset.model_no} · {asset.type}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Lifetime oil issued" value={qty(total)} icon="oil" />
        <Stat label="Products used" value={by_product.length} icon="ledger" />
        <Stat label="Total issues" value={transactions.filter((t) => t.kind === 'issue').length} icon="trend" />
        <Stat label="Class" value={asset.asset_class === 'bike' ? 'Motorcycle' : 'Plant'} icon="machine" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h2 className="font-bold text-ink mb-3">Specifications</h2>
          <dl className="space-y-2">
            {FIELDS.filter(([k]) => asset[k]).map(([k, l]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-1.5">
                <dt className="text-slate-400">{l}</dt><dd className="font-medium text-slate-700 text-right">{asset[k]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-2 card p-5">
          <h2 className="font-bold text-ink mb-3">Consumption by product</h2>
          {!by_product.length ? <Empty>No oil issued to this machine yet.</Empty> : (
            <div className="space-y-2">
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
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-bold text-ink">Issue history</h2></div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200">
              <th className="th">Date</th><th className="th">Product</th><th className="th text-right">Issued</th><th className="th">MR / MTN</th>
            </tr></thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="td text-slate-500 whitespace-nowrap">{date(t.txn_date)}</td>
                  <td className="td">{t.product_name}</td>
                  <td className="td text-right tabular-nums text-rose-600 font-medium">{qty(t.qty_issued, t.unit)}</td>
                  <td className="td text-xs text-slate-400">{[t.mr_no, t.mtn_no].filter(Boolean).join(' / ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
