import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  BusFront,
  Clock3,
  Download,
  Eye,
  Gauge,
  LoaderCircle,
  RefreshCcw,
  Route,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import routeEfficiencyService from '../services/routeEfficiencyService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const today = new Date();
const defaultFilters = {
  startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
  endDate: format(today, 'yyyy-MM-dd'),
  routeId: '',
  vehicleId: '',
  driverId: '',
  groupBy: 'day',
};

const money = (value) => `${Number(value || 0).toLocaleString()} VND`;
const percent = (value) => `${Number(value || 0).toFixed(2)}%`;

const MetricCard = ({ label, value, detail, icon: Icon }) => (
  <div className="rounded-[24px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</p>
      <div className="rounded-full bg-primary-fixed p-2 text-on-primary-fixed">
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="mt-4 text-2xl font-headline font-extrabold text-primary">{value}</p>
    <p className="mt-2 text-sm text-on-surface-variant">{detail}</p>
  </div>
);

const BarList = ({ items, labelKey = 'period', valueKey, valueFormatter }) => {
  const maxValue = useMemo(
    () => Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1),
    [items, valueKey]
  );

  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-8 text-center text-sm text-on-surface-variant">
        No analytics data found for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = `${Math.max((value / maxValue) * 100, 5)}%`;

        return (
          <div key={`${item[labelKey]}-${value}`} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate font-semibold text-on-surface">
                {item[labelKey] || 'N/A'}
              </span>
              <span className="shrink-0 text-on-surface-variant">
                {valueFormatter(value)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-on-tertiary-container" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DataPanel = ({ title, children }) => (
  <section className="rounded-[28px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
    <h2 className="text-lg font-bold text-primary">{title}</h2>
    <div className="mt-5">{children}</div>
  </section>
);

const scoreClassName = (score) => {
  if (score >= 75) {
    return 'bg-secondary-container text-on-secondary-container';
  }
  if (score >= 50) {
    return 'bg-primary-fixed text-on-primary-fixed';
  }
  return 'bg-error-container text-on-error-container';
};

const RouteDetailModal = ({ detail, isLoading, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
    <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
            Route efficiency detail
          </p>
          <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
            {detail?.routeInfo?.name || 'Loading route...'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading route detail...
        </div>
      ) : (
        <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Total trips', detail?.totalTrips ?? 0],
              ['Completed trips', detail?.completedTrips ?? 0],
              ['Cancelled trips', detail?.cancelledTrips ?? 0],
              ['Passenger volume', detail?.passengerVolume ?? 0],
              ['Occupancy rate', percent(detail?.occupancyRate)],
              ['Efficiency score', `${detail?.efficiencyScore ?? 0}/100`],
              ['Average travel time', `${detail?.averageTravelTime ?? 0} min`],
              ['Average delay', `${detail?.averageDelayTime ?? 0} min`],
              ['Total revenue', money(detail?.totalRevenue)],
              ['Revenue per km', money(detail?.revenuePerKm)],
              ['Incidents', detail?.incidentCount ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[20px] bg-surface-container-low p-4">
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-outline">
                  {label}
                </dt>
                <dd className="mt-2 text-lg font-bold text-primary">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <h3 className="text-lg font-bold text-primary">Peak hour demand</h3>
            <div className="mt-4">
              <BarList
                items={detail?.peakHourDemand || []}
                labelKey="hour"
                valueKey="passengerCount"
                valueFormatter={(value) => `${value} passengers`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);

const RouteEfficiencyPage = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routeDetail, setRouteDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!filters.startDate || !filters.endDate) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await routeEfficiencyService.getAnalytics(filters);
      setAnalytics(response.data);
    } catch (error) {
      toast.error(error.message || 'Unable to generate route efficiency analytics');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const openRouteDetail = async (routeId) => {
    if (!routeId) {
      toast.error('Detailed analytics require a stored route identifier');
      return;
    }

    setSelectedRouteId(routeId);
    setRouteDetail(null);
    setIsDetailLoading(true);

    try {
      const response = await routeEfficiencyService.getRouteDetail(routeId, filters);
      setRouteDetail(response.data);
    } catch (error) {
      toast.error(error.message || 'Unable to load route analytics detail');
      setSelectedRouteId('');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const exportAnalytics = () => {
    const blob = new Blob([JSON.stringify({ filters, analytics }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'route-efficiency-analytics.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminPromotionShell
      title="Route Efficiency Analytics"
      subtitle="Compare occupancy, punctuality, passenger demand, revenue, delays, and incidents across BusDN routes."
      action={(
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadAnalytics}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-white px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportAnalytics}
            disabled={!analytics}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      )}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[150px_150px_1fr_1fr_1fr_140px]">
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter('startDate', event.target.value)}
            className={fieldClassName}
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter('endDate', event.target.value)}
            className={fieldClassName}
          />
          <input
            value={filters.routeId}
            onChange={(event) => updateFilter('routeId', event.target.value)}
            className={fieldClassName}
            placeholder="Route ObjectId"
          />
          <input
            value={filters.vehicleId}
            onChange={(event) => updateFilter('vehicleId', event.target.value)}
            className={fieldClassName}
            placeholder="Vehicle ObjectId"
          />
          <input
            value={filters.driverId}
            onChange={(event) => updateFilter('driverId', event.target.value)}
            className={fieldClassName}
            placeholder="Driver ObjectId"
          />
          <select
            value={filters.groupBy}
            onChange={(event) => updateFilter('groupBy', event.target.value)}
            className={fieldClassName}
          >
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
            <option value="route">By route</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center rounded-[28px] bg-white/80 px-5 py-16 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading route efficiency analytics...
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Total Routes"
              value={analytics?.totalRoutes ?? 0}
              detail={`${analytics?.totalTrips ?? 0} operational trips`}
              icon={Route}
            />
            <MetricCard
              label="Total Trips"
              value={analytics?.totalTrips ?? 0}
              detail={`${analytics?.totalPassengers ?? 0} passengers`}
              icon={BusFront}
            />
            <MetricCard
              label="Occupancy"
              value={percent(analytics?.averageOccupancyRate)}
              detail="Average vehicle utilization"
              icon={Users}
            />
            <MetricCard
              label="On-time"
              value={percent(analytics?.onTimePerformanceRate)}
              detail="Trips within delay threshold"
              icon={Clock3}
            />
            <MetricCard
              label="Revenue per km"
              value={money(analytics?.revenuePerKm)}
              detail={`${money(analytics?.totalRevenue)} total`}
              icon={WalletCards}
            />
            <MetricCard
              label="Average Delay"
              value={`${analytics?.averageDelayTime ?? 0} min`}
              detail={`${analytics?.routeEfficiencyScore ?? 0}/100 efficiency`}
              icon={Gauge}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <DataPanel title="Occupancy rate over time">
              <BarList
                items={analytics?.occupancyRateOverTime || []}
                valueKey="occupancyRate"
                valueFormatter={percent}
              />
            </DataPanel>
            <DataPanel title="On-time performance over time">
              <BarList
                items={analytics?.onTimePerformanceOverTime || []}
                valueKey="onTimePerformance"
                valueFormatter={percent}
              />
            </DataPanel>
            <DataPanel title="Revenue per km vs delay">
              <BarList
                items={analytics?.revenuePerKmOverTime || []}
                valueKey="revenuePerKm"
                valueFormatter={money}
              />
            </DataPanel>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <DataPanel title="Top efficient routes">
              <BarList
                items={analytics?.topEfficientRoutes || []}
                labelKey="routeName"
                valueKey="efficiencyScore"
                valueFormatter={(value) => `${value}/100`}
              />
            </DataPanel>
            <DataPanel title="Low performance routes">
              <BarList
                items={analytics?.lowPerformanceRoutes || []}
                labelKey="routeName"
                valueKey="efficiencyScore"
                valueFormatter={(value) => `${value}/100`}
              />
            </DataPanel>
          </section>

          <section className="mt-6 overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85 shadow-sm">
            <div className="border-b border-outline-variant/30 px-5 py-4">
              <h2 className="text-lg font-bold text-primary">Route performance overview</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1300px] divide-y divide-outline-variant/30 text-left text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
                  <tr>
                    <th className="px-4 py-4">Route</th>
                    <th className="px-4 py-4">Trips</th>
                    <th className="px-4 py-4">Passengers</th>
                    <th className="px-4 py-4">Occupancy</th>
                    <th className="px-4 py-4">On-time</th>
                    <th className="px-4 py-4">Delay</th>
                    <th className="px-4 py-4">Revenue</th>
                    <th className="px-4 py-4">Revenue/km</th>
                    <th className="px-4 py-4">Incidents</th>
                    <th className="px-4 py-4">Score</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {(analytics?.routePerformanceTable || []).length ? (
                    analytics.routePerformanceTable.map((routeItem) => (
                      <tr key={routeItem.routeId || routeItem.routeName} className="hover:bg-surface-container-low/70">
                        <td className="px-4 py-4 font-bold text-primary">{routeItem.routeName}</td>
                        <td className="px-4 py-4">{routeItem.totalTrips}</td>
                        <td className="px-4 py-4">{routeItem.totalPassengers}</td>
                        <td className="px-4 py-4">{percent(routeItem.averageOccupancy)}</td>
                        <td className="px-4 py-4">{percent(routeItem.onTimePerformance)}</td>
                        <td className="px-4 py-4">{routeItem.averageDelayTime} min</td>
                        <td className="px-4 py-4">{money(routeItem.totalRevenue)}</td>
                        <td className="px-4 py-4">{money(routeItem.revenuePerKm)}</td>
                        <td className="px-4 py-4">{routeItem.incidentCount}</td>
                        <td className="px-4 py-4 font-bold">{routeItem.efficiencyScore}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreClassName(routeItem.efficiencyScore)}`}>
                            {routeItem.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            title="View route detail"
                            disabled={!routeItem.routeId}
                            onClick={() => openRouteDetail(routeItem.routeId)}
                            className="rounded-full p-2 text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="12" className="px-5 py-10 text-center text-on-surface-variant">
                        No route efficiency data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedRouteId ? (
        <RouteDetailModal
          detail={routeDetail}
          isLoading={isDetailLoading}
          onClose={() => {
            setSelectedRouteId('');
            setRouteDetail(null);
          }}
        />
      ) : null}
    </AdminPromotionShell>
  );
};

export default RouteEfficiencyPage;
