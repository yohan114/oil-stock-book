import { useMemo, useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorMsg, Empty, Icon, Modal, Pill } from '../components/ui.jsx';
import { qty, date } from '../lib/format.js';

const STATUS = {
  pending:   { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  sent:      { label: 'In transit', cls: 'bg-brand-100 text-brand-700' },
  received:  { label: 'Received', cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: 'Rejected', cls: 'bg-slate-200 text-slate-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

export default function Requisitions() {
  const { user } = useAuth();
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState(null); // {type, req}
  const { data, loading, error, reload } = useApi('/requisitions');

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === 'open') return data.filter((r) => r.status === 'pending' || r.status === 'sent');
    if (filter === 'all') return data;
    return data.filter((r) => r.status === filter);
  }, [data, filter]);

  const canReceive = (r) => r.status === 'sent' && (user.role === 'admin' || user.role === 'manager');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {staff
            ? 'Approve site requests and dispatch lubricants. Stock leaves the store when you send; the site then confirms what was received.'
            : 'Request lubricants for your site and confirm what you receive.'}
        </p>
        <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
          <Icon name={staff ? 'send' : 'inbox'} className="w-4 h-4" /> {staff ? 'New dispatch' : 'Request material'}
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {[['open', 'Open'], ['received', 'Received'], ['rejected', 'Rejected'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${filter === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> : !rows.length ? (
        <Empty>No requisitions{filter === 'open' ? ' open right now' : ''}.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="th">Product</th><th className="th text-right">Qty</th>
                <th className="th">Destination</th><th className="th">Status</th>
                <th className="th">People</th><th className="th text-right">Action</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 align-top">
                    <td className="td font-medium text-ink">{r.product_name}
                      {r.note && <div className="text-[11px] text-slate-400 font-normal">“{r.note}”</div>}
                    </td>
                    <td className="td text-right tabular-nums whitespace-nowrap">
                      <QtyCell r={r} />
                    </td>
                    <td className="td">{r.project_name}{r.site_name && <span className="text-slate-400"> · {r.site_name}</span>}</td>
                    <td className="td">
                      <Pill className={STATUS[r.status]?.cls}>{STATUS[r.status]?.label}</Pill>
                      {r.discrepancy ? <Pill className="bg-rose-100 text-rose-700 ml-1">short/over</Pill> : null}
                      {r.status === 'rejected' && r.reject_reason && <div className="text-[11px] text-slate-400 mt-1">{r.reject_reason}</div>}
                    </td>
                    <td className="td text-[11px] text-slate-500 whitespace-nowrap">
                      {r.requested_by_name && <div>req: {r.requested_by_name}</div>}
                      {r.approved_by_name && <div>sent: {r.approved_by_name} · {date(r.sent_at?.slice(0,10))}</div>}
                      {r.received_by_name && <div>got: {r.received_by_name} · {date(r.received_at?.slice(0,10))}</div>}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      {r.status === 'pending' && staff && (
                        <div className="flex justify-end gap-2">
                          <button className="text-xs font-semibold text-emerald-600 hover:underline" onClick={() => setModal({ type: 'approve', req: r })}>Approve &amp; send</button>
                          <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setModal({ type: 'reject', req: r })}>Reject</button>
                        </div>
                      )}
                      {r.status === 'pending' && !staff && r.requested_by === user.id && (
                        <button className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => act(`/requisitions/${r.id}/cancel`, {}, reload)}>Cancel</button>
                      )}
                      {canReceive(r) && (
                        <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setModal({ type: 'receive', req: r })}>Confirm receipt</button>
                      )}
                      {r.status === 'sent' && staff && <span className="text-[11px] text-slate-400">awaiting site</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.type === 'create' && <CreateForm staff={staff} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.type === 'approve' && <ApproveForm req={modal.req} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.type === 'reject' && <RejectForm req={modal.req} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.type === 'receive' && <ReceiveForm req={modal.req} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  );
}

async function act(path, body, reload) {
  try { await api.post(path, body); reload(); } catch (e) { alert(e.message); }
}

function QtyCell({ r }) {
  if (r.status === 'received') return (
    <span>{qty(r.qty_received, r.unit)}{r.discrepancy ? <span className="text-rose-500"> / {qty(r.qty_sent, r.unit)} sent</span> : ''}</span>
  );
  if (r.status === 'sent') return <span>{qty(r.qty_sent, r.unit)}</span>;
  return <span>{qty(r.qty_requested, r.unit)}</span>;
}

function CreateForm({ staff, onClose, onSaved }) {
  const { data: products } = useApi('/products');
  const { data: projects } = useApi('/projects');
  const [productId, setProductId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const { data: sites } = useApi(projectId ? `/projects/${projectId}/sites` : null, [projectId]);
  const product = products?.find((p) => p.id === Number(productId));

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!productId) return setErr('Select a product');
    if (!projectId) return setErr('Select a project');
    if (!amount || Number(amount) <= 0) return setErr('Enter a quantity');
    if (staff && product && Number(amount) > product.balance) return setErr(`Only ${qty(product.balance, product.unit)} in stock`);
    setBusy(true);
    try {
      const payload = { product_id: Number(productId), project_id: Number(projectId), site_id: siteId ? Number(siteId) : null, note: note || null };
      if (staff) { payload.qty_sent = Number(amount); payload.send = true; }
      else payload.qty_requested = Number(amount);
      await api.post('/requisitions', payload);
      onSaved?.(); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title={staff ? 'New dispatch to a site' : 'Request material'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Product</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select…</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name} — {qty(p.balance, p.unit)} in main store</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity {product ? `(${product.unit})` : ''}</label>
            <input type="number" step="0.01" min="0" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {product && <p className="text-[11px] text-slate-400 mt-1">Main store: <b className="text-slate-600">{qty(product.balance, product.unit)}</b> available</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Project</label>
            <select className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(''); }}>
              <option value="">Select…</option>
              {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Site (optional)</label>
            <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!sites?.length}>
              <option value="">{sites?.length ? '— whole project —' : 'no sites'}</option>
              {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={staff ? 'delivery note…' : 'what it is needed for…'} />
        </div>
        {staff && <p className="text-xs text-slate-400">Sending now deducts stock immediately. The site manager will confirm the received quantity.</p>}
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <Buttons busy={busy} onClose={onClose} label={staff ? 'Send' : 'Submit request'} />
      </form>
    </Modal>
  );
}

function ApproveForm({ req, onClose, onSaved }) {
  const [sent, setSent] = useState(req.qty_requested ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function submit(e) {
    e.preventDefault(); setErr(null);
    if (!sent || Number(sent) <= 0) return setErr('Enter a quantity to send');
    setBusy(true);
    try { await api.post(`/requisitions/${req.id}/approve`, { qty_sent: Number(sent) }); onSaved?.(); onClose(); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }
  return (
    <Modal title="Approve & send" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">{req.product_name} → <b className="text-ink">{req.project_name}{req.site_name ? ` · ${req.site_name}` : ''}</b>. Requested {qty(req.qty_requested, req.unit)}. Sending deducts stock now.</p>
        <div><label className="label">Quantity to send ({req.unit})</label><input type="number" step="0.01" min="0" className="input" value={sent} autoFocus onChange={(e) => setSent(e.target.value)} /></div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}><Icon name="send" className="w-4 h-4" /> {busy ? 'Sending…' : 'Approve & send'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RejectForm({ req, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.post(`/requisitions/${req.id}/reject`, { reason: reason || null }); onSaved?.(); onClose(); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }
  return (
    <Modal title="Reject request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">{req.product_name} · {qty(req.qty_requested, req.unit)} for {req.project_name}.</p>
        <div><label className="label">Reason</label><input className="input" value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="e.g. out of stock, not approved" /></div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy ? 'Saving…' : 'Reject'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiveForm({ req, onClose, onSaved }) {
  const [got, setGot] = useState(req.qty_sent ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const short = got !== '' && Number(got) !== req.qty_sent;
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.post(`/requisitions/${req.id}/receive`, { qty_received: Number(got), note: note || null }); onSaved?.(); onClose(); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }
  return (
    <Modal title="Confirm receipt" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">{req.product_name} sent to <b className="text-ink">{req.project_name}{req.site_name ? ` · ${req.site_name}` : ''}</b>: <b className="text-ink">{qty(req.qty_sent, req.unit)}</b>. Confirm the quantity you actually received.</p>
        <div><label className="label">Quantity received ({req.unit})</label><input type="number" step="0.01" min="0" className="input" value={got} autoFocus onChange={(e) => setGot(e.target.value)} /></div>
        {short && <div className="text-xs text-amber-600">⚠ This differs from the {qty(req.qty_sent, req.unit)} sent — it will be flagged as a discrepancy.</div>}
        <div><label className="label">Note (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. one can short" /></div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}><Icon name="check" className="w-4 h-4" /> {busy ? 'Saving…' : 'Confirm received'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Buttons({ busy, onClose, label }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : label}</button>
    </div>
  );
}
