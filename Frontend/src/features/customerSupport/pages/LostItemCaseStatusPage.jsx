import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarDays,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import customerSupportService, { LOST_ITEM_CATEGORIES } from '../services/customerSupportService.js';

const formatDate = (value, pattern = 'dd MMM yyyy HH:mm') => {
  if (!value) return 'Not available';
  try {
    return format(new Date(value), pattern);
  } catch {
    return 'Not available';
  }
};

const getCategoryLabel = (value) => (
  LOST_ITEM_CATEGORIES.find((category) => category.value === value)?.label || value || 'Other Items'
);

const statusLabel = (status) => String(status || 'SUBMITTED').replace(/_/g, ' ');

const statusClassName = (status) => {
  if (status === 'SUBMITTED') return 'bg-blue-50 text-blue-700';
  if (status === 'UNDER_REVIEW') return 'bg-amber-50 text-amber-700';
  if (status === 'SEARCHING') return 'bg-purple-50 text-purple-700';
  if (status === 'ITEM_FOUND') return 'bg-emerald-50 text-emerald-700';
  if (status === 'RESOLVED') return 'bg-green-50 text-green-700';
  if (status === 'CLOSED') return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-700';
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-2 text-sm last:border-b-0">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-right font-bold text-primary">{value || 'Not available'}</span>
  </div>
);

const CaseDetailModal = ({ supportCase, onClose }) => {
  if (!supportCase) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 px-4">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Lost Item Case</p>
            <h2 className="mt-2 text-2xl font-headline font-black text-primary">{supportCase.caseId}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{supportCase.lostItem?.itemName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-outline hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="mb-3 text-lg font-black text-primary">Case Summary</h3>
              <DetailRow label="Lost Item Case ID" value={supportCase.caseId} />
              <DetailRow label="Item Name" value={supportCase.lostItem?.itemName} />
              <DetailRow label="Item Category" value={getCategoryLabel(supportCase.lostItem?.itemCategory)} />
              <DetailRow label="Submission Date" value={formatDate(supportCase.createdAt)} />
              <DetailRow label="Estimated Lost Date" value={formatDate(supportCase.lostItem?.lostAt)} />
              <DetailRow label="Route Information" value={supportCase.routeName} />
              <DetailRow label="Current Status" value={statusLabel(supportCase.currentCaseStatus)} />
              <DetailRow label="Recovery Status" value={supportCase.lostItem?.recoveryStatus} />
              <DetailRow label="Last Updated" value={formatDate(supportCase.lastUpdatedAt)} />
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="mb-3 text-lg font-black text-primary">Case Description</h3>
              <p className="text-sm leading-6 text-on-surface-variant">{supportCase.description}</p>
              <p className="mt-3 text-sm font-bold text-primary">
                Estimated location: {supportCase.lostItem?.lastSeenLocation || 'Not available'}
              </p>
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="mb-4 text-lg font-black text-primary">Status Update Timeline</h3>
              <div className="space-y-4">
                {(supportCase.timeline || []).map((item, index) => (
                  <div key={`${item.status}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-3 w-3 rounded-full bg-primary" />
                      {index < supportCase.timeline.length - 1 ? <span className="h-full min-h-10 w-px bg-outline-variant" /> : null}
                    </div>
                    <div>
                      <p className="font-bold text-primary">{item.label}</p>
                      <p className="text-sm text-on-surface-variant">{item.message}</p>
                      <p className="mt-1 text-xs font-bold text-outline">{formatDate(item.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
              <h3 className="text-lg font-black">Recovery Instructions</h3>
              <p className="mt-3 text-sm leading-6">
                {supportCase.collectionInstructions || 'No item recovery instructions are available yet.'}
              </p>
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
              <h3 className="text-lg font-black text-primary">Administrator Notes</h3>
              {(supportCase.administratorNotes || []).length ? (
                <div className="mt-4 space-y-3">
                  {supportCase.administratorNotes.map((note) => (
                    <div key={`${note.createdAt}-${note.message}`} className="rounded-2xl bg-white px-4 py-3 text-sm">
                      <p className="font-semibold text-primary">{note.message}</p>
                      <p className="mt-1 text-xs text-outline">{formatDate(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-on-surface-variant">No administrator responses yet.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

const LostItemCaseStatusPage = () => {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadCases = async ({ quiet = false } = {}) => {
    if (quiet) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const response = await customerSupportService.listMyLostItemCases();
      setCases(response.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load lost item case status. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const filterValidationError = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return 'Invalid filter criteria: start date must be before or equal to end date.';
    }
    return '';
  }, [dateFrom, dateTo]);

  const filteredCases = useMemo(() => {
    if (filterValidationError) return [];

    return cases.filter((supportCase) => {
      const keyword = query.trim().toLowerCase();
      const submittedAt = supportCase.createdAt ? new Date(supportCase.createdAt) : null;
      const matchesQuery = !keyword || [
        supportCase.caseId,
        supportCase.referenceNumber,
        supportCase.lostItem?.itemName,
        supportCase.lostItem?.itemCategory,
        supportCase.routeName,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === 'ALL' || supportCase.currentCaseStatus === statusFilter;
      const matchesDateFrom = !dateFrom || (submittedAt && submittedAt >= new Date(dateFrom));
      const matchesDateTo = !dateTo || (submittedAt && submittedAt <= new Date(`${dateTo}T23:59:59`));

      return matchesQuery && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [cases, query, statusFilter, dateFrom, dateTo, filterValidationError]);

  const handleOpenCase = async (supportCase) => {
    try {
      const response = await customerSupportService.getMyLostItemCase(supportCase.caseId);
      setSelectedCase(response.data);
    } catch (err) {
      setError(err.message || 'Lost item case details unavailable.');
    }
  };

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Customer Service</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">View Lost Item Case Status</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Track submitted lost item reports, recovery progress, administrator notes, and collection instructions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadCases({ quiet: true })}
              disabled={isRefreshing}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-container disabled:opacity-60"
            >
              {isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh Status
            </button>
          </div>

          <div className="mt-6 grid gap-3 border-y border-outline-variant/40 py-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(150px,0.7fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
              <Search className="h-5 w-5 text-outline" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search case ID, item, route..."
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-outline"
              />
            </label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-bold text-primary">
              <option value="ALL">All statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="SEARCHING">Searching</option>
              <option value="ITEM_FOUND">Item Found</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
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
              Loading lost item cases...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : filteredCases.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredCases.map((supportCase) => (
                <article
                  key={supportCase.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenCase(supportCase)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenCase(supportCase);
                    }
                  }}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface p-5 text-left transition hover:border-on-tertiary-container hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                          <PackageCheck className="h-3.5 w-3.5" />
                          {supportCase.caseId}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(supportCase.currentCaseStatus)}`}>
                          {statusLabel(supportCase.currentCaseStatus)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-black text-primary">{supportCase.lostItem?.itemName}</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">{getCategoryLabel(supportCase.lostItem?.itemCategory)}</p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primary">Details</span>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Submitted
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(supportCase.createdAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <Clock3 className="h-3.5 w-3.5" />
                        Last Updated
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatDate(supportCase.lastUpdatedAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-outline">Estimated Lost Date</p>
                      <p className="mt-1 font-bold text-primary">{formatDate(supportCase.lostItem?.lostAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-outline">
                        <MapPin className="h-3.5 w-3.5" />
                        Route
                      </p>
                      <p className="mt-1 font-bold text-primary">{supportCase.routeName || 'Not linked'}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-12 text-center text-on-surface-variant">
              No lost item case records are found.
            </div>
          )}
        </section>
      </main>

      <CaseDetailModal supportCase={selectedCase} onClose={() => setSelectedCase(null)} />
    </div>
  );
};

export default LostItemCaseStatusPage;
