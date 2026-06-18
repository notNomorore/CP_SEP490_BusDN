import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import { getBusAssistantText, translateBusAssistantError } from '../busAssistantI18n.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, Field, Metric, Panel, inputClass, money } from './shared.jsx';

const RevenueSummaryPage = () => {
  const { language } = useLanguage();
  const { isDarkMode } = useTheme();
  const t = getBusAssistantText(language);
  const [shiftId, setShiftId] = useState('');
  const [revenue, setRevenue] = useState(null);
  const [form, setForm] = useState({ actualCollectedAmount: '', note: '', attachmentUrls: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const difference = useMemo(
    () => (Number(form.actualCollectedAmount) || 0) - (Number(revenue?.totalRevenue) || 0),
    [form.actualCollectedAmount, revenue]
  );

  const loadRevenue = useCallback(async () => {
    setError('');
    try {
      const response = await busAssistantService.getShiftRevenue({ shiftId });
      setRevenue(response);
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not load revenue summary'));
    }
  }, [shiftId, language]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await busAssistantService.submitRevenueSummary({
        shiftId,
        actualCollectedAmount: Number(form.actualCollectedAmount),
        note: form.note,
        attachmentUrls: form.attachmentUrls.split('\n').map((item) => item.trim()).filter(Boolean),
      });
      setSuccess(data.message);
      setRevenue((current) => ({ ...current, totalRevenue: data.systemAmount }));
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not submit revenue summary'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Panel title={t.revenueSummary}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label={t.shiftId}>
              <input className={inputClass} value={shiftId} onChange={(event) => setShiftId(event.target.value)} />
            </Field>
            <div className="flex items-end">
              <button
                className={isDarkMode
                  ? 'rounded bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15'
                  : 'rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600'}
                onClick={loadRevenue}
              >
                {t.load}
              </button>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label={t.systemAmount} value={money(revenue?.totalRevenue)} />
          <Metric label={t.cash} value={money(revenue?.cashCollected)} />
          <Metric label={t.ePayment} value={money(revenue?.ePaymentAmount)} />
          <Metric label={t.difference} value={money(difference)} />
        </div>

        <Panel title={t.breakdown}>
          <div className="grid gap-5 lg:grid-cols-2">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400"><tr><th className="py-2">{t.type}</th><th>{t.revenue}</th></tr></thead>
              <tbody>{(revenue?.revenueBreakdown || []).map((item) => <tr key={item.ticketType} className="border-t border-white/10"><td className="py-2">{item.ticketType}</td><td>{money(item.revenue)}</td></tr>)}</tbody>
            </table>
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400"><tr><th className="py-2">{t.payment}</th><th>{t.amount}</th></tr></thead>
              <tbody>{(revenue?.paymentMethodBreakdown || []).map((item) => <tr key={item.paymentMethod} className="border-t border-white/10"><td className="py-2">{item.paymentMethod}</td><td>{money(item.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title={t.submitSummary}>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.actualCollectedAmount}>
            <input className={inputClass} type="number" min="0" value={form.actualCollectedAmount} onChange={(event) => setForm((current) => ({ ...current, actualCollectedAmount: event.target.value }))} />
          </Field>
          <Field label={t.notes}>
            <textarea className={`${inputClass} min-h-[110px]`} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </Field>
          <Field label={t.attachmentUrls}>
            <textarea className={`${inputClass} min-h-[90px]`} value={form.attachmentUrls} onChange={(event) => setForm((current) => ({ ...current, attachmentUrls: event.target.value }))} />
          </Field>
          {error ? <Alert type="error">{error}</Alert> : null}
          {success ? <Alert type="success">{success}</Alert> : null}
          <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" disabled={loading}>
            <Send size={16} />
            {loading ? t.submitting : t.submitSummary}
          </button>
        </form>
      </Panel>
    </div>
  );
};

export default RevenueSummaryPage;
