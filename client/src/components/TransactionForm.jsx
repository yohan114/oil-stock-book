import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Modal } from './ui.jsx';
import AssetCombobox from './AssetCombobox.jsx';
import { qty } from '../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionForm({ onClose, onSaved, defaultProductId, defaultKind = 'issue' }) {
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const { data: products } = useApi('/products');
  const { data: projects } = useApi('/projects');
  const [kind, setKind] = useState(isManager ? 'issue' : defaultKind);
  const [productId, setProductId] = useState(defaultProductId || '');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState(isManager ? 'project' : 'machine'); // machine | project | other
  const [asset, setAsset] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [description, setDescription] = useState('');
  const [mr, setMr] = useState('');
  const [mtn, setMtn] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const product = products?.find((p) => p.id === Number(productId));
  const { data: sites } = useApi(projectId ? `/projects/${projectId}/sites` : null, [projectId]);
  const over = kind === 'issue' && product && amount && Number(amount) > product.balance;

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!productId) return setErr('Select a product');
    if (!amount || Number(amount) <= 0) return setErr('Enter a quantity greater than zero');
    if (over) return setErr(`Only ${qty(product.balance, product.unit)} in stock — you can issue at most that.`);
    if (isManager && !projectId) return setErr('Select one of your projects');

    setBusy(true);
    try {
      const payload = {
        product_id: Number(productId), txn_date: date, kind, qty: Number(amount),
        mr_no: mr || null, mtn_no: mtn || null, remark: remark || null,
      };
      if (kind === 'issue') {
        if (isManager) {
          payload.project_id = Number(projectId);
          if (siteId) payload.site_id = Number(siteId);
          if (asset) payload.asset_id = asset.id;
          payload.description = asset ? (asset.ec_code || asset.registration)
            : (description || projects.find((p) => p.id === Number(projectId))?.name);
        } else if (target === 'machine' && asset) {
          payload.asset_id = asset.id; payload.description = asset.ec_code || asset.registration;
        } else if (target === 'project' && projectId) {
          payload.project_id = Number(projectId);
          if (siteId) payload.site_id = Number(siteId);
          payload.description = projects.find((p) => p.id === Number(projectId))?.name;
        } else {
          payload.description = description;
        }
      } else {
        payload.description = description || 'Main Stores';
      }
      await api.post('/transactions', payload);
      onSaved?.();
      onClose();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={isManager ? 'Issue Stock' : 'Record Stock Movement'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {/* kind toggle — managers can only issue */}
        {!isManager && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            {['issue', 'receipt'].map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`py-2 rounded-md text-sm font-semibold capitalize transition ${
                  kind === k ? (k === 'issue' ? 'bg-rose-600 text-white shadow' : 'bg-emerald-600 text-white shadow') : 'text-slate-500'}`}>
                {k === 'issue' ? '↑ Issue (out)' : '↓ Receive (in)'}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Product</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select…</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {qty(p.balance, p.unit)} in stock</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Quantity {product ? `(${product.unit})` : ''}</label>
            <input type="number" step="0.01" min="0" max={kind === 'issue' && product ? product.balance : undefined}
              className={`input ${over ? 'border-rose-400 ring-2 ring-rose-200' : ''}`} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          {product && (
            <div className="flex items-end">
              <p className="text-xs text-slate-400">
                Current balance: <b className="text-slate-600">{qty(product.balance, product.unit)}</b>
                {kind === 'issue' && amount > 0 && (
                  <> → <b className={over ? 'text-rose-600' : 'text-emerald-600'}>{qty(product.balance - Number(amount), product.unit)}</b></>
                )}
              </p>
            </div>
          )}
        </div>
        {over && <div className="text-xs text-rose-600 -mt-2">⚠ You cannot issue more than the {qty(product.balance, product.unit)} in stock.</div>}

        {kind === 'issue' ? (
          isManager ? (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div>
                <label className="label">Project</label>
                <select className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(''); }}>
                  <option value="">Select your project…</option>
                  {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {projectId && sites?.length > 0 && (
                <div>
                  <label className="label">Site (optional)</label>
                  <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                    <option value="">— whole project —</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Vehicle / machine (optional)</label>
                <AssetCombobox value={asset} onSelect={setAsset} />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. routine service" />
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
                {[['machine', 'Machine'], ['project', 'Project / Site'], ['other', 'Other']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setTarget(v)}
                    className={`py-1.5 rounded-md text-sm font-medium transition ${target === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
                ))}
              </div>
              {target === 'machine' && (
                <div>
                  <label className="label">Issued to machine</label>
                  <AssetCombobox value={asset} onSelect={setAsset} allowCreate />
                  {asset?.status === 'pending' && (
                    <p className="mt-1 text-xs text-amber-600">🆕 New vehicle added — the admin will be asked to complete its registration.</p>
                  )}
                </div>
              )}
              {target === 'project' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Project / site</label>
                    <select className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(''); }}>
                      <option value="">Select…</option>
                      {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  {projectId && sites?.length > 0 && (
                    <div>
                      <label className="label">Site</label>
                      <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                        <option value="">— whole project —</option>
                        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {target === 'other' && (
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Lathe Machine, Service Team…" />
                </div>
              )}
            </div>
          )
        ) : (
          <div className="border-t border-slate-100 pt-3">
            <label className="label">Source / note</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Main Stores" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="label">MR No.</label><input className="input" value={mr} onChange={(e) => setMr(e.target.value)} /></div>
          <div><label className="label">MTN No.</label><input className="input" value={mtn} onChange={(e) => setMtn(e.target.value)} /></div>
          <div><label className="label">Remark</label><input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
        </div>

        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || over}>{busy ? 'Saving…' : 'Save movement'}</button>
        </div>
      </form>
    </Modal>
  );
}
