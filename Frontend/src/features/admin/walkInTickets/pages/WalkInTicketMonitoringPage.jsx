import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import toast from '../../../../shared/utils/toast.js';
import {
  AlertTriangle,
  Banknote,
  Eye,
  LoaderCircle,
  ReceiptText,
  RefreshCcw,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import walkInTicketService from '../services/walkInTicketService.js';

const fieldClass =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';
const today = new Date();
const defaultFilters = {
  page: 1,
  limit: 10,
  routeId: '',
  busAssistantId: '',
  shiftId: '',
  startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
  endDate: format(today, 'yyyy-MM-dd'),
  paymentMethod: '',
};

const money = (value) => `${Number(value || 0).toLocaleString()} VND`;
const dateTime = (value) => {
  try {
    return value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : 'N/A';
  } catch {
    return 'N/A';
  }
};

const reconciliationClass = {
  MATCHED: 'bg-secondary-container text-on-secondary-container',
  MINOR_DIFFERENCE: 'bg-primary-fixed text-on-primary-fixed',
  MAJOR_DIFFERENCE: 'bg-error-container text-on-error-container',
};

const Metric = ({ label, value, icon: Icon, critical }) => (
  <div className={`rounded-[24px] border bg-white/85 p-5 shadow-sm ${critical ? 'border-error/30' : 'border-outline-variant/35'}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</p>
      <Icon className={`h-5 w-5 ${critical ? 'text-error' : 'text-on-tertiary-container'}`} />
    </div>
    <p className="mt-4 text-2xl font-headline font-extrabold text-primary">{value}</p>
  </div>
);

const TicketDetailModal = ({ ticket, loading, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8">
    <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Walk-in ticket detail</p>
          <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
            {ticket?.ticketCode || 'Loading ticket...'}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container"><X className="h-5 w-5" /></button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16 text-primary"><LoaderCircle className="mr-3 animate-spin" />Loading detail...</div>
      ) : (
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Ticket code', ticket?.ticketCode],
            ['Issued at', dateTime(ticket?.issuedAt || ticket?.createdAt)],
            ['Status', ticket?.status],
            ['Passengers', ticket?.passengerCount],
            ['Fare per passenger', money(ticket?.farePerPassenger)],
            ['Total amount', money(ticket?.totalAmount)],
            ['Collected amount', money(ticket?.collectedAmount)],
            ['Payment method', ticket?.payment?.paymentMethod || ticket?.paymentMethod],
            ['Payment status', ticket?.payment?.status || 'COMPLETED'],
            ['Route', ticket?.route?.name || ticket?.routeId || 'N/A'],
            ['Trip', ticket?.trip?._id || ticket?.tripId || 'N/A'],
            ['Shift', ticket?.shift?.shiftCode || ticket?.shiftId || 'N/A'],
            ['Bus assistant', ticket?.busAssistant?.fullName || 'Unknown'],
            ['Assistant email', ticket?.busAssistant?.email || 'N/A'],
            ['Notes', ticket?.notes || 'N/A'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[20px] bg-surface-container-low p-4">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-outline">{label}</dt>
              <dd className="mt-2 break-words text-sm font-semibold">{value ?? 'N/A'}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  </div>
);

const WalkInTicketMonitoringPage = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, ticketCount: 0, passengerCount: 0, totalRevenue: 0 });
  const [reconciliation, setReconciliation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsResponse, reconciliationResponse] = await Promise.all([
        walkInTicketService.getTickets(filters),
        walkInTicketService.reconcile(filters),
      ]);
      setTickets(ticketsResponse.data || []);
      setMeta(ticketsResponse.meta || {});
      setReconciliation(reconciliationResponse.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load walk-in ticket records');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  };

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = await walkInTicketService.getTicket(id);
      setDetail(response.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load ticket detail');
      setSelectedId('');
    } finally {
      setDetailLoading(false);
    }
  };

  const majorDifference = reconciliation?.reconciliationStatus === 'MAJOR_DIFFERENCE';

  return (
    <AdminPromotionShell
      title="Walk-in Ticket Monitoring"
      subtitle="Monitor on-board ticket sales, verify collected revenue, and investigate discrepancies by route, shift, and bus assistant."
      action={<button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"><RefreshCcw className="h-4 w-4" />Refresh</button>}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={filters.routeId} onChange={(e) => updateFilter('routeId', e.target.value)} className={fieldClass} placeholder="Route ObjectId" />
          <input value={filters.busAssistantId} onChange={(e) => updateFilter('busAssistantId', e.target.value)} className={fieldClass} placeholder="Bus Assistant ObjectId" />
          <input value={filters.shiftId} onChange={(e) => updateFilter('shiftId', e.target.value)} className={fieldClass} placeholder="Shift ObjectId" />
          <select value={filters.paymentMethod} onChange={(e) => updateFilter('paymentMethod', e.target.value)} className={fieldClass}>
            <option value="">All payment methods</option>
            {['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'WALLET'].map((method) => <option key={method}>{method}</option>)}
          </select>
          <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className={fieldClass} />
          <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className={fieldClass} />
        </div>
      </section>

      {majorDifference ? (
        <div className="mt-6 flex items-start gap-3 rounded-[24px] border border-error/30 bg-error-container p-5 text-on-error-container">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-bold">Major revenue discrepancy detected</p><p className="mt-1 text-sm">Difference: {money(reconciliation.discrepancyAmount)}. Review shift collection records immediately.</p></div>
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Tickets" value={meta.ticketCount || 0} icon={Ticket} />
        <Metric label="Passengers" value={meta.passengerCount || 0} icon={Users} />
        <Metric label="Ticket Revenue" value={money(meta.totalRevenue)} icon={ReceiptText} />
        <Metric label="Collected Revenue" value={money(reconciliation?.collectedRevenue)} icon={Banknote} />
        <Metric label="Discrepancy" value={money(reconciliation?.discrepancyAmount)} icon={AlertTriangle} critical={majorDifference} />
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85">
        <div className="border-b border-outline-variant/30 px-5 py-4"><h2 className="text-lg font-bold text-primary">Walk-in ticket records</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
              <tr>{['Issued', 'Ticket Code', 'Route', 'Bus Assistant', 'Shift', 'Passengers', 'Payment', 'Amount', 'Status', 'Detail'].map((heading) => <th key={heading} className="px-4 py-4">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? <tr><td colSpan="10" className="py-12 text-center">Loading walk-in records...</td></tr> : tickets.length ? tickets.map((ticketItem) => (
                <tr key={ticketItem._id} className="hover:bg-surface-container-low/70">
                  <td className="px-4 py-4">{dateTime(ticketItem.issuedAt)}</td>
                  <td className="px-4 py-4 font-bold text-primary">{ticketItem.ticketCode}</td>
                  <td className="px-4 py-4">{ticketItem.route?.name || ticketItem.routeId || 'N/A'}</td>
                  <td className="px-4 py-4">{ticketItem.busAssistant?.fullName || 'Unknown'}</td>
                  <td className="px-4 py-4">{ticketItem.shiftId || 'N/A'}</td>
                  <td className="px-4 py-4">{ticketItem.passengerCount}</td>
                  <td className="px-4 py-4">{ticketItem.paymentMethod}</td>
                  <td className="px-4 py-4">{money(ticketItem.totalAmount)}</td>
                  <td className="px-4 py-4">{ticketItem.status}</td>
                  <td className="px-4 py-4"><button type="button" onClick={() => openDetail(ticketItem._id)} className="rounded-full p-2 text-primary hover:bg-surface-container"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )) : <tr><td colSpan="10" className="py-12 text-center text-on-surface-variant">No completed walk-in tickets found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t px-5 py-4 text-sm">
          <span>Page {meta.page || 1} of {meta.totalPages || 1}</span>
          <div className="flex gap-2"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Previous</button><button disabled={filters.page >= meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-4 py-2 disabled:opacity-40">Next</button></div>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-outline-variant/35 bg-white/85 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-primary">Revenue reconciliation</h2><p className="mt-1 text-sm text-on-surface-variant">Expected vs collected revenue grouped by shift.</p></div>
          <span className={`rounded-full px-4 py-2 text-xs font-bold ${reconciliationClass[reconciliation?.reconciliationStatus] || reconciliationClass.MATCHED}`}>{reconciliation?.reconciliationStatus || 'MATCHED'}</span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
            <thead><tr>{['Shift', 'Tickets', 'Passengers', 'Expected', 'Collected', 'Discrepancy', 'Status'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-outline-variant/20">
              {reconciliation?.revenueSummary?.length ? reconciliation.revenueSummary.map((row) => (
                <tr key={row.shiftId}>
                  <td className="px-4 py-4 font-bold">{row.shiftId}</td><td className="px-4 py-4">{row.ticketCount}</td><td className="px-4 py-4">{row.passengerCount}</td><td className="px-4 py-4">{money(row.expectedRevenue)}</td><td className="px-4 py-4">{money(row.collectedRevenue)}</td><td className="px-4 py-4">{money(row.discrepancyAmount)}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${reconciliationClass[row.reconciliationStatus]}`}>{row.reconciliationStatus}</span></td>
                </tr>
              )) : <tr><td colSpan="7" className="py-10 text-center text-on-surface-variant">No reconciliation data.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId ? <TicketDetailModal ticket={detail} loading={detailLoading} onClose={() => { setSelectedId(''); setDetail(null); }} /> : null}
    </AdminPromotionShell>
  );
};

export default WalkInTicketMonitoringPage;
