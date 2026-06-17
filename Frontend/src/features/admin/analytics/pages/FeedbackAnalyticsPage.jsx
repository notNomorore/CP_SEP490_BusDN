import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  Eye,
  Frown,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCcw,
  Star,
  TrendingDown,
  X,
} from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import feedbackAnalyticsService from '../services/feedbackAnalyticsService.js';

const categories = [
  'punctuality',
  'driver_behavior',
  'bus_cleanliness',
  'safety',
  'overcrowding',
  'ticketing',
  'route_information',
  'app_experience',
  'other',
];

const groupOptions = ['day', 'week', 'month', 'route', 'driver', 'vehicle', 'category', 'sentiment'];
const today = new Date();

const defaultFilters = {
  from: format(subDays(today, 30), 'yyyy-MM-dd'),
  to: format(today, 'yyyy-MM-dd'),
  routeId: '',
  driverId: '',
  vehicleId: '',
  category: '',
  rating: '',
  groupBy: 'day',
};

const fieldClassName =
  'h-11 w-full rounded-lg border border-outline-variant/50 bg-white px-3 text-sm text-primary focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const labelize = (value) => String(value || 'N/A').replaceAll('_', ' ');
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatRating = (value) => Number(value || 0).toFixed(2);

const KpiCard = ({ icon: Icon, label, value, detail, tone }) => (
  <div className="rounded-xl border border-outline-variant/10 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <span className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    <p className="mt-4 text-3xl font-headline font-black text-primary">{value}</p>
    <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>
  </div>
);

const SentimentBadge = ({ sentiment }) => {
  const tone = {
    positive: 'bg-emerald-100 text-emerald-700',
    neutral: 'bg-amber-100 text-amber-800',
    negative: 'bg-red-100 text-red-700',
  }[sentiment] || 'bg-surface-container text-on-surface-variant';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${tone}`}>
      {sentiment || 'unknown'}
    </span>
  );
};

const DataList = ({ title, items, emptyText, renderItem }) => (
  <section className="rounded-xl border border-outline-variant/10 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-headline font-black text-primary">{title}</h2>
    <div className="mt-4 space-y-3">
      {items?.length ? items.map(renderItem) : (
        <p className="rounded-lg border border-dashed border-outline-variant/50 px-4 py-6 text-center text-sm text-on-surface-variant">
          {emptyText}
        </p>
      )}
    </div>
  </section>
);

const DetailDrawer = ({ detail, loading, onClose }) => (
  <div className="fixed inset-0 z-[90] flex justify-end">
    <button type="button" aria-label="Close feedback detail" onClick={onClose} className="absolute inset-0 bg-black/45" />
    <aside className="relative h-full w-full max-w-4xl overflow-y-auto bg-surface p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-on-tertiary-container">Feedback records</p>
          <h2 className="mt-1 text-2xl font-headline font-black text-primary">
            {detail?.groupBy ? `${labelize(detail.groupBy)}: ${detail.groupKey || 'all'}` : 'Loading detail'}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">Passenger contact details are hidden from analytics.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container-low">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading feedback records...
        </div>
      ) : (
        <div className="mt-6 divide-y divide-outline-variant/10 overflow-hidden rounded-xl border border-outline-variant/10 bg-white">
          {(detail?.items || []).length ? detail.items.map((item) => (
            <article key={item.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-primary">{item.title}</h3>
                  <p className="mt-1 text-xs font-bold uppercase text-on-surface-variant">
                    {labelize(item.category)} · {item.type} · {item.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-black text-on-primary-fixed">
                    {item.rating ? `${item.rating}/5` : 'No rating'}
                  </span>
                  <SentimentBadge sentiment={item.sentiment} />
                </div>
              </div>
              <p className="mt-3 text-sm text-on-surface-variant">{item.description || 'No description provided.'}</p>
              <div className="mt-3 grid gap-2 text-xs text-on-surface-variant md:grid-cols-4">
                <span>Route: {item.routeName || 'N/A'}</span>
                <span>Driver: {item.driverName || 'N/A'}</span>
                <span>Vehicle: {item.vehicleLabel || 'N/A'}</span>
                <span>Passenger: {item.passenger?.displayName || 'N/A'}</span>
              </div>
            </article>
          )) : (
            <p className="px-5 py-12 text-center text-sm text-on-surface-variant">No feedback records match this group.</p>
          )}
        </div>
      )}
    </aside>
  </div>
);

const FeedbackAnalyticsPage = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await feedbackAnalyticsService.getAnalytics(filters);
      setAnalytics(response.data);
    } catch (error) {
      toast.error(error?.message || 'Unable to load feedback analytics');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const openDetail = async (groupKey = '') => {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = await feedbackAnalyticsService.getDetail({ ...filters, groupKey });
      setDetail(response.data);
    } catch (error) {
      toast.error(error?.message || 'Unable to load feedback records');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const summary = analytics?.summary || {};
  const groups = analytics?.groups || [];
  const groupMax = useMemo(
    () => Math.max(...groups.map((group) => Number(group.totalFeedback || 0)), 1),
    [groups]
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-black text-primary">Feedback Analytics</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Aggregated passenger feedback, complaint sentiment, and route quality indicators.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAnalytics}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-outline-variant/60 bg-white px-4 text-sm font-black text-primary hover:bg-surface-container-low"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      <section className="rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} className={fieldClassName} />
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter('to', event.target.value)} className={fieldClassName} />
          <input value={filters.routeId} onChange={(event) => updateFilter('routeId', event.target.value)} className={fieldClassName} placeholder="Route ObjectId" />
          <input value={filters.driverId} onChange={(event) => updateFilter('driverId', event.target.value)} className={fieldClassName} placeholder="Driver ObjectId" />
          <input value={filters.vehicleId} onChange={(event) => updateFilter('vehicleId', event.target.value)} className={fieldClassName} placeholder="Vehicle ObjectId" />
          <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className={fieldClassName}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
          </select>
          <select value={filters.rating} onChange={(event) => updateFilter('rating', event.target.value)} className={fieldClassName}>
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
          </select>
          <select value={filters.groupBy} onChange={(event) => updateFilter('groupBy', event.target.value)} className={fieldClassName}>
            {groupOptions.map((group) => <option key={group} value={group}>By {labelize(group)}</option>)}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl bg-white px-5 py-16 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading feedback analytics...
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Star} label="Average rating" value={formatRating(summary.averageRating)} detail={`${summary.positiveCount || 0} positive responses`} tone="bg-amber-100 text-amber-800" />
            <KpiCard icon={MessageSquareWarning} label="Total feedback" value={summary.totalFeedback || 0} detail={`${summary.complaintCount || 0} complaints included`} tone="bg-emerald-100 text-emerald-700" />
            <KpiCard icon={Frown} label="Negative feedback" value={summary.negativeCount || 0} detail={`${summary.neutralCount || 0} neutral responses`} tone="bg-red-100 text-red-700" />
            <KpiCard icon={TrendingDown} label="Resolution rate" value={formatPercent(summary.resolutionRate)} detail={`${summary.resolvedComplaintCount || 0}/${summary.complaintCount || 0} complaints resolved`} tone="bg-blue-100 text-blue-700" />
          </section>

          <section className="overflow-hidden rounded-xl border border-outline-variant/10 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/10 px-5 py-4">
              <h2 className="text-lg font-headline font-black text-primary">Grouped analytics</h2>
              <button type="button" onClick={() => openDetail('')} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-black text-white">
                <Eye className="h-4 w-4" />
                View all records
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1150px] w-full text-left text-sm">
                <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Group</th>
                    <th className="px-4 py-3">Feedback</th>
                    <th className="px-4 py-3">Avg rating</th>
                    <th className="px-4 py-3">Positive</th>
                    <th className="px-4 py-3">Neutral</th>
                    <th className="px-4 py-3">Negative</th>
                    <th className="px-4 py-3">Complaints</th>
                    <th className="px-4 py-3">Resolved</th>
                    <th className="px-4 py-3">Resolution</th>
                    <th className="px-4 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {groups.length ? groups.map((group) => (
                    <tr key={group.key} className="hover:bg-surface-container-low">
                      <td className="px-4 py-4">
                        <p className="font-black capitalize text-primary">{labelize(group.label)}</p>
                        <div className="mt-2 h-2 max-w-48 overflow-hidden rounded-full bg-surface-container">
                          <div className="h-full bg-on-tertiary-container" style={{ width: `${Math.max((group.totalFeedback / groupMax) * 100, 4)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-4 font-black text-primary">{group.totalFeedback}</td>
                      <td className="px-4 py-4">{formatRating(group.averageRating)}</td>
                      <td className="px-4 py-4">{group.positiveCount}</td>
                      <td className="px-4 py-4">{group.neutralCount}</td>
                      <td className="px-4 py-4">{group.negativeCount}</td>
                      <td className="px-4 py-4">{group.complaintCount}</td>
                      <td className="px-4 py-4">{group.resolvedComplaintCount}</td>
                      <td className="px-4 py-4">{formatPercent(group.resolutionRate)}</td>
                      <td className="px-4 py-4 text-right">
                        <button type="button" title="View feedback records" onClick={() => openDetail(group.key)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="10" className="px-5 py-12 text-center text-on-surface-variant">No feedback analytics match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <DataList
              title="Top complaint categories"
              items={summary.topCategories || []}
              emptyText="No complaints found for this period."
              renderItem={(item) => (
                <div key={item.category} className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3">
                  <span className="font-bold capitalize text-primary">{labelize(item.category)}</span>
                  <span className="text-sm font-black text-on-surface-variant">{item.count}</span>
                </div>
              )}
            />
            <DataList
              title="Lowest rated routes"
              items={summary.lowestRatedRoutes || []}
              emptyText="No route ratings are available."
              renderItem={(item) => (
                <div key={item.routeId || item.routeName} className="rounded-lg bg-surface-container-low px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-primary">{item.routeName}</span>
                    <span className="text-sm font-black text-error">{formatRating(item.averageRating)}</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">{item.negativeCount} negative · {item.totalFeedback} total</p>
                </div>
              )}
            />
            <DataList
              title="Repeated negative feedback routes"
              items={summary.repeatedNegativeRoutes || []}
              emptyText="No route has repeated negative feedback."
              renderItem={(item) => (
                <div key={item.routeId || item.routeName} className="rounded-lg bg-red-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-primary">{item.routeName}</span>
                    <span className="text-sm font-black text-red-700">{item.negativeCount}</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">{item.totalFeedback} records in current filters</p>
                </div>
              )}
            />
          </section>
        </>
      )}

      {detailOpen ? (
        <DetailDrawer
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setDetailOpen(false);
            setDetail(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default FeedbackAnalyticsPage;
