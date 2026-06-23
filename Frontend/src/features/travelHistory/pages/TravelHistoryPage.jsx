import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  BusFront,
  CalendarDays,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  Route,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import travelHistoryService from '../services/travelHistoryService.js';

const formatDate = (value, pattern = 'dd MMM yyyy') => {
  if (!value) return 'Not available';
  try {
    return format(new Date(value), pattern);
  } catch {
    return 'Not available';
  }
};

const formatDuration = (minutes = 0) => {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes} min`;
};

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value || 0);

const formatStatus = (status) => String(status || 'COMPLETED').replace(/_/g, ' ');

const statusClassName = (status) => {
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700';
  if (status === 'INTERRUPTED') return 'bg-amber-50 text-amber-700';
  if (status === 'MISSED_TRIP') return 'bg-slate-200 text-slate-700';
  return 'bg-blue-50 text-blue-700';
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || 'Not available'}</span>
  </div>
);

const TravelDetailModal = ({ record, onClose }) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 px-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Travel Details</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">{record.routeNumber} trip</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{record.boardingStop} to {record.destinationStop}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-outline hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 px-6 py-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
              <Route className="h-5 w-5" />
              Trip Information
            </h3>
            <DetailRow label="Travel History ID" value={record.travelHistoryId} />
            <DetailRow label="Trip ID" value={record.tripId} />
            <DetailRow label="Route" value={`${record.routeNumber} - ${record.routeName}`} />
            <DetailRow label="Boarding Stop" value={record.boardingStop} />
            <DetailRow label="Destination Stop" value={record.destinationStop} />
            <DetailRow label="Travel Date" value={formatDate(record.travelDate)} />
            <DetailRow label="Boarding Time" value={formatDate(record.boardingTime, 'HH:mm dd MMM yyyy')} />
            <DetailRow label="Arrival Time" value={formatDate(record.arrivalTime, 'HH:mm dd MMM yyyy')} />
            <DetailRow label="Travel Duration" value={formatDuration(record.travelDurationMinutes)} />
            <DetailRow label="Travel Status" value={formatStatus(record.travelStatus)} />
          </div>

          <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-primary">
              <Ticket className="h-5 w-5" />
              Ticket Information
            </h3>
            <DetailRow label="Ticket Type" value={record.ticketType} />
            <DetailRow label="Ticket ID" value={record.ticketId || 'Partial record'} />
            <DetailRow label="Fare Amount" value={formatCurrency(record.fareAmount)} />
            <DetailRow label="Payment Method" value={record.paymentMethod} />
            <DetailRow label="Vehicle" value={record.vehicleLabel || 'Not assigned'} />
            <DetailRow label="Reference Status" value={record.detailStatus} />
          </div>
        </div>

        {!record.hasTicketReference ? (
          <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            Missing ticket or trip reference. Partial travel information is displayed.
          </div>
        ) : null}
      </section>
    </div>
  );
};

const TravelHistoryPage = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('DATE_DESC');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTravelHistory = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = await travelHistoryService.getTravelHistory();
        setRecords(payload.records || []);
        setSummary(payload.summary || null);
      } catch (err) {
        setError(err.message || 'Unable to load travel history. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTravelHistory();
  }, []);

  const routeOptions = useMemo(() => Array.from(new Set(
    records.map((record) => record.routeNumber).filter(Boolean)
  )).sort(), [records]);

  const filterValidationError = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return 'Invalid filter criteria: start date must be before or equal to end date.';
    }
    return '';
  }, [dateFrom, dateTo]);

  const filteredRecords = useMemo(() => {
    if (filterValidationError) return [];

    return records.filter((record) => {
      const travelDate = record.travelDate ? new Date(record.travelDate) : null;
      const matchesDateFrom = !dateFrom || (travelDate && travelDate >= new Date(dateFrom));
      const matchesDateTo = !dateTo || (travelDate && travelDate <= new Date(`${dateTo}T23:59:59`));
      const matchesRoute = routeFilter === 'ALL' || record.routeNumber === routeFilter;
      const matchesStatus = statusFilter === 'ALL' || record.travelStatus === statusFilter;
      const keyword = query.trim().toLowerCase();
      const matchesQuery = !keyword || [
        record.travelHistoryId,
        record.tripId,
        record.routeNumber,
        record.routeName,
        record.boardingStop,
        record.destinationStop,
        record.ticketId,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));

      return matchesDateFrom && matchesDateTo && matchesRoute && matchesStatus && matchesQuery;
    }).sort((left, right) => {
      const dateLeft = new Date(left.boardingTime || 0).getTime();
      const dateRight = new Date(right.boardingTime || 0).getTime();
      const fareLeft = Number(left.fareAmount || 0);
      const fareRight = Number(right.fareAmount || 0);
      const durationLeft = Number(left.travelDurationMinutes || 0);
      const durationRight = Number(right.travelDurationMinutes || 0);

      if (sortOption === 'DATE_ASC') return dateLeft - dateRight;
      if (sortOption === 'FARE_DESC') return fareRight - fareLeft;
      if (sortOption === 'FARE_ASC') return fareLeft - fareRight;
      if (sortOption === 'DURATION_DESC') return durationRight - durationLeft;
      if (sortOption === 'DURATION_ASC') return durationLeft - durationRight;
      return dateRight - dateLeft;
    });
  }, [records, query, dateFrom, dateTo, routeFilter, statusFilter, sortOption, filterValidationError]);

  const resetFilters = () => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setRouteFilter('ALL');
    setStatusFilter('ALL');
    setSortOption('DATE_DESC');
  };

  const statCards = [
    { label: 'Total records', value: summary?.totalTrips || 0, detail: 'Travel activities' },
    { label: 'Completed', value: summary?.statusCounts?.COMPLETED || 0, detail: 'Finished trips' },
    { label: 'Duration', value: formatDuration(summary?.totalDurationMinutes || 0), detail: 'Recorded travel time' },
    { label: 'Fare amount', value: formatCurrency(summary?.totalFare || 0), detail: 'Linked ticket fares' },
  ];

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Passenger Activity</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Travel History</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Review completed trips, route activity, linked tickets, fares, and travel usage records.
              </p>
            </div>
            <div className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
              {filteredRecords.length} / {records.length} records
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-[24px] border border-outline-variant/35 bg-surface px-5 py-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-outline">{card.label}</p>
                <p className="mt-3 text-2xl font-headline font-black text-primary">{card.value}</p>
                <p className="mt-2 text-sm text-on-surface-variant">{card.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 border-y border-outline-variant/40 py-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(150px,0.7fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
              <Search className="h-5 w-5 text-outline" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search trip, route, stop, or ticket..."
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-outline"
              />
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
              aria-label="Filter from travel date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
              aria-label="Filter to travel date"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="INTERRUPTED">Interrupted</option>
              <option value="MISSED_TRIP">Missed trip</option>
            </select>
            <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">All routes</option>
              {routeOptions.map((routeNumber) => (
                <option key={routeNumber} value={routeNumber}>{routeNumber}</option>
              ))}
            </select>
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="DATE_DESC">Newest travel</option>
              <option value="DATE_ASC">Oldest travel</option>
              <option value="FARE_DESC">Highest fare</option>
              <option value="FARE_ASC">Lowest fare</option>
              <option value="DURATION_DESC">Longest duration</option>
              <option value="DURATION_ASC">Shortest duration</option>
            </select>
            <button type="button" onClick={resetFilters} className="rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm font-black text-primary hover:bg-surface">
              Reset filters
            </button>
          </div>

          {filterValidationError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {filterValidationError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-primary">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading travel history...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : filteredRecords.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredRecords.map((record) => (
                <article
                  key={record.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecord(record)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRecord(record);
                    }
                  }}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface p-5 text-left transition hover:border-on-tertiary-container hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                          <BusFront className="h-3.5 w-3.5" />
                          {record.routeNumber}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(record.travelStatus)}`}>
                          {formatStatus(record.travelStatus)}
                        </span>
                      </div>
                      <h2 className="mt-3 font-mono text-sm font-black text-primary">{record.tripId}</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">{record.routeName}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-primary">
                      <ArrowUpDown className="h-4 w-4" />
                      Details
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <MapPin className="h-3.5 w-3.5" />
                        Boarding
                      </p>
                      <p className="mt-1 font-bold text-primary">{record.boardingStop}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Destination</p>
                      <p className="mt-1 font-bold text-primary">{record.destinationStop}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Travel Date
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(record.travelDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Clock3 className="h-3.5 w-3.5" />
                        Duration
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDuration(record.travelDurationMinutes)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Ticket className="h-3.5 w-3.5" />
                        Ticket
                      </p>
                      <p className="mt-1 font-bold text-primary">{record.ticketId || 'Partial record'}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CreditCard className="h-3.5 w-3.5" />
                        Fare
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatCurrency(record.fareAmount)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-12 text-center text-on-surface-variant">
              No travel records are found.
            </div>
          )}
        </section>
      </main>

      <TravelDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
};

export default TravelHistoryPage;
