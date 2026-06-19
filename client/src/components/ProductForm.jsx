import { useState } from 'react';
import { api, useApi } from '../api.js';
import { Modal } from './ui.jsx';
import { CATEGORY, UNITS } from '../lib/format.js';

/** Add a new stock item (oil, lubricant, filter, spare, consumable…). */
export default function ProductForm({ onClose, onSaved }) {
  const { data: settings } = useApi('/settings');
  const sym = settings?.currency_symbol || 'Rs.';
  const [name, setName] = useState('');
  const [category, setCategory] = useState('engine_oil');
  const [unit, setUnit] = useState('L');
  const [reorder, setReorder] = useState('');
  const [price, setPrice] = useState('');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr('Enter a product name');
    setBusy(true);
    try {
      await api.post('/products', {
        name: name.trim(), category, unit,
        reorder_level: reorder === '' ? null : Number(reorder),
        unit_price: price === '' ? null : Number(price),
        opening_qty: opening === '' ? 0 : Number(opening),
      });
      onSaved?.();
      onClose();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Add new product / material" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Name (brand &amp; model)</label>
          <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 15W40 (CI-04) Mobil Delvac" />
          <p className="text-[11px] text-slate-400 mt-1">Include the brand and grade so it is unique in the book.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" list="unit-list" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="unit-list">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Reorder level</label>
            <input type="number" step="0.01" min="0" className="input" value={reorder}
              onChange={(e) => setReorder(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className="label">Unit price ({sym})</label>
            <input type="number" step="0.01" min="0" className="input" value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className="label">Opening stock</label>
            <input type="number" step="0.01" min="0" className="input" value={opening}
              onChange={(e) => setOpening(e.target.value)} placeholder="0" />
          </div>
        </div>

        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button>
        </div>
      </form>
    </Modal>
  );
}
