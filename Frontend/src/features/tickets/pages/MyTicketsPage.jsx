import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarDays, CreditCard, LoaderCircle, QrCode, Route, Search, Ticket } from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import ticketService from '../services/ticketService.js';

const formatDate = (value) => {
  if (!value) return 'Not available';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return 'Not available';
  }
};

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value || 0);

const statusClassName = (status) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'USED') return 'bg-blue-50 text-blue-700';
  if (status === 'EXPIRED') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-700';
};

const MyTicketsPage = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('PURCHASE_DESC');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTickets = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = await ticketService.getMyTickets();
        setTickets(payload.tickets || []);
      } catch (err) {
        setError(err.message || 'Unable to load ticket details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

  const routeOptions = useMemo(() => Array.from(new Set(
    tickets.map((ticket) => ticket.routeNumber).filter(Boolean)
  )).sort(), [tickets]);

  const ticketTypeOptions = useMemo(() => Array.from(new Set(
    tickets.map((ticket) => ticket.ticketType || 'ONE_WAY').filter(Boolean)
  )).sort(), [tickets]);

  const filterValidationError = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return 'Invalid filter criteria: start date must be before or equal to end date.';
    }
    return '';
  }, [dateFrom, dateTo]);

  const filteredTickets = useMemo(() => {
    if (filterValidationError) {
      return [];
    }

    return tickets.filter((ticket) => {
    const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
    const matchesType = ticketTypeFilter === 'ALL' || (ticket.ticketType || 'ONE_WAY') === ticketTypeFilter;
    const matchesRoute = routeFilter === 'ALL' || ticket.routeNumber === routeFilter;
    const travelDate = ticket.serviceDate ? new Date(ticket.serviceDate) : null;
    const matchesDateFrom = !dateFrom || (travelDate && travelDate >= new Date(dateFrom));
    const matchesDateTo = !dateTo || (travelDate && travelDate <= new Date(`${dateTo}T23:59:59`));
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || [
      ticket.ticketCode,
      ticket.routeNumber,
      ticket.tripInfo?.routeName,
      ticket.departureLocation,
      ticket.destinationLocation,
      ticket.seatNumber,
      ticket.paymentMethod,
      ticket.paymentStatus,
    ].some((value) => String(value || '').toLowerCase().includes(keyword));

    return matchesStatus && matchesType && matchesRoute && matchesDateFrom && matchesDateTo && matchesQuery;
    }).sort((left, right) => {
      const purchaseLeft = new Date(left.purchasedAt || 0).getTime();
      const purchaseRight = new Date(right.purchasedAt || 0).getTime();
      const travelLeft = new Date(left.serviceDate || 0).getTime();
      const travelRight = new Date(right.serviceDate || 0).getTime();
      const priceLeft = Number(left.ticketPrice || 0);
      const priceRight = Number(right.ticketPrice || 0);

      if (sortOption === 'PURCHASE_ASC') return purchaseLeft - purchaseRight;
      if (sortOption === 'TRAVEL_DESC') return travelRight - travelLeft;
      if (sortOption === 'TRAVEL_ASC') return travelLeft - travelRight;
      if (sortOption === 'PRICE_DESC') return priceRight - priceLeft;
      if (sortOption === 'PRICE_ASC') return priceLeft - priceRight;
      return purchaseRight - purchaseLeft;
    });
  }, [
    tickets,
    query,
    dateFrom,
    dateTo,
    ticketTypeFilter,
    routeFilter,
    statusFilter,
    sortOption,
    filterValidationError,
  ]);

  const resetFilters = () => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setTicketTypeFilter('ALL');
    setRouteFilter('ALL');
    setStatusFilter('ALL');
    setSortOption('PURCHASE_DESC');
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Passenger Activity</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Ticket History</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Review purchased tickets, payment status, route details, QR access, and travel history.
              </p>
            </div>
            <div className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
              {filteredTickets.length} / {tickets.length} tickets
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-y border-outline-variant/40 py-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(150px,0.7fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
              <Search className="h-5 w-5 text-outline" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ticket, route, stop, or seat..."
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
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="USED">Used</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
            <select
              value={ticketTypeFilter}
              onChange={(event) => setTicketTypeFilter(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
            >
              <option value="ALL">All ticket types</option>
              {ticketTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={routeFilter}
              onChange={(event) => setRouteFilter(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
            >
              <option value="ALL">All routes</option>
              {routeOptions.map((routeNumber) => (
                <option key={routeNumber} value={routeNumber}>{routeNumber}</option>
              ))}
            </select>
            <select
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
              className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary"
            >
              <option value="PURCHASE_DESC">Newest purchase</option>
              <option value="PURCHASE_ASC">Oldest purchase</option>
              <option value="TRAVEL_DESC">Latest travel date</option>
              <option value="TRAVEL_ASC">Earliest travel date</option>
              <option value="PRICE_DESC">Highest price</option>
              <option value="PRICE_ASC">Lowest price</option>
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm font-black text-primary hover:bg-surface"
            >
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
              Loading tickets...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : filteredTickets.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredTickets.map((ticket) => (
                <article
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/tickets/${ticket.id}`);
                    }
                  }}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface p-5 text-left transition hover:border-on-tertiary-container hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                          <Ticket className="h-3.5 w-3.5" />
                          {ticket.ticketType || 'ONE_WAY'}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <h2 className="mt-3 font-mono text-sm font-black text-primary">{ticket.ticketCode}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/tickets/${ticket.id}`);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-container"
                    >
                      <QrCode className="h-4 w-4" />
                      View QR Ticket
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Route className="h-3.5 w-3.5" />
                        Route
                      </p>
                      <p className="mt-1 font-bold text-primary">{ticket.routeNumber}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{ticket.tripInfo?.routeName || 'Route information'}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Travel
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(ticket.serviceDate)} at {ticket.departureTime}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">From</p>
                      <p className="mt-1 font-bold text-primary">{ticket.departureLocation}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">To</p>
                      <p className="mt-1 font-bold text-primary">{ticket.destinationLocation}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Seat</p>
                      <p className="mt-1 font-bold text-primary">{ticket.seatNumber}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CreditCard className="h-3.5 w-3.5" />
                        Price
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatCurrency(ticket.ticketPrice)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Purchase Date</p>
                      <p className="mt-1 font-bold text-primary">{formatDate(ticket.purchasedAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Payment Status</p>
                      <p className="mt-1 font-bold text-primary">{ticket.paymentStatus}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-12 text-center text-on-surface-variant">
              Ticket information is unavailable.
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MyTicketsPage;
