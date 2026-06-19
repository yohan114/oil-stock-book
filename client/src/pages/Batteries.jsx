import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorMsg, Empty, Icon, Modal, Pill } from '../components/ui.jsx';
import { date } from '../lib/format.js';

/** Downscale a captured photo in the browser so uploads stay small on mobile data. */
function resizeImage(file, max = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const s = max / Math.max(width, height);
          width = Math.round(width * s); height = Math.round(height * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const ACTION_STYLE = {
  add: 'bg-emerald-100 text-emerald-700',
  transfer: 'bg-brand-100 text-brand-700',
  decommission: 'bg-rose-100 text-rose-700',
  edit: 'bg-amber-100 text-amber-700',
};

export default function Batteries() {
  const { user } = useAuth();
  const admin = user.role === 'admin';
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const [tab, setTab] = useState('register');
  const [search, setSearch] = useState('');
  const [nonce, setNonce] = useState(0);
  const [modal, setModal] = useState(null); // {type:'add'|'transfer'|'decommission'|'edit', battery}

  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const reg = useApi(tab === 'register' ? `/batteries${q}` : null, [search, nonce]);
  const hist = useApi(tab === 'history' ? `/batteries/history${q}` : null, [search, nonce]);
  const refresh = () => setNonce((n) => n + 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">One battery per vehicle (unique vehicle no. &amp; serial, with a photo). Dead/removed batteries are kept in the audit history.</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {[['register', 'Register'], ['history', 'Audit history']].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${tab === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          {/* Project managers, store keepers and admins may all add */}
          <button className="btn-primary" onClick={() => setModal({ type: 'add' })}><Icon name="plus" className="w-4 h-4" /> Add battery</button>
        </div>
      </div>

      <div className="relative max-w-md">
        <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="w-4 h-4" /></span>
        <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, serial or note…" />
      </div>

      {tab === 'register' ? (
        reg.loading ? <Spinner /> : reg.error ? <ErrorMsg error={reg.error} /> : !reg.data.length ? (
          <Empty>No active batteries.</Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reg.data.map((b) => (
              <div key={b.id} className="card overflow-hidden flex flex-col">
                <a href={b.photo_path} target="_blank" rel="noreferrer" className="block bg-slate-100 aspect-video overflow-hidden">
                  <img src={b.photo_path} alt={`Battery for ${b.vehicle_no}`} className="w-full h-full object-cover hover:scale-105 transition" loading="lazy" />
                </a>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-ink truncate">{b.vehicle_no}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Serial: <span className="font-medium text-slate-700">{b.serial_no}</span></div>
                    </div>
                    <span className="text-oil"><Icon name="battery" className="w-5 h-5" /></span>
                  </div>
                  {b.note && <p className="text-sm text-slate-600 mt-2">{b.note}</p>}
                  <div className="mt-auto pt-3 text-[11px] text-slate-400">{b.created_by_name || '—'} · {date(b.created_at?.slice(0, 10))}</div>
                  {staff && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                      <button onClick={() => setModal({ type: 'transfer', battery: b })} className="text-xs font-semibold text-brand-600 hover:underline">Transfer</button>
                      <button onClick={() => setModal({ type: 'decommission', battery: b })} className="text-xs font-semibold text-rose-600 hover:underline">Mark dead</button>
                      {admin && <button onClick={() => setModal({ type: 'edit', battery: b })} className="text-xs font-semibold text-amber-600 hover:underline">Edit</button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        hist.loading ? <Spinner /> : hist.error ? <ErrorMsg error={hist.error} /> : !hist.data.length ? (
          <Empty>No battery history yet.</Empty>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead><tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="th">When</th><th className="th">Action</th><th className="th">Serial</th>
                  <th className="th">Vehicle</th><th className="th">Reason / note</th><th className="th">By</th>
                </tr></thead>
                <tbody>
                  {hist.data.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50">
                      <td className="td whitespace-nowrap text-slate-500">{date(e.created_at?.slice(0, 10))}</td>
                      <td className="td"><Pill className={ACTION_STYLE[e.action]}>{e.action}</Pill></td>
                      <td className="td font-medium text-ink">{e.serial_no}</td>
                      <td className="td">{e.action === 'transfer' && e.from_vehicle_no ? <span className="text-slate-500">{e.from_vehicle_no} → <span className="text-ink font-medium">{e.vehicle_no}</span></span> : e.vehicle_no}</td>
                      <td className="td text-slate-500">{e.reason || '—'}</td>
                      <td className="td text-slate-400 text-xs">{e.user_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {modal?.type === 'add' && <BatteryForm onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'transfer' && <TransferForm battery={modal.battery} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'decommission' && <DecommissionForm battery={modal.battery} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.type === 'edit' && <EditForm battery={modal.battery} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

function useSubmit(fn, onSaved, onClose) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async (validate) => {
    setErr(null);
    const v = validate();
    if (v) return setErr(v);
    setBusy(true);
    try { await fn(); onSaved?.(); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return { busy, err, run };
}

function BatteryForm({ onClose, onSaved }) {
  const [vehicle, setVehicle] = useState('');
  const [serial, setSerial] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoErr, setPhotoErr] = useState(null);
  const { busy, err, run } = useSubmit(
    () => api.post('/batteries', { vehicle_no: vehicle.trim(), serial_no: serial.trim(), note: note || null, photo }),
    onSaved, onClose);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr(null);
    try { setPhoto(await resizeImage(file)); } catch (e2) { setPhotoErr(e2.message); }
  }

  return (
    <Modal title="Add battery" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => !vehicle.trim() ? 'Enter the vehicle number' : !serial.trim() ? 'Enter the battery serial number' : !photo ? 'A photo is required' : null); }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Vehicle number</label><input className="input" value={vehicle} autoFocus onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. WP ABC-1234" /></div>
          <div><label className="label">Battery serial number</label><input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. EXIDE-558821" /></div>
        </div>
        <div><label className="label">Note (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brand, Ah rating, fitted date…" /></div>
        <div>
          <label className="label">Photo (required)</label>
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Battery preview" className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-slate-50" />
              <button type="button" onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-white/90 rounded-full p-1 text-slate-600 hover:text-rose-600 shadow"><Icon name="close" className="w-4 h-4" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 text-slate-500">
              <Icon name="camera" className="w-7 h-7" /><span className="text-sm font-medium">Take / choose a photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
            </label>
          )}
          {photoErr && <div className="text-xs text-rose-600 mt-1">⚠ {photoErr}</div>}
        </div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <Buttons busy={busy} onClose={onClose} label="Save battery" />
      </form>
    </Modal>
  );
}

function TransferForm({ battery, onClose, onSaved }) {
  const [vehicle, setVehicle] = useState('');
  const [reason, setReason] = useState('');
  const { busy, err, run } = useSubmit(
    () => api.post(`/batteries/${battery.id}/transfer`, { vehicle_no: vehicle.trim(), reason: reason || null }),
    onSaved, onClose);
  return (
    <Modal title="Transfer battery" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => !vehicle.trim() ? 'Enter the new vehicle number' : null); }} className="space-y-4">
        <p className="text-sm text-slate-500">Move battery <b className="text-ink">{battery.serial_no}</b> from <b className="text-ink">{battery.vehicle_no}</b> to another vehicle. The move is recorded in the audit history.</p>
        <div><label className="label">New vehicle number</label><input className="input" value={vehicle} autoFocus onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. WP XYZ-5678" /></div>
        <div><label className="label">Reason (optional)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <Buttons busy={busy} onClose={onClose} label="Transfer" />
      </form>
    </Modal>
  );
}

function DecommissionForm({ battery, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const { busy, err, run } = useSubmit(
    () => api.post(`/batteries/${battery.id}/decommission`, { reason: reason || null }),
    onSaved, onClose);
  return (
    <Modal title="Mark battery dead / removed" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => null); }} className="space-y-4">
        <p className="text-sm text-slate-500">
          Battery <b className="text-ink">{battery.serial_no}</b> ({battery.vehicle_no}) will be removed from the active register, freeing the vehicle.
          The record stays in the <b>audit history</b> permanently.
        </p>
        <div><label className="label">Reason</label><input className="input" value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="e.g. dead cell, destroyed, vehicle sold" /></div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy ? 'Saving…' : 'Mark dead'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditForm({ battery, onClose, onSaved }) {
  const [vehicle, setVehicle] = useState(battery.vehicle_no);
  const [serial, setSerial] = useState(battery.serial_no);
  const [note, setNote] = useState(battery.note || '');
  const { busy, err, run } = useSubmit(
    () => api.patch(`/batteries/${battery.id}`, { vehicle_no: vehicle.trim(), serial_no: serial.trim(), note: note || null }),
    onSaved, onClose);
  return (
    <Modal title="Edit battery (admin)" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => !vehicle.trim() || !serial.trim() ? 'Vehicle and serial are required' : null); }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Vehicle number</label><input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></div>
          <div><label className="label">Serial number</label><input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
        </div>
        <div><label className="label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <Buttons busy={busy} onClose={onClose} label="Save changes" />
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
