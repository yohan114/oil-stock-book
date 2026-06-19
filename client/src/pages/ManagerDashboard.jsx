import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { Stat, Spinner, ErrorMsg, Empty, Icon, Pill } from '../components/ui.jsx';
import { qty, fmt, date } from '../lib/format.js';

const STATUS = {
  pending:   { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  sent:      { label: 'In transit', cls: 'bg-brand-100 text-brand-700' },
  received:  { label: 'Received', cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: 'Rejected', cls: 'bg-slate-200 text-slate-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

export default function ManagerDashboard() {
  const { data: reqs, loading, error } = useApi('/requisitions');
  const { data: summary } = useApi('/requisitions/summary');

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;

  // Lubricants delivered to this manager's site(s), by product.
  const byProduct = {};
  let totalReceived = 0;
  for (const r of reqs) {
    if (r.status === 'received' || r.status === 'sent') {
      const k = r.product_name;
      byProduct[k] ||= { product: r.product_name, unit: r.unit, received: 0, transit: 0 };
      if (r.status === 'received') { byProduct[k].received += r.qty_received || 0; totalReceived += r.qty_received || 0; }
      else byProduct[k].transit += r.qty_sent || 0;
    }
  }
  const products = Object.values(byProduct).sort((a, b) => (b.received + b.transit) - (a.received + a.transit));
  const recent = [...reqs].slice(0, 8);
  const pending = summary?.pending ?? 0;
  const awaiting = summary?.awaiting_receipt ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-500 text-sm">Lubricants requested for and delivered to your site.</p>
        <Link to="/requisitions" className="btn-primary"><Icon name="inbox" className="w-4 h-4" /> Request material</Link>
      </div>

      {awaiting > 0 && (
        <Link to="/requisitions" className="card flex items-center gap-3 px-5 py-3 border-brand-200 bg-brand-50/50 hover:bg-brand-50">
          <span className="text-brand-600"><Icon name="check" className="w-5 h-5" /></span>
          <span className="text-sm font-semibold text-ink">{awaiting} delivery{awaiting > 1 ? 'ies' : ''} awaiting your confirmation</span>
          <span className="ml-auto text-brand-600 text-sm font-semibold">Confirm receipt →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon="oil" label="Received (total)" value={qty(Math.round(totalReceived * 100) / 100)} sub={`${products.length} product${products.length === 1 ? '' : 's'}`} />
        <Stat icon="check" label="Awaiting receipt" value={awaiting} accent="text-brand-600" sub="sent — confirm arrival" />
        <Stat icon="inbox" label="Pending requests" value={pending} accent="text-amber-600" sub="waiting for store approval" />
        <Stat icon="ledger" label="Requisitions" value={reqs.length} sub="all time" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Lubricants at my site, by product */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200"><h2 className="font-bold text-ink">Lubricants issued to my site</h2></div>
          {!products.length ? <Empty>Nothing delivered yet. Use “Request material”.</Empty> : (
            <table className="w-full">
              <thead><tr className="border-b border-slate-100">
                <th className="th">Product</th><th className="th text-right">Received</th><th className="th text-right">In transit</th>
              </tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product} className="border-b border-slate-50">
                    <td className="td font-medium text-ink">{p.product}</td>
                    <td className="td text-right tabular-nums font-semibold">{p.received ? qty(Math.round(p.received * 100) / 100, p.unit) : '—'}</td>
                    <td className="td text-right tabular-nums text-brand-600">{p.transit ? qty(Math.round(p.transit * 100) / 100, p.unit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent activity */}
        <div className="xl:col-span-3 card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-ink">Recent requisitions</h2>
            <Link to="/requisitions" className="text-xs font-semibold text-brand-600 hover:underline">View all →</Link>
          </div>
          {!recent.length ? <Empty>No requisitions yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead><tr className="border-b border-slate-100">
                  <th className="th">Product</th><th className="th text-right">Qty</th><th className="th">Destination</th>
                  <th className="th">Status</th><th className="th">When</th>
                </tr></thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="td font-medium text-ink">{r.product_name}</td>
                      <td className="td text-right tabular-nums">{qty(r.qty_received ?? r.qty_sent ?? r.qty_requested, r.unit)}</td>
                      <td className="td text-slate-500">{r.project_name}{r.site_name && <span className="text-slate-400"> · {r.site_name}</span>}</td>
                      <td className="td"><Pill className={STATUS[r.status]?.cls}>{STATUS[r.status]?.label}</Pill>{r.discrepancy ? <Pill className="bg-rose-100 text-rose-700 ml-1">short/over</Pill> : null}</td>
                      <td className="td whitespace-nowrap text-slate-400 text-xs">{date((r.updated_at || r.created_at)?.slice(0, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
