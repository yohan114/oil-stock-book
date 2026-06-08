import { useState, useEffect } from 'react';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon } from '../components/ui.jsx';
import { qty } from '../lib/format.js';

const FIELDS = [
  ['company_name', 'Company name'], ['company_subtitle', 'Subtitle / workshop'],
  ['book_title', 'Book title'], ['store_keeper', 'Store keeper'],
  ['currency_symbol', 'Currency symbol'], ['low_stock_days', 'Low-stock warning (days)'],
  ['forecast_window_days', 'Forecast window (days)'],
];

export default function Settings() {
  const { data, loading, error } = useApi('/settings');
  const { data: products, reload } = useApi('/products');
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setForm(data); }, [data]);
  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;

  async function saveSettings() {
    await api.put('/settings', form);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  async function saveProduct(id, patch) { await api.patch(`/products/${id}`, patch); reload(); }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="card p-5">
        <h2 className="font-bold text-ink mb-4">Organisation &amp; preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map(([k, l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={saveSettings}>Save settings</button>
          {saved && <span className="text-emerald-600 text-sm">✓ Saved</span>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-bold text-ink">Products — reorder levels &amp; pricing</h2></div>
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="th">Product</th><th className="th">Unit</th><th className="th text-right">In stock</th>
            <th className="th w-36">Reorder level</th><th className="th w-36">Unit price</th>
          </tr></thead>
          <tbody>
            {products?.map((p) => <ProductRow key={p.id} p={p} onSave={saveProduct} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRow({ p, onSave }) {
  const [reorder, setReorder] = useState(p.reorder_level ?? '');
  const [price, setPrice] = useState(p.unit_price ?? '');
  const dirty = String(reorder) !== String(p.reorder_level ?? '') || String(price) !== String(p.unit_price ?? '');
  return (
    <tr className="border-b border-slate-50">
      <td className="td font-medium text-ink">{p.name}</td>
      <td className="td text-slate-400">{p.unit}</td>
      <td className="td text-right tabular-nums">{qty(p.balance, p.unit)}</td>
      <td className="td"><input type="number" className="input py-1" value={reorder} onChange={(e) => setReorder(e.target.value)} /></td>
      <td className="td">
        <div className="flex items-center gap-1">
          <input type="number" className="input py-1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" />
          {dirty && <button className="btn-primary py-1 px-2 text-xs shrink-0"
            onClick={() => onSave(p.id, { reorder_level: reorder === '' ? null : Number(reorder), unit_price: price === '' ? null : Number(price) })}>
            Save</button>}
        </div>
      </td>
    </tr>
  );
}
