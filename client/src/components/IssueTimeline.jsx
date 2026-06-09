import { Link } from 'react-router-dom';
import { qty, date } from '../lib/format.js';

const CAT_COLOR = {
  engine_oil: 'bg-blue-100 text-blue-700',
  hydraulic: 'bg-cyan-100 text-cyan-700',
  gear_oil: 'bg-violet-100 text-violet-700',
  grease: 'bg-amber-100 text-amber-700',
  fuel: 'bg-rose-100 text-rose-700',
  other: 'bg-slate-100 text-slate-600',
};

/** Group issues by issue date and render a modern vertical timeline. */
export default function IssueTimeline({ issues = [], showProject = false, emptyText = 'No issues yet.' }) {
  if (!issues.length) return <div className="text-center text-slate-400 text-sm py-12">{emptyText}</div>;

  const sorted = [...issues].sort((a, b) => (b.txn_date || '').localeCompare(a.txn_date || '') || b.id - a.id);
  const groups = [];
  for (const it of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.txn_date) last.items.push(it);
    else groups.push({ date: it.txn_date, items: [it] });
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
      <div className="space-y-6">
        {groups.map((g) => {
          const total = g.items.reduce((s, i) => s + (i.qty_issued || 0), 0);
          return (
            <div key={g.date} className="relative">
              <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-brand-600 ring-4 ring-brand-100" />
              <div className="flex items-baseline gap-3 mb-2">
                <h4 className="font-bold text-ink text-sm">{date(g.date)}</h4>
                <span className="text-xs text-slate-400">{g.items.length} issue{g.items.length > 1 ? 's' : ''} · {qty(total)}</span>
              </div>
              <div className="space-y-2">
                {g.items.map((it) => (
                  <div key={it.id} className="card px-4 py-2.5 flex items-center gap-3 hover:shadow-md transition">
                    <span className={`pill ${CAT_COLOR[it.category] || CAT_COLOR.other}`}>
                      <Link to={`/products/${it.product_id}`} className="hover:underline">{it.product_name}</Link>
                    </span>
                    <div className="flex-1 min-w-0">
                      {showProject && it.project_name && (
                        <Link to={`/projects/${it.project_id}`} className="text-sm font-semibold text-ink hover:text-brand-600">{it.project_name}</Link>
                      )}
                      {it.description && (!showProject || it.description !== it.project_name) && (
                        <span className={`text-xs text-slate-400 ${showProject ? 'ml-2' : ''}`}>{it.description}</span>
                      )}
                      {(it.mr_no || it.mtn_no) && (
                        <span className="text-[11px] text-slate-300 ml-2">MR {[it.mr_no, it.mtn_no].filter(Boolean).join(' / ')}</span>
                      )}
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-rose-600">{qty(it.qty_issued, it.unit)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
