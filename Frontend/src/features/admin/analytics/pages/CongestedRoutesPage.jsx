import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subHours } from 'date-fns';
import { io } from 'socket.io-client';
import {
  BellRing,
  BusFront,
  Eye,
  Gauge,
  LoaderCircle,
  MapPinned,
  RefreshCcw,
  Route,
  TriangleAlert,
  X,
} from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import congestedRoutesService from '../services/congestedRoutesService.js';

const POLL_INTERVAL_MS = 30000;

const severityTone = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-700',
};

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
};

const now = new Date();
const defaultFilters = {
  from: format(subHours(now, 6), 'yyyy-MM-dd'),
  to: format(now, 'yyyy-MM-dd'),
  routeId: '',
  severity: '',
  area: '',
};

const formatNumber = (value, digits = 0) => Number(value || 0).toFixed(digits);

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const KpiCard = ({ icon: Icon, label, value, detail, tone }) => (
  <div className="flex min-h-28 flex-col justify-between rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    <div>
      <p className="text-3xl font-headline font-black text-primary">{value}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>
    </div>
  </div>
);

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${severityTone[severity] || severityTone.low}`}>
    {severity || 'low'}
  </span>
);

const DetailDrawer = ({ detail, loading, onClose, onViewMap, onBroadcast }) => (
  <div className="fixed inset-0 z-[90] flex justify-end">
    <button type="button" aria-label="Close route detail" onClick={onClose} className="absolute inset-0 bg-black/45" />
    <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-surface p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-on-tertiary-container">
            Congested route detail
          </p>
          <h2 className="mt-1 text-2xl font-headline font-black text-primary">
            {detail?.routeName || detail?.route?.routeName || 'Loading route'}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {detail?.origin || detail?.route?.origin || 'Origin'} to {detail?.destination || detail?.route?.destination || 'Destination'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container-low">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading route detail...
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onViewMap}
              disabled={!detail?.affectedArea && !detail?.affectedTrips?.length}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-black text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MapPinned className="h-4 w-4" />
              View on map
            </button>
            <button
              type="button"
              onClick={onBroadcast}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-outline-variant/60 px-4 text-sm font-black text-primary hover:bg-surface-container-low"
            >
              <BellRing className="h-4 w-4" />
              Broadcast notification
            </button>
          </div>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Affected trips', detail?.affectedTripCount || detail?.affectedTrips?.length || 0],
              ['Active vehicles', detail?.activeVehicleCount || detail?.affectedVehicles?.length || 0],
              ['Average delay', `${formatNumber(detail?.averageDelayMinutes, 1)} min`],
              ['Average speed', `${formatNumber(detail?.averageSpeed, 1)} km/h`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-container-low p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
                <p className="mt-2 text-lg font-black text-primary">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-headline text-lg font-black text-primary">Reasons</h3>
              <SeverityBadge severity={detail?.congestionSeverity} />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
              {(detail?.congestionReason || []).map((reason) => (
                <li key={reason} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/10 px-5 py-4">
              <h3 className="font-headline text-lg font-black text-primary">Affected trips</h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {(detail?.affectedTrips || []).length ? detail.affectedTrips.map((trip) => (
                <div key={trip.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_1fr_120px]">
                  <div>
                    <p className="font-black text-primary">{trip.id}</p>
                    <p className="text-xs text-on-surface-variant">{trip.status} · {trip.progressPercent || 0}% complete</p>
                  </div>
                  <div className="text-on-surface-variant">
                    <p>Vehicle: {trip.vehicle?.vehicleCode || trip.vehicle?.plateNumber || 'N/A'}</p>
                    <p>GPS: {formatDateTime(trip.lastGpsAt)}</p>
                  </div>
                  <div className="font-black text-primary">{trip.delayMinutes || 0} min</div>
                </div>
              )) : (
                <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No affected trips returned.</p>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/10 px-5 py-4">
              <h3 className="font-headline text-lg font-black text-primary">Related incidents</h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {(detail?.relatedIncidents || []).length ? detail.relatedIncidents.map((incident) => (
                <div key={incident.id} className="px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-primary">{incident.title}</p>
                    <SeverityBadge severity={incident.severity} />
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase text-on-surface-variant">{incident.incidentType} · {incident.status}</p>
                  <p className="mt-2 text-on-surface-variant">{incident.description}</p>
                </div>
              )) : (
                <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No open incidents for this route.</p>
              )}
            </div>
          </section>
        </>
      )}
    </aside>
  </div>
);

const CongestedRoutesPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultFilters);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await congestedRoutesService.getCongestedRoutes(filters);
      setAnalytics(response.data);
    } catch (error) {
      toast.error(error?.message || 'Unable to load congested routes');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const socket = io(getApiOrigin(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('admin:fleet:subscribe');
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('server:analytics:congestionUpdated', () => loadRoutes().catch(() => {}));

    return () => {
      socket.emit('admin:fleet:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadRoutes]);

  useEffect(() => {
    if (socketConnected) return undefined;
    const timer = window.setInterval(() => loadRoutes().catch(() => {}), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadRoutes, socketConnected]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const openDetail = async (routeId) => {
    setSelectedRouteId(routeId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = await congestedRoutesService.getRouteDetail(routeId, filters);
      setDetail(response.data);
    } catch (error) {
      toast.error(error?.message || 'Unable to load congested route detail');
      setSelectedRouteId('');
    } finally {
      setDetailLoading(false);
    }
  };

  const kpis = analytics?.kpis || {};
  const rows = analytics?.congestedRoutes || [];
  const routeOptions = analytics?.filters?.routes || [];

  const liveKpis = useMemo(() => ({
    congestedRoutes: rows.length || kpis.congestedRoutes || 0,
    affectedTrips: rows.reduce((total, routeItem) => total + (routeItem.affectedTripCount || 0), 0) || kpis.affectedTrips || 0,
    highCriticalCongestion: rows.filter((routeItem) => ['high', 'critical'].includes(routeItem.congestionSeverity)).length || kpis.highCriticalCongestion || 0,
    averageDelay: rows.length
      ? rows.reduce((total, routeItem) => total + Number(routeItem.averageDelayMinutes || 0), 0) / rows.length
      : kpis.averageDelay || 0,
  }), [kpis, rows]);

  const broadcastNotification = async (routeId = selectedRouteId) => {
    if (!routeId) {
      toast.error('Select a congested route before broadcasting');
      return;
    }

    try {
      await congestedRoutesService.broadcastNotification(routeId, filters);
      toast.success('Congestion notification broadcast to affected route passengers and staff');
    } catch (error) {
      toast.error(error?.message || 'Unable to broadcast congestion notification');
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-black text-primary">Congested Routes</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Rule-based congestion detection for active BusDN routes without external traffic APIs.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className={`inline-flex h-10 w-fit items-center gap-2 rounded-full px-4 text-xs font-black uppercase ${
            socketConnected ? 'bg-on-tertiary-container/10 text-on-tertiary-container' : 'bg-secondary-container text-secondary'
          }`}
          >
            <span className="material-symbols-outlined text-base">{socketConnected ? 'sensors' : 'sync'}</span>
            {socketConnected ? 'Live socket' : 'Polling fallback'}
          </span>
          <button
            type="button"
            onClick={loadRoutes}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-outline-variant/60 bg-white px-4 text-sm font-black text-primary hover:bg-surface-container-low"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Route} label="Congested routes" value={liveKpis.congestedRoutes} detail="Routes matching any rule" tone="bg-red-100 text-red-700" />
        <KpiCard icon={BusFront} label="Affected trips" value={liveKpis.affectedTrips} detail="Active trips on congested routes" tone="bg-amber-100 text-amber-800" />
        <KpiCard icon={TriangleAlert} label="High / critical" value={liveKpis.highCriticalCongestion} detail="Routes needing escalation" tone="bg-orange-100 text-orange-800" />
        <KpiCard icon={Gauge} label="Average delay" value={`${formatNumber(liveKpis.averageDelay, 1)} min`} detail="Across congested routes" tone="bg-emerald-100 text-emerald-700" />
      </section>

      <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Route</span>
            <select value={filters.routeId} onChange={(event) => updateFilter('routeId', event.target.value)} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All routes</option>
              {routeOptions.map((routeItem) => (
                <option key={routeItem.id} value={routeItem.id}>{routeItem.routeNumber} {routeItem.routeName}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Severity</span>
            <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All severities</option>
              {(analytics?.filters?.severities || ['low', 'medium', 'high', 'critical']).map((severity) => (
                <option key={severity} value={severity}>{severity}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Area</span>
            <input
              value={filters.area}
              onChange={(event) => updateFilter('area', event.target.value)}
              className="h-11 w-full rounded-lg border-outline-variant/60 bg-white px-3 text-sm text-primary"
              placeholder="District, stop, segment"
            />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">From</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">To</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter('to', event.target.value)} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary" />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Affected trips</th>
                <th className="px-4 py-3">Vehicles</th>
                <th className="px-4 py-3">Average delay</th>
                <th className="px-4 py-3">Speed</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan="9" className="px-4 py-14 text-center text-sm font-bold text-on-surface-variant">Loading congested routes...</td></tr>
              ) : rows.length ? rows.map((routeItem) => (
                <tr key={routeItem.routeId} className="hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <p className="font-black text-primary">{routeItem.routeNumber || routeItem.routeId}</p>
                    <p className="text-xs text-on-surface-variant">{routeItem.routeName}</p>
                  </td>
                  <td className="px-4 py-4 font-black text-primary">{routeItem.affectedTripCount}</td>
                  <td className="px-4 py-4">{routeItem.activeVehicleCount}</td>
                  <td className="px-4 py-4">{formatNumber(routeItem.averageDelayMinutes, 1)} min</td>
                  <td className="px-4 py-4">{formatNumber(routeItem.averageSpeed, 1)} km/h</td>
                  <td className="px-4 py-4"><SeverityBadge severity={routeItem.congestionSeverity} /></td>
                  <td className="px-4 py-4">
                    <p className="line-clamp-2 max-w-md text-xs text-on-surface-variant">
                      {(routeItem.congestionReason || []).join(', ')}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs text-on-surface-variant">{formatDateTime(routeItem.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" title="View details" onClick={() => openDetail(routeItem.routeId)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" title="View on map" onClick={() => navigate(`/admin/fleet/locations?routeId=${routeItem.routeId}`)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                        <MapPinned className="h-4 w-4" />
                      </button>
                      <button type="button" title="Broadcast notification" onClick={() => broadcastNotification(routeItem.routeId)} className="rounded-full p-2 text-primary hover:bg-surface-container">
                        <BellRing className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="9" className="px-4 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant">task_alt</span>
                    <p className="mt-2 font-black text-primary">No congested routes match the current filters.</p>
                    <p className="text-sm text-on-surface-variant">Detection uses delay, speed, incidents, travel time, and idle vehicle rules.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRouteId ? (
        <DetailDrawer
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setSelectedRouteId('');
            setDetail(null);
          }}
          onViewMap={() => navigate(`/admin/fleet/locations?routeId=${selectedRouteId}`)}
          onBroadcast={broadcastNotification}
        />
      ) : null}
    </div>
  );
};

export default CongestedRoutesPage;
