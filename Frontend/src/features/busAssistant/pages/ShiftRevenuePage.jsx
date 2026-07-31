import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import { getBusAssistantText, translateBusAssistantError } from '../busAssistantI18n.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, Field, Metric, Panel, inputClass, money } from './shared.jsx';

const ShiftRevenuePage = () => {
  const { language } = useLanguage();
  const t = getBusAssistantText(language);
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ shiftId: '', routeId: '', date: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await busAssistantService.getShiftRevenue(filters);
      setData(response);
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not load shift revenue'));
    } finally {
      setLoading(false);
    }
  }, [filters, language]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Panel
        title={t.shiftRevenue}
        action={(
          <button className="inline-flex items-center gap-2 rounded bg-white/10 px-3 py-2 text-sm" onClick={load}>
            <RefreshCcw size={15} />
            {loading ? t.loading : t.refresh}
          </button>
        )}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={t.shiftId}><input className={inputClass} value={filters.shiftId} onChange={update('shiftId')} /></Field>
          <Field label={t.routeId}><input className={inputClass} value={filters.routeId} onChange={update('routeId')} /></Field>
          <Field label={t.date}><input className={inputClass} type="date" value={filters.date} onChange={update('date')} /></Field>
          <div className="flex items-end">
            <button className="w-full rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" onClick={load}>{t.apply}</button>
          </div>
        </div>
        {error ? <div className="mt-4"><Alert type="error">{error}</Alert></div> : null}
      </Panel>

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label={t.ticketsSold} value={data?.totalTicketsSold ?? 0} />
        <Metric label={t.totalRevenue} value={money(data?.totalRevenue)} />
        <Metric label={t.cashCollected} value={money(data?.cashCollected)} />
        <Metric label={t.ePayment} value={money(data?.ePaymentAmount)} />
        <Metric label={t.discount} value={money(data?.discountAmount)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t.revenueBreakdown}>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th className="py-2">{t.type}</th><th>{t.tickets}</th><th>{t.revenue}</th><th>{t.discount}</th></tr></thead>
            <tbody>
              {(data?.revenueBreakdown || []).map((item) => (
                <tr key={item.ticketType} className="border-t border-white/10">
                  <td className="py-2">{item.ticketType}</td><td>{item.tickets}</td><td>{money(item.revenue)}</td><td>{money(item.discountAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title={t.paymentMethodBreakdown}>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th className="py-2">{t.method}</th><th>{t.transactions}</th><th>{t.amount}</th></tr></thead>
            <tbody>
              {(data?.paymentMethodBreakdown || []).map((item) => (
                <tr key={item.paymentMethod} className="border-t border-white/10">
                  <td className="py-2">{item.paymentMethod}</td><td>{item.transactions}</td><td>{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel
        title={t.recentTransactions}
        action={<button className="inline-flex items-center gap-2 rounded bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950" onClick={() => navigate('/bus-assistant/revenue-summary')}><Send size={15} />{t.submitSummary}</button>}
      >
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400"><tr><th className="py-2">{t.code}</th><th>{t.type}</th><th>{t.payment}</th><th>{t.amount}</th><th>{t.status}</th></tr></thead>
          <tbody>
            {(data?.recentTransactions || []).map((item) => (
              <tr key={item._id} className="border-t border-white/10">
                <td className="py-2">{item.transactionCode}</td><td>{item.ticketType}</td><td>{item.paymentMethod}</td><td>{money(item.amount)}</td><td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
};

export default ShiftRevenuePage;
