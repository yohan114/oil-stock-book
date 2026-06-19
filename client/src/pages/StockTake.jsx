import { useEffect, useState } from 'react';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon, Stat } from '../components/ui.jsx';
import { qty, money, fmt, date } from '../lib/format.js';

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function StockTake() {
  const [period, setPeriod] = useState(thisMonth());
  const { data, loading, error, reload } = useApi(`/tally/status?period=${period}`, [period]);
  const { data: settings } = useApi('/settings');
  const sym = settings?.currency_symbol || 'Rs.';

  const [edits, setEdits] = useState({}); // product_id -> { counted, note }
  const [postAdjust, setPostAdjust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Seed inputs from saved counts whenever the period data loads.
  useEffect(() => {
    if (!data) return;
    const seed = {};
    for (const p of data.products) seed[p.product_id] = { counted: p.counted_qty ?? '', note: p.note ?? '' };
    setEdits(seed);
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;

  const rows = data.products.map((p) => {
    const e = edits[p.product_id] || { counted: '', note: '' };
    const counted = e.counted === '' ? null : Number(e.counted);
    const variance = counted == null ? null : Math.round((counted - p.book_qty) * 1000) / 1000;
    return { ...p, counted, variance, note: e.note };
  });
  const varianceValue = rows.reduce((s, r) => s + (r.variance && r.unit_price ? r.variance * r.unit_price : 0), 0);
  const countedCount = rows.filter((r) => r.counted != null).length;

  async function save() {
    setErr(null); setMsg(null); setBusy(true);
    try {
      const counts = rows.filter((r) => r.counted != null)
        .map((r) => ({ product_id: r.product_id, counted_qty: r.counted, note: r.note || null }));
      if (!counts.length) { setBusy(false); return setErr('Enter at least one physical count'); }
      const res = await api.post('/tally', { period, counts, post_adjustments: postAdjust });
      setMsg(`Saved ${counts.length} counts${res.adjusted ? `, posted ${res.adjusted} stock adjustments` : ''}.`);
      reload();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="label">Period (month)</label>
          <input type="month" className="input w-44" value={period} max={thisMonth()} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          {data.complete ? (
            <span className="pill bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed</span>
          ) : data.overdue ? (
            <span className="pill bg-rose-100 text-rose-700"><Icon name="alert" className="w-3.5 h-3.5" /> Overdue (was due {data.due_date})</span>
          ) : (
            <span className="pill bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending — due {data.due_date}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon="oil" label="Products" value={data.total} sub="active items" />
        <Stat icon="clipboard" label="Counted" value={`${countedCount}/${data.total}`} sub="physical counts entered" />
        <Stat icon="alert" label="Variance items" value={rows.filter((r) => r.variance != null && Math.abs(r.variance) > 0).length} accent="text-amber-600" sub="differ from book" />
        <Stat icon="trend" label="Variance value" value={money(Math.round(varianceValue * 100) / 100, sym)} accent={varianceValue < 0 ? 'text-rose-600' : 'text-emerald-600'} sub="counted − book" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-ink">Physical count vs book — {period}</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={postAdjust} onChange={(e) => setPostAdjust(e.target.checked)} className="rounded" />
            Post adjustments to correct stock
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="th">Product</th>
              <th className="th text-right">Book</th>
              <th className="th w-32 text-right">Counted</th>
              <th className="th text-right">Variance</th>
              <th className="th w-48">Note</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="border-b border-slate-50">
                  <td className="td font-medium text-ink">{r.name}
                    {r.adjusted && <span className="ml-2 pill bg-slate-100 text-slate-500">adjusted</span>}
                    {r.counted_by_name && <div className="text-[11px] text-slate-400 font-normal">by {r.counted_by_name} · {date(r.counted_at?.slice(0,10))}</div>}
                  </td>
                  <td className="td text-right tabular-nums text-slate-500">{qty(r.book_qty, r.unit)}</td>
                  <td className="td">
                    <input type="number" step="0.01" min="0" className="input py-1 text-right" value={edits[r.product_id]?.counted ?? ''}
                      onChange={(e) => setEdits({ ...edits, [r.product_id]: { ...edits[r.product_id], counted: e.target.value } })} placeholder="—" />
                  </td>
                  <td className={`td text-right tabular-nums font-semibold ${r.variance == null ? 'text-slate-300' : Math.abs(r.variance) < 1e-9 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {r.variance == null ? '—' : `${r.variance > 0 ? '+' : ''}${fmt(r.variance)}`}
                  </td>
                  <td className="td">
                    <input className="input py-1" value={edits[r.product_id]?.note ?? ''}
                      onChange={(e) => setEdits({ ...edits, [r.product_id]: { ...edits[r.product_id], note: e.target.value } })} placeholder="reason…" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
          {err && <span className="text-sm text-rose-600 mr-auto">⚠ {err}</span>}
          {msg && <span className="text-sm text-emerald-600 mr-auto">✓ {msg}</span>}
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save stock take'}</button>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Book balance is the system stock at the last day of the month. With “post adjustments” on, any difference is written back as a
        stock-take adjustment dated month-end so the book matches your physical count.
      </p>
    </div>
  );
}
