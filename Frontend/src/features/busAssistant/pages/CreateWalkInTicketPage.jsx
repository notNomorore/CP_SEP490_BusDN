import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, LoaderCircle, QrCode, ReceiptText, RefreshCcw } from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import { translateBusAssistantError } from '../busAssistantI18n.js';
import scheduleOperationsService from '../../scheduleOperations/services/scheduleOperationsService.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, Field, inputClass, money } from './shared.jsx';

const initialForm = {
  routeId: '', tripId: '', fromStopId: '', toStopId: '', passengerType: 'ADULT',
  passengerQuantity: 1, ticketType: 'SINGLE_RIDE', paymentMethod: 'CASH', amount: 0, cashReceived: '',
};

const parseTripCodeStart = (tripCode) => {
  const match = String(tripCode || '').match(/-(\d{6})-(\d{4})(?:-|$)/);
  if (!match) return null;

  const [, dateToken, timeToken] = match;
  const date = new Date(
    2000 + Number(dateToken.slice(0, 2)),
    Number(dateToken.slice(2, 4)) - 1,
    Number(dateToken.slice(4, 6)),
    Number(timeToken.slice(0, 2)),
    Number(timeToken.slice(2, 4)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const getAssignedTripDates = (trip) => {
  const codedStart = parseTripCodeStart(trip?.tripCode);
  const rawStart = trip?.scheduledStart ? new Date(trip.scheduledStart) : null;
  const rawEnd = trip?.scheduledEnd ? new Date(trip.scheduledEnd) : null;
  const rawDuration = rawStart && rawEnd
    ? rawEnd.getTime() - rawStart.getTime()
    : NaN;

  if (codedStart) {
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 60 * 60 * 1000;
    return { start: codedStart, end: new Date(codedStart.getTime() + duration) };
  }

  return {
    start: rawStart && !Number.isNaN(rawStart.getTime()) ? rawStart : null,
    end: rawEnd && !Number.isNaN(rawEnd.getTime()) ? rawEnd : rawStart,
  };
};

const formatAssignedTripTime = (trip, language) => {
  const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const { start, end } = getAssignedTripDates(trip);
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  if (!startTime) return '';
  return endTime ? `${startTime} - ${endTime}` : startTime;
};

const getVietnamDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(value);

const isTripTodayAndUpcoming = (trip, now = new Date()) => {
  const { start: scheduledStart, end: scheduledEnd } = getAssignedTripDates(trip);
  if (!scheduledStart || !scheduledEnd) return false;

  return getVietnamDate(scheduledStart) === getVietnamDate(now) && scheduledEnd > now;
};

const text = {
  vi: {
    title: 'Bán vé tại xe', subtitle: 'Tạo vé nhanh cho hành khách chưa đặt trước.', trip: 'Chuyến được phân công',
    chooseTrip: 'Chọn chuyến', boarding: 'Điểm lên', dropping: 'Điểm xuống', passenger: 'Đối tượng', quantity: 'Số hành khách',
    adult: 'Người lớn', student: 'Học sinh / sinh viên', child: 'Trẻ em', senior: 'Người cao tuổi', payment: 'Phương thức thanh toán',
    cash: 'Tiền mặt', transfer: 'Chuyển khoản QR', createCash: 'Thu tiền và tạo vé', createQr: 'Tạo mã QR thanh toán',
    summary: 'Thông tin vé', total: 'Tổng tiền', autoFare: 'Giá vé được hệ thống tính theo tuyến và đối tượng hành khách.',
    noTrips: 'Không có chuyến phù hợp được phân công.', loading: 'Đang tải chuyến...', qrTitle: 'Mã QR cho hành khách',
    qrHint: 'Đưa mã này cho hành khách quét bằng điện thoại.', paid: 'Xác nhận đã nhận chuyển khoản', confirmed: 'Đã xác nhận thanh toán. Hành khách có thể lên xe.',
    newTicket: 'Tạo vé mới', ticketCode: 'Mã vé', pending: 'Chờ thanh toán', completed: 'Đã thanh toán', reload: 'Tải lại chuyến',
    cashReceived: 'Khách đưa', change: 'Tiền thối lại', insufficient: 'Số tiền khách đưa chưa đủ.', cashSuccess: 'Đã thu tiền và tạo vé thành công.',
    history: 'Lịch sử bán vé', historyHint: 'Xem lại các vé bạn đã bán theo ngày.', sold: 'Vé đã bán', revenue: 'Doanh thu', time: 'Thời gian', route: 'Tuyến', passengers: 'Số khách', status: 'Trạng thái', noHistory: 'Chưa có vé nào được bán trong ngày này.',
    action: 'Thao tác', payAgain: 'Thanh toán lại', resuming: 'Đang mở...',
  },
  en: {
    title: 'On-board ticket', subtitle: 'Quick ticket for passengers without a reservation.', trip: 'Assigned trip', chooseTrip: 'Select a trip',
    boarding: 'Boarding stop', dropping: 'Drop-off stop', passenger: 'Passenger type', quantity: 'Passengers', adult: 'Adult', student: 'Student', child: 'Child', senior: 'Senior',
    payment: 'Payment method', cash: 'Cash', transfer: 'Bank transfer QR', createCash: 'Collect cash and create ticket', createQr: 'Create payment QR',
    summary: 'Ticket summary', total: 'Total', autoFare: 'Fare is calculated by the system using the route and passenger type.', noTrips: 'No suitable assigned trips.',
    loading: 'Loading trips...', qrTitle: 'Passenger QR code', qrHint: 'Let the passenger scan this code with their phone.', paid: 'Confirm transfer received',
    confirmed: 'Payment confirmed. The passenger may board.', newTicket: 'Create another ticket', ticketCode: 'Ticket code', pending: 'Awaiting payment', completed: 'Paid', reload: 'Reload trips',
    cashReceived: 'Cash received', change: 'Change due', insufficient: 'The received amount is insufficient.', cashSuccess: 'Cash collected and ticket created successfully.',
    history: 'Ticket sales history', historyHint: 'Review tickets you sold by date.', sold: 'Tickets sold', revenue: 'Revenue', time: 'Time', route: 'Route', passengers: 'Passengers', status: 'Status', noHistory: 'No tickets were sold on this date.',
    action: 'Action', payAgain: 'Pay again', resuming: 'Opening...',
  },
};

const CreateWalkInTicketPage = () => {
  const { language } = useLanguage();
  const t = text[language] || text.vi;
  const [form, setForm] = useState(initialForm);
  const [assignments, setAssignments] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [historyDate, setHistoryDate] = useState(() => getVietnamDate());
  const [history, setHistory] = useState({ tickets: [], count: 0, totalRevenue: 0 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resumingId, setResumingId] = useState('');

  const selectedTrip = useMemo(() => assignments.find((item) => String(item.tripId) === form.tripId), [assignments, form.tripId]);
  const remainingSeats = Number(selectedTrip?.capacity?.remainingSeats ?? 25);
  const isTripFull = Boolean(selectedTrip?.capacity?.isFull) || remainingSeats <= 0;
  const stops = selectedTrip?.route?.stops || [];
  const calculatedFare = useMemo(() => {
    const fares = selectedTrip?.route?.fareConfig || {};
    const unitFare = form.passengerType === 'STUDENT' ? fares.studentFare
      : form.passengerType === 'CHILD' ? fares.childFare
        : fares.baseFare || selectedTrip?.route?.fare;
    return (Number(unitFare) || 0) * (Number(form.passengerQuantity) || 0);
  }, [form.passengerQuantity, form.passengerType, selectedTrip]);
  const totalAmount = result?.totalAmount ?? calculatedFare;
  const cashReceived = Number(form.cashReceived) || 0;
  const changeAmount = Math.max(cashReceived - calculatedFare, 0);
  const cashInsufficient = form.paymentMethod === 'CASH' && cashReceived < calculatedFare;

  const selectTrip = (tripId, source = assignments) => {
    const assignment = source.find((item) => String(item.tripId) === tripId);
    if (assignment?.capacity?.isFull) return;
    const routeStops = assignment?.route?.stops || [];
    setForm((current) => ({
      ...current,
      tripId,
      routeId: String(assignment?.route?.id || ''),
      fromStopId: String(routeStops[0]?.stationId || routeStops[0]?.id || ''),
      toStopId: String(routeStops.at(-1)?.stationId || routeStops.at(-1)?.id || ''),
      amount: 0,
    }));
  };

  const loadTrips = async ({ preserveSelection = false } = {}) => {
    setLoadingTrips(true);
    setError('');
    try {
      const payload = await scheduleOperationsService.getAssignedTrips();
      const available = (payload.trips || []).filter((item) => (
        !['COMPLETED', 'CANCELLED', 'DONE'].includes(String(item.tripStatus || '').toUpperCase())
        && isTripTodayAndUpcoming(item)
      ));
      setAssignments(available);
      const selectedStillAvailable = preserveSelection
        ? available.find((item) => String(item.tripId) === form.tripId && !item.capacity?.isFull)
        : null;
      const firstAvailable = selectedStillAvailable || available.find((item) => !item.capacity?.isFull);
      if (firstAvailable) selectTrip(String(firstAvailable.tripId), available);
      else setForm((current) => ({ ...current, tripId: '', routeId: '', fromStopId: '', toStopId: '' }));
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not load assigned trips'));
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => { loadTrips(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = async (date = historyDate) => {
    setLoadingHistory(true);
    try {
      const data = await busAssistantService.getWalkInTicketHistory({ date });
      setHistory(data);
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not load ticket history'));
    } finally { setLoadingHistory(false); }
  };

  useEffect(() => { loadHistory(historyDate); }, [historyDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.tripId || !form.fromStopId || !form.toStopId) return;
    if (isTripFull) {
      setError('Chuyến xe đã hết chỗ (25/25). Vui lòng chọn giờ khác.');
      return;
    }
    if (Number(form.passengerQuantity) > remainingSeats) {
      setError(`Chuyến xe chỉ còn ${remainingSeats} chỗ. Vui lòng giảm số hành khách hoặc chọn giờ khác.`);
      return;
    }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await busAssistantService.createWalkInTicket({
        ...form,
        passengerQuantity: Number(form.passengerQuantity),
        amount: calculatedFare,
        cashReceived: form.paymentMethod === 'CASH' ? cashReceived : undefined,
        changeAmount: form.paymentMethod === 'CASH' ? changeAmount : undefined,
      });
      setResult(data);
      await loadTrips({ preserveSelection: true });
      await loadHistory(historyDate);
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not create walk-in ticket'));
    } finally { setLoading(false); }
  };

  const confirmPayment = async () => {
    setLoading(true); setError('');
    try {
      await busAssistantService.confirmWalkInPayment(result.ticketData._id);
      setResult((current) => ({ ...current, requiresPaymentConfirmation: false, confirmed: true, ticketData: { ...current.ticketData, status: 'COMPLETED' } }));
      await loadHistory(historyDate);
    } catch (err) { setError(translateBusAssistantError(err, language, 'Could not confirm payment')); }
    finally { setLoading(false); }
  };

  const resumePayment = async (ticketId) => {
    setResumingId(ticketId); setError('');
    try {
      const data = await busAssistantService.resumeWalkInPayment(ticketId);
      if (data.paymentCompleted) {
        setResult({ ...data, confirmed: true });
        await loadHistory(historyDate);
      } else {
        setResult(data);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Could not resume payment'));
    } finally { setResumingId(''); }
  };

  return (
    <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-emerald-100 px-6 py-5">
          <div><h1 className="text-xl font-bold text-slate-950">{t.title}</h1><p className="mt-1 text-sm text-slate-500">{t.subtitle}</p></div>
          <button type="button" onClick={loadTrips} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800"><RefreshCcw size={16} />{t.reload}</button>
        </div>
        <form onSubmit={submit} className="grid gap-5 p-6 md:grid-cols-2">
          <Field label={t.trip}>
            <select className={inputClass} value={form.tripId} onChange={(event) => selectTrip(event.target.value)} disabled={loadingTrips}>
              <option value="">{loadingTrips ? t.loading : t.chooseTrip}</option>
              {assignments.map((item) => {
                const assignedTime = formatAssignedTripTime(item, language);
                return (
                  <option key={item.id} value={item.tripId} disabled={item.capacity?.isFull}>
                    {assignedTime ? `${assignedTime} · ` : ''}{item.tripCode} · {item.route?.routeNumber} · {item.route?.origin} → {item.route?.destination} · {item.capacity?.isFull ? 'HẾT CHỖ 25/25' : `Còn ${item.capacity?.remainingSeats ?? 25}/25 chỗ`}
                  </option>
                );
              })}
            </select>
          </Field>
          <div className={`grid min-h-[48px] grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-4 py-3 text-sm ${isTripFull ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>
            <strong className="whitespace-nowrap">{selectedTrip?.route?.routeNumber || '—'}</strong>
            <strong className="whitespace-nowrap text-center">{selectedTrip?.vehicle?.plateNumber || selectedTrip?.vehicle?.code || '—'}</strong>
            {selectedTrip ? <strong className="whitespace-nowrap text-right">{isTripFull ? 'Hết chỗ 25/25' : `Còn ${remainingSeats}/25 chỗ`}</strong> : null}
          </div>
          <Field label={t.boarding}><select className={inputClass} value={form.fromStopId} onChange={update('fromStopId')}>{stops.map((stop) => <option key={stop.stationId || stop.id} value={stop.stationId || stop.id}>{stop.stopName || stop.address}</option>)}</select></Field>
          <Field label={t.dropping}><select className={inputClass} value={form.toStopId} onChange={update('toStopId')}>{stops.map((stop) => <option key={stop.stationId || stop.id} value={stop.stationId || stop.id}>{stop.stopName || stop.address}</option>)}</select></Field>
          <Field label={t.passenger}><select className={inputClass} value={form.passengerType} onChange={update('passengerType')}><option value="ADULT">{t.adult}</option><option value="STUDENT">{t.student}</option><option value="CHILD">{t.child}</option><option value="SENIOR">{t.senior}</option></select></Field>
          <Field label={t.quantity}><input className={inputClass} type="number" min="1" max={Math.max(remainingSeats, 1)} value={form.passengerQuantity} onChange={update('passengerQuantity')} disabled={isTripFull} /></Field>
          <div className="md:col-span-2"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t.payment}</p><div className="grid gap-3 sm:grid-cols-2">{[['CASH', t.cash, Banknote], ['BANK_TRANSFER', t.transfer, QrCode]].map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setForm((current) => ({ ...current, paymentMethod: value }))} className={`flex items-center gap-3 rounded-xl border p-4 text-left font-semibold ${form.paymentMethod === value ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100' : 'border-slate-200'}`}><Icon size={20} />{label}</button>)}</div></div>
          {form.paymentMethod === 'CASH' ? <div className="md:col-span-2 grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:grid-cols-2">
            <Field label={t.cashReceived}><input className={inputClass} type="number" min="0" step="1000" value={form.cashReceived} onChange={update('cashReceived')} placeholder="0" /></Field>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.change}</p><p className={`mt-2 text-2xl font-extrabold ${cashInsufficient ? 'text-red-700' : 'text-emerald-800'}`}>{money(changeAmount)}</p>{cashInsufficient && form.cashReceived !== '' ? <p className="mt-1 text-xs font-semibold text-red-700">{t.insufficient}</p> : null}</div>
          </div> : null}
          {error ? <div className="md:col-span-2"><Alert type="error">{error}</Alert></div> : null}
          {!assignments.length && !loadingTrips ? <div className="md:col-span-2"><Alert type="error">{t.noTrips}</Alert></div> : null}
          <button disabled={loading || !form.tripId || !form.fromStopId || !form.toStopId || cashInsufficient || isTripFull || Number(form.passengerQuantity) > remainingSeats} className="md:col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 font-bold text-white disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={18} /> : form.paymentMethod === 'CASH' ? <Banknote size={18} /> : <QrCode size={18} />}{isTripFull ? 'Chuyến đã hết chỗ' : form.paymentMethod === 'CASH' ? t.createCash : t.createQr}</button>
        </form>
      </section>

      <aside className="h-fit rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2"><ReceiptText className="text-emerald-700" size={20} /><h2 className="font-bold text-slate-950">{result?.qrCodeImage ? t.qrTitle : t.summary}</h2></div>
        {result ? <div className="mt-5 text-center">
          {result.qrCodeImage ? <><img src={result.qrCodeImage} alt="QR" className="mx-auto w-full max-w-[280px] rounded-xl border bg-white p-3" /><p className="mt-3 text-sm text-slate-500">{t.qrHint}</p></> : result.paymentCompleted ? <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mx-auto h-10 w-10" /><p className="mt-3 font-bold">{t.confirmed}</p></div> : <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mx-auto h-10 w-10" /><p className="mt-3 font-bold">{t.cashSuccess}</p><div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm"><span>{t.cashReceived}<strong className="mt-1 block">{money(result.cashReceived)}</strong></span><span>{t.change}<strong className="mt-1 block">{money(result.changeAmount)}</strong></span></div></div>}
          <p className="mt-4 text-sm">{t.ticketCode}: <strong>{result.ticketData?.ticketCode}</strong></p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-950">{money(result.totalAmount)}</p>
          <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${result.requiresPaymentConfirmation ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{result.requiresPaymentConfirmation ? t.pending : t.completed}</span>
          {result.checkoutUrl ? <a href={result.checkoutUrl} target="_blank" rel="noreferrer" className="mt-4 block text-sm font-semibold text-emerald-700 underline">PayOS</a> : null}
          {result.requiresPaymentConfirmation ? <button type="button" disabled={loading} onClick={confirmPayment} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white"><CheckCircle2 size={18} />{t.paid}</button> : null}
          {result.confirmed ? <Alert type="success">{t.confirmed}</Alert> : null}
          <button type="button" onClick={() => { setResult(null); setForm((current) => ({ ...current, cashReceived: '' })); }} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold">{t.newTicket}</button>
        </div> : <div className="mt-5"><p className="text-4xl font-extrabold text-emerald-950">{money(totalAmount)}</p><p className="mt-3 text-sm leading-6 text-slate-500">{t.autoFare}</p><div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm"><p>{t.quantity}: <strong>{form.passengerQuantity}</strong></p><p className="mt-2">{t.payment}: <strong>{form.paymentMethod === 'CASH' ? t.cash : t.transfer}</strong></p></div></div>}
      </aside>
    </div>
    <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-emerald-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><CalendarDays className="text-emerald-700" size={20} /><h2 className="text-lg font-bold text-slate-950">{t.history}</h2></div><p className="mt-1 text-sm text-slate-500">{t.historyHint}</p></div>
        <div className="flex items-center gap-2"><input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={() => loadHistory()} className="rounded-xl border border-emerald-200 p-2 text-emerald-800"><RefreshCcw className={loadingHistory ? 'animate-spin' : ''} size={18} /></button></div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">{t.time}</th><th className="px-5 py-3">{t.ticketCode}</th><th className="px-5 py-3">{t.route}</th><th className="px-5 py-3">{t.passengers}</th><th className="px-5 py-3">{t.payment}</th><th className="px-5 py-3">{t.total}</th><th className="px-5 py-3">{t.status}</th><th className="px-5 py-3 text-right">{t.action}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{loadingHistory ? <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-500">{t.loading}</td></tr> : history.tickets?.length ? history.tickets.map((ticket) => <tr key={ticket._id} className="hover:bg-emerald-50/40"><td className="whitespace-nowrap px-5 py-4">{new Date(ticket.issuedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</td><td className="px-5 py-4 font-bold text-emerald-900">{ticket.ticketCode}</td><td className="px-5 py-4">{ticket.routeCode || ticket.routeName || '—'}</td><td className="px-5 py-4">{ticket.passengerCount}</td><td className="px-5 py-4">{ticket.paymentMethod === 'CASH' ? t.cash : t.transfer}</td><td className="whitespace-nowrap px-5 py-4 font-bold">{money(ticket.totalAmount)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${ticket.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : ticket.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{ticket.status === 'COMPLETED' ? t.completed : t.pending}</span></td><td className="px-5 py-4 text-right">{ticket.canResumePayment ? <button type="button" disabled={resumingId === ticket._id} onClick={() => resumePayment(ticket._id)} className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50"><QrCode size={14} />{resumingId === ticket._id ? t.resuming : t.payAgain}</button> : '—'}</td></tr>) : <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-500">{t.noHistory}</td></tr>}</tbody>
        </table>
      </div>
    </section>
    </div>
  );
};

export default CreateWalkInTicketPage;
