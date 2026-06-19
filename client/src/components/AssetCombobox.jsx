import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './ui.jsx';

const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Server-side typeahead over the fleet (412 assets never loaded at once).
 *  With `allowCreate`, an unknown vehicle/machine can be registered on the spot. */
export default function AssetCombobox({ value, onSelect, allowCreate = false, placeholder = 'Search E&C code or registration…' }) {
  const [q, setQ] = useState(value ? `${value.ec_code || ''}${value.registration ? ' / ' + value.registration : ''}` : '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open || q.trim().length < 1) { setResults([]); return; }
    let live = true;
    const t = setTimeout(() => {
      api.get(`/assets?search=${encodeURIComponent(q)}&limit=8`).then((r) => live && setResults(r)).catch(() => {});
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [q, open]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const exact = results.some((a) => norm(a.ec_code) === norm(q) || norm(a.registration) === norm(q));
  const showCreate = allowCreate && q.trim().length >= 2 && !exact && !creating;

  async function create() {
    setCreating(true);
    try {
      const asset = await api.post('/assets', { ec_code: q.trim() });
      onSelect(asset);
      setQ(`${asset.ec_code || ''}${asset.registration ? ' / ' + asset.registration : ''}`);
      setOpen(false);
    } catch (e) { alert(e.message); } finally { setCreating(false); }
  }

  return (
    <div className="relative" ref={box}>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="w-4 h-4" /></span>
        <input className="input pl-9" value={q} placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); onSelect(null); }}
          onFocus={() => setOpen(true)} />
      </div>
      {open && (results.length > 0 || showCreate) && (
        <div className="absolute z-20 mt-1 w-full card max-h-64 overflow-y-auto py-1">
          {results.map((a) => (
            <button key={a.id} type="button"
              className="w-full text-left px-3 py-2 hover:bg-brand-50 flex items-center justify-between"
              onClick={() => { onSelect(a); setQ(`${a.ec_code || ''}${a.registration ? ' / ' + a.registration : ''}`); setOpen(false); }}>
              <span>
                <span className="font-semibold text-sm text-ink">{a.ec_code || a.registration}</span>
                <span className="text-xs text-slate-400 ml-2">{a.registration && a.ec_code ? a.registration : ''}</span>
                {a.status === 'pending' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold">unregistered</span>}
              </span>
              <span className="text-[11px] text-slate-400">{[a.brand, a.type].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
          {showCreate && (
            <button type="button" onClick={create}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-t border-slate-100 flex items-center gap-2 text-emerald-700">
              <Icon name="plus" className="w-4 h-4" />
              <span className="text-sm font-semibold">Register new vehicle/machine “{q.trim()}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
