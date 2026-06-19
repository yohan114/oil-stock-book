import { useState, useEffect } from 'react';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon } from '../components/ui.jsx';
import ProductForm from '../components/ProductForm.jsx';
import { qty, categoryLabel } from '../lib/format.js';

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
  const [showProduct, setShowProduct] = useState(false);

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
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-ink">Products &amp; materials — reorder levels &amp; pricing</h2>
          <button className="btn-primary py-1.5" onClick={() => setShowProduct(true)}><Icon name="plus" className="w-4 h-4" /> Add product</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="th">Product</th><th className="th">Category</th><th className="th">Unit</th><th className="th text-right">In stock</th>
              <th className="th w-36">Reorder level</th><th className="th w-36">Unit price</th>
            </tr></thead>
            <tbody>
              {products?.map((p) => <ProductRow key={p.id} p={p} onSave={saveProduct} />)}
            </tbody>
          </table>
        </div>
      </div>

      <ChangePassword />

      {showProduct && <ProductForm onClose={() => setShowProduct(false)} onSaved={reload} />}
    </div>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      await api.post('/auth/password', { current_password: cur, new_password: next });
      setMsg('Password changed.'); setCur(''); setNext('');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <h2 className="font-bold text-ink mb-4">Change my password</h2>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div><label className="label">Current password</label><input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div><label className="label">New password</label><input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} placeholder="min 6 characters" /></div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update'}</button>
          {msg && <span className="text-emerald-600 text-sm">✓ {msg}</span>}
          {err && <span className="text-rose-600 text-sm">⚠ {err}</span>}
        </div>
      </form>
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
      <td className="td text-slate-500 text-xs">{categoryLabel(p.category)}</td>
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
