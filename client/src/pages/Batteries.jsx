import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorMsg, Empty, Icon, Modal } from '../components/ui.jsx';
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

export default function Batteries() {
  const { user } = useAuth();
  const staff = user.role === 'admin' || user.role === 'storekeeper';
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const { data, loading, error, reload } = useApi(`/batteries${search ? `?search=${encodeURIComponent(search)}` : ''}`, [search]);

  async function remove(b) {
    if (!confirm(`Remove battery record for ${b.vehicle_no}?`)) return;
    try { await api.del(`/batteries/${b.id}`); reload(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">One battery per vehicle. Vehicle number, serial number and a photo are recorded once each.</p>
        {staff && <button className="btn-primary" onClick={() => setShow(true)}><Icon name="plus" className="w-4 h-4" /> Add battery</button>}
      </div>

      <div className="relative max-w-md">
        <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="w-4 h-4" /></span>
        <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, serial or note…" />
      </div>

      {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> : !data.length ? (
        <Empty>No batteries recorded yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((b) => (
            <div key={b.id} className="card overflow-hidden flex flex-col">
              <a href={b.photo_path} target="_blank" rel="noreferrer" className="block bg-slate-100 aspect-video overflow-hidden">
                <img src={b.photo_path} alt={`Battery for ${b.vehicle_no}`} className="w-full h-full object-cover hover:scale-105 transition" loading="lazy" />
              </a>
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-ink truncate">{b.vehicle_no}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Serial: <span className="font-medium text-slate-700">{b.serial_no}</span></div>
                  </div>
                  <span className="text-oil"><Icon name="battery" className="w-5 h-5" /></span>
                </div>
                {b.note && <p className="text-sm text-slate-600 mt-2">{b.note}</p>}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{b.created_by_name || '—'} · {date(b.created_at?.slice(0, 10))}</span>
                  {staff && <button onClick={() => remove(b)} className="text-rose-500 hover:text-rose-700" title="Remove"><Icon name="trash" className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && <BatteryForm onClose={() => setShow(false)} onSaved={reload} resizeImage={resizeImage} />}
    </div>
  );
}

function BatteryForm({ onClose, onSaved, resizeImage }) {
  const [vehicle, setVehicle] = useState('');
  const [serial, setSerial] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null); // dataURL
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    try { setPhoto(await resizeImage(file)); }
    catch (e2) { setErr(e2.message); }
  }

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!vehicle.trim()) return setErr('Enter the vehicle number');
    if (!serial.trim()) return setErr('Enter the battery serial number');
    if (!photo) return setErr('A photo is required');
    setBusy(true);
    try {
      await api.post('/batteries', { vehicle_no: vehicle.trim(), serial_no: serial.trim(), note: note || null, photo });
      onSaved?.();
      onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title="Add battery" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Vehicle number</label>
            <input className="input" value={vehicle} autoFocus onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. WP ABC-1234" />
          </div>
          <div>
            <label className="label">Battery serial number</label>
            <input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. EXIDE-558821" />
          </div>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brand, Ah rating, fitted date…" />
        </div>

        <div>
          <label className="label">Photo (required)</label>
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Battery preview" className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-slate-50" />
              <button type="button" onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-white/90 rounded-full p-1 text-slate-600 hover:text-rose-600 shadow">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 text-slate-500">
              <Icon name="camera" className="w-7 h-7" />
              <span className="text-sm font-medium">Take / choose a photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
            </label>
          )}
        </div>

        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save battery'}</button>
        </div>
      </form>
    </Modal>
  );
}
