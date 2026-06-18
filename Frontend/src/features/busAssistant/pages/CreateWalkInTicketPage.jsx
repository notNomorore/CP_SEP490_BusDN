import React, { useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import { getBusAssistantText, translateBusAssistantError } from '../busAssistantI18n.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, Field, Panel, inputClass, money } from './shared.jsx';

const initialForm = {
  routeId: '',
  tripId: '',
  fromStopId: '',
  toStopId: '',
  passengerType: 'ADULT',
  passengerQuantity: 1,
  ticketType: 'SINGLE_RIDE',
  paymentMethod: 'CASH',
  amount: 0,
};

const CreateWalkInTicketPage = () => {
  const { language } = useLanguage();
  const { isDarkMode } = useTheme();
  const t = getBusAssistantText(language);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const totalAmount = useMemo(() => Number(form.amount) || 0, [form.amount]);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await busAssistantService.createWalkInTicket({
        ...form,
        passengerQuantity: Number(form.passengerQuantity),
        amount: Number(form.amount),
      });
      setResult(data);
      setForm(initialForm);
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not create walk-in ticket'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Panel title={t.createWalkInTicket}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Field label={t.routeId}><input className={inputClass} value={form.routeId} onChange={update('routeId')} /></Field>
          <Field label={t.tripId}><input className={inputClass} value={form.tripId} onChange={update('tripId')} /></Field>
          <Field label={t.fromStopId}><input className={inputClass} value={form.fromStopId} onChange={update('fromStopId')} /></Field>
          <Field label={t.toStopId}><input className={inputClass} value={form.toStopId} onChange={update('toStopId')} /></Field>
          <Field label={t.passengerType}>
            <select className={inputClass} value={form.passengerType} onChange={update('passengerType')}>
              <option value="ADULT">{t.adult}</option>
              <option value="STUDENT">{t.student}</option>
              <option value="CHILD">{t.child}</option>
              <option value="SENIOR">{t.senior}</option>
            </select>
          </Field>
          <Field label={t.passengerQuantity}>
            <input className={inputClass} type="number" min="1" value={form.passengerQuantity} onChange={update('passengerQuantity')} />
          </Field>
          <Field label={t.ticketType}>
            <select className={inputClass} value={form.ticketType} onChange={update('ticketType')}>
              <option value="SINGLE_RIDE">{t.singleRide}</option>
              <option value="DAY_PASS">{t.dayPass}</option>
              <option value="TRANSFER">{t.transfer}</option>
            </select>
          </Field>
          <Field label={t.paymentMethod}>
            <select className={inputClass} value={form.paymentMethod} onChange={update('paymentMethod')}>
              <option value="CASH">{t.cash}</option>
              <option value="QR">{t.qr}</option>
              <option value="E_WALLET">{t.eWallet}</option>
            </select>
          </Field>
          <Field label={t.amount}>
            <input className={inputClass} type="number" min="0" value={form.amount} onChange={update('amount')} />
          </Field>
          <div className="md:col-span-2">
            {error ? <Alert type="error">{error}</Alert> : null}
            {result ? <Alert type="success">{result.message}</Alert> : null}
          </div>
          <div className="md:col-span-2">
            <button className="inline-flex items-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" disabled={loading}>
              <PlusCircle size={16} />
              {loading ? t.creating : t.createTicket}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title={t.totalAmount}>
        <div className="space-y-4">
          <p className={isDarkMode ? 'text-4xl font-semibold text-white' : 'text-4xl font-semibold text-slate-950'}>{money(totalAmount)}</p>
          <div className={isDarkMode
            ? 'rounded border border-white/10 bg-white/5 p-3 text-sm text-slate-300'
            : 'rounded border border-emerald-100 bg-emerald-50/70 p-3 text-sm font-medium text-slate-700'}
          >
            <p>{t.passengers}: {Number(form.passengerQuantity) || 0}</p>
            <p>{t.payment}: {form.paymentMethod}</p>
            <p>{t.ticket}: {form.ticketType}</p>
          </div>
          {result ? (
            <div className={isDarkMode ? 'rounded border border-white/10 bg-white/5 p-3 text-sm' : 'rounded border border-slate-200 bg-white p-3 text-sm text-slate-800'}>
              <p className="font-medium">{result.ticketData?.ticketCode}</p>
              <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{result.transactionData?.transactionCode}</p>
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
};

export default CreateWalkInTicketPage;
