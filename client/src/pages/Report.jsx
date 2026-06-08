import { useParams, Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { Spinner, ErrorMsg, Icon } from '../components/ui.jsx';
import { date, fmt } from '../lib/format.js';

export default function Report() {
  const { id } = useParams();
  const { data: p, loading, error } = useApi(`/products/${id}`);
  const { data: ledger } = useApi(`/products/${id}/ledger`);
  const { data: settings } = useApi('/settings');

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white py-8 print:py-0">
      <div className="no-print max-w-[820px] mx-auto mb-4 flex justify-between items-center px-4">
        <Link to={`/products/${id}`} className="btn-ghost"><Icon name="back" className="w-4 h-4" /> Back</Link>
        <button className="btn-primary" onClick={() => window.print()}><Icon name="print" className="w-4 h-4" /> Print / Save PDF</button>
      </div>

      <div className="print-area bg-white max-w-[820px] mx-auto p-10 shadow-card print:shadow-none">
        <div className="text-center border-b-2 border-ink pb-3 mb-1">
          <h1 className="text-xl font-bold tracking-wide">{settings?.company_name || 'Edward & Christie (Pvt) Ltd'}</h1>
          <p className="text-sm text-slate-600">{settings?.company_subtitle || 'Central Work Shop - Badalgama'}</p>
          <p className="text-sm font-semibold mt-1">{settings?.book_title || 'Fuel & Lubricant Stock Book'}</p>
        </div>
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="text-lg font-bold">{p.name}</h2>
          <div className="text-sm text-slate-600">Unit: <b>{p.unit}</b> · Balance: <b>{fmt(p.balance)} {p.unit}</b></div>
        </div>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-100">
              {['Date', 'MR', 'MTN', 'Description', 'Received', 'Issued', 'Balance', 'Remark'].map((h) => (
                <th key={h} className="border border-slate-400 px-2 py-1 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger?.map((t) => (
              <tr key={t.id}>
                <td className="border border-slate-300 px-2 py-1 whitespace-nowrap">{date(t.txn_date)}</td>
                <td className="border border-slate-300 px-2 py-1">{t.mr_no || ''}</td>
                <td className="border border-slate-300 px-2 py-1">{t.mtn_no || ''}</td>
                <td className="border border-slate-300 px-2 py-1">{t.kind === 'opening' ? 'b/f' : t.consumer_label}</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{t.qty_received || ''}</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{t.qty_issued || ''}</td>
                <td className="border border-slate-300 px-2 py-1 text-right font-medium">{fmt(t.balance_after)}</td>
                <td className="border border-slate-300 px-2 py-1">{(t.remark || '').replace(/\[.*?\]/g, '')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between mt-12 text-sm">
          <div className="text-center">
            <div className="border-t border-ink w-48 pt-1">{settings?.store_keeper || 'Store Keeper'}</div>
            <div className="text-slate-500 text-xs">Store Keeper</div>
          </div>
          <div className="text-center">
            <div className="border-t border-ink w-48 pt-1">&nbsp;</div>
            <div className="text-slate-500 text-xs">Authorised Signature</div>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-6">Generated {new Date().toLocaleString()} · Oil Stock Book System</p>
      </div>
    </div>
  );
}
