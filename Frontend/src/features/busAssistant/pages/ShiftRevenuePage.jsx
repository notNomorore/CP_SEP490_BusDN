import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, ReceiptText, RefreshCcw, TicketCheck, TrendingUp } from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import { getBusAssistantText, translateBusAssistantError } from '../busAssistantI18n.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, money } from './shared.jsx';

const labels = {
  vi: { subtitle: 'Theo dõi doanh thu và giao dịch theo ngày.', updated: 'Cập nhật gần nhất', ticketType: 'Vé trực tiếp', cash: 'Tiền mặt', qr: 'Chuyển khoản QR', completed: 'Hoàn tất', pending: 'Chờ thanh toán', empty: 'Chưa có dữ liệu trong ngày này.' },
  en: { subtitle: 'Track revenue and transactions by date.', updated: 'Last updated', ticketType: 'Walk-in ticket', cash: 'Cash', qr: 'QR transfer', completed: 'Completed', pending: 'Pending', empty: 'No data for this date.' },
};

const toDateInput = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const SummaryCard = ({ label, value, Icon, tone }) => (
  <article className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className={`absolute inset-x-0 top-0 h-1 ${tone}`} />
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-extrabold text-slate-950">{value}</p></div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon size={21} /></span>
    </div>
  </article>
);

const Section = ({ title, icon: Icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-emerald-100 px-5 py-4"><Icon size={18} className="text-emerald-700" /><h2 className="font-bold text-slate-950">{title}</h2></div>
    {children}
  </section>
);

const ShiftRevenuePage = () => {
  const { language } = useLanguage();
  const t = getBusAssistantText(language);
  const l = labels[language] || labels.vi;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => toDateInput());

  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return;
    setLoading(true); setError('');
    try {
      const response = await busAssistantService.getShiftRevenue({ date: selectedDate });
      setData(response); setUpdatedAt(new Date());
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not load shift revenue'));
    } finally { setLoading(false); }
  }, [language, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const paymentLabel = (value) => value === 'CASH' ? l.cash : ['QR', 'BANK_TRANSFER'].includes(value) ? l.qr : value;
  const statusLabel = (value) => value === 'COMPLETED' ? l.completed : value === 'PENDING' ? l.pending : value;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70 px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white"><TrendingUp size={21} /></span><div><h1 className="text-xl font-extrabold text-slate-950">{t.shiftRevenue}</h1><p className="mt-1 text-sm text-slate-500">{l.subtitle}</p></div></div>{updatedAt ? <p className="ml-13 mt-3 text-xs text-slate-400">{l.updated}: {updatedAt.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p> : null}</div>
        <div className="flex items-center gap-2">
          <input type="date" value={selectedDate} max={toDateInput()} onChange={(event) => setSelectedDate(event.target.value)} className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500" />
          <button type="button" onClick={load} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"><RefreshCcw className={loading ? 'animate-spin' : ''} size={16} />{loading ? t.loading : t.refresh}</button>
        </div>
      </header>
      {error ? <Alert type="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={t.ticketsSold} value={data?.totalTicketsSold ?? 0} Icon={TicketCheck} tone="bg-emerald-500" />
        <SummaryCard label={t.totalRevenue} value={money(data?.totalRevenue)} Icon={TrendingUp} tone="bg-teal-500" />
        <SummaryCard label={t.cashCollected} value={money(data?.cashCollected)} Icon={Banknote} tone="bg-amber-500" />
        <SummaryCard label={t.ePayment} value={money(data?.ePaymentAmount)} Icon={CreditCard} tone="bg-sky-500" />
      </div>

      <Section title={t.paymentMethodBreakdown} icon={CreditCard}>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">{t.method}</th><th className="px-5 py-3 text-center">{t.transactions}</th><th className="px-5 py-3 text-right">{t.amount}</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.paymentMethodBreakdown?.length ? data.paymentMethodBreakdown.map((item) => <tr key={item.paymentMethod} className="hover:bg-emerald-50/40"><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.paymentMethod === 'CASH' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>{paymentLabel(item.paymentMethod)}</span></td><td className="px-5 py-4 text-center">{item.transactions}</td><td className="px-5 py-4 text-right font-bold text-emerald-900">{money(item.amount)}</td></tr>) : <tr><td colSpan="3" className="px-5 py-10 text-center text-slate-500">{l.empty}</td></tr>}</tbody></table></div>
      </Section>

      <Section title={t.recentTransactions} icon={ReceiptText}>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">{t.code}</th><th className="px-5 py-3">{t.type}</th><th className="px-5 py-3">{t.payment}</th><th className="px-5 py-3 text-right">{t.amount}</th><th className="px-5 py-3 text-center">{t.status}</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.recentTransactions?.length ? data.recentTransactions.map((item) => <tr key={item._id} className="odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/50"><td className="px-5 py-4 font-mono text-xs font-bold text-emerald-900">{item.transactionCode}</td><td className="px-5 py-4">{item.ticketType === 'WALK_IN' ? l.ticketType : item.ticketType}</td><td className="px-5 py-4">{paymentLabel(item.paymentMethod)}</td><td className="px-5 py-4 text-right font-bold">{money(item.amount)}</td><td className="px-5 py-4 text-center"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{statusLabel(item.status)}</span></td></tr>) : <tr><td colSpan="5" className="px-5 py-12 text-center text-slate-500">{l.empty}</td></tr>}</tbody></table></div>
      </Section>
    </div>
  );
};

export default ShiftRevenuePage;
