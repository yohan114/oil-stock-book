import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './ui.jsx';

/** Server-side typeahead over the fleet (412 assets never loaded at once). */
export default function AssetCombobox({ value, onSelect, placeholder = 'Search E&C code or registration…' }) {
  const [q, setQ] = useState(value ? `${value.ec_code || ''}${value.registration ? ' / ' + value.registration : ''}` : '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative" ref={box}>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="w-4 h-4" /></span>
        <input className="input pl-9" value={q} placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); onSelect(null); }}
          onFocus={() => setOpen(true)} />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full card max-h-64 overflow-y-auto py-1">
          {results.map((a) => (
            <button key={a.id} type="button"
              className="w-full text-left px-3 py-2 hover:bg-brand-50 flex items-center justify-between"
              onClick={() => { onSelect(a); setQ(`${a.ec_code || ''}${a.registration ? ' / ' + a.registration : ''}`); setOpen(false); }}>
              <span>
                <span className="font-semibold text-sm text-ink">{a.ec_code || a.registration}</span>
                <span className="text-xs text-slate-400 ml-2">{a.registration && a.ec_code ? a.registration : ''}</span>
              </span>
              <span className="text-[11px] text-slate-400">{a.brand} · {a.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
