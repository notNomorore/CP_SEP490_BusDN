import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import fleetMonitoringService from '../services/fleetMonitoringService.js';
import toast from '../../../../shared/utils/toast.js';
import { ReplacementVehicleModal } from '../../vehicleReassignments';

const POLL_INTERVAL_MS = 20000;

const STATUS_META = {
  active: { label: 'Active', tone: 'bg-emerald-100 text-emerald-700', icon: 'play_circle' },
  idle: { label: 'Idle', tone: 'bg-slate-100 text-slate-700', icon: 'pause_circle' },
  paused: { label: 'Paused', tone: 'bg-slate-100 text-slate-700', icon: 'pause' },
  delayed: { label: 'Delayed', tone: 'bg-amber-100 text-amber-800', icon: 'schedule' },
  incident: { label: 'Incident', tone: 'bg-red-100 text-red-700', icon: 'warning' },
  lost_signal: { label: 'Lost signal', tone: 'bg-zinc-200 text-zinc-700', icon: 'signal_disconnected' },
};

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const minutesSince = (value) => {
  if (!value) return 'No GPS';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60000)}m ago`;
};

const normalizeTrip = (trip) => ({
  ...trip,
  route: trip.route || {},
  vehicle: trip.vehicle || {},
  driver: trip.driver || null,
  assistant: trip.assistant || null,
  currentLocation: trip.currentLocation || {},
});

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.active;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${meta.tone}`}>
      <span className="material-symbols-outlined text-sm">{meta.icon}</span>
      {meta.label}
    </span>
  );
};

const KpiCard = ({ icon, label, value, tone }) => (
  <div className="flex min-h-28 flex-col justify-between rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className={`material-symbols-outlined rounded-lg p-2 text-lg ${tone}`}>{icon}</span>
    </div>
    <span className="text-3xl font-headline font-black text-primary">{value || 0}</span>
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="min-w-32">
    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-on-surface-variant">
      <span>Progress</span>
      <span>{Math.round(Number(value || 0))}%</span>
    </div>
    <div className="h-2 rounded-full bg-surface-container-high">
      <div
        className="h-2 rounded-full bg-on-tertiary-container"
        style={{ width: `${Math.min(100, Math.max(0, Number(value || 0)))}%` }}
      />
    </div>
  </div>
);

const DetailDrawer = ({ trip, detail, loading, onAssignReplacement, onClose }) => (
  <div className="fixed inset-0 z-[90] flex justify-end">
    <button type="button" aria-label="Close trip detail" onClick={onClose} className="absolute inset-0 bg-black/40" />
    <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-surface p-5 shadow-2xl sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-on-tertiary-container">Active trip</p>
          <h2 className="mt-1 text-2xl font-headline font-black text-primary">{trip?.tripCode || detail?.tripCode}</h2>
          <p className="text-sm text-on-surface-variant">
            {trip?.route?.routeCode || detail?.route?.routeCode} {trip?.route?.routeName || detail?.route?.routeName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAssignReplacement}
            className="inline-flex items-center gap-2 rounded-full border border-error/30 px-4 py-2 text-sm font-bold text-error hover:bg-error-container/30"
          >
            <span className="material-symbols-outlined text-base">published_with_changes</span>
            Assign Replacement Vehicle
          </button>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm font-bold text-on-surface-variant">Loading trip detail...</div>
      ) : detail ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Vehicle</p>
              <p className="mt-1 font-black text-primary">{detail.vehicle?.vehicleCode || 'N/A'}</p>
              <p className="text-sm text-on-surface-variant">{detail.vehicle?.plateNumber || 'No plate'}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Staff</p>
              <p className="mt-1 font-black text-primary">{detail.staff?.driver?.fullName || 'No driver'}</p>
              <p className="text-sm text-on-surface-variant">{detail.staff?.assistant?.fullName || 'No assistant assigned'}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Current / next stop</p>
              <p className="mt-1 font-black text-primary">{detail.currentStop?.name || 'Current stop unknown'}</p>
              <p className="text-sm text-on-surface-variant">{detail.nextStop?.name || 'No next stop'}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase text-on-surface-variant">GPS</p>
              <p className="mt-1 font-black text-primary">{minutesSince(detail.lastGpsAt)}</p>
              <p className="text-sm text-on-surface-variant">
                {detail.currentLocation?.lat ?? 'N/A'}, {detail.currentLocation?.lng ?? 'N/A'}
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-headline text-lg font-black text-primary">Trip timeline</h3>
            <div className="space-y-2">
              {(detail.timeline || []).map((item) => (
                <div key={`${item.label}-${item.time}`} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                  <span className="font-bold text-primary">{item.label}</span>
                  <span className="text-on-surface-variant">{formatDateTime(item.time)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-headline text-lg font-black text-primary">Route stops</h3>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-outline-variant/15">
              {(detail.routeStops || []).map((stop) => (
                <div key={`${stop.order}-${stop.name}`} className="flex items-center gap-3 border-b border-outline-variant/10 px-4 py-3 last:border-b-0">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    stop.state === 'current' ? 'bg-on-tertiary-container text-white' : stop.state === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                  >
                    {stop.order}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-primary">{stop.name}</p>
                    <p className="text-xs text-on-surface-variant">{stop.state}</p>
                  </div>
                </div>
              ))}
              {!detail.routeStops?.length ? (
                <p className="p-4 text-sm text-on-surface-variant">No route stop sequence is configured for this trip.</p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-headline text-lg font-black text-primary">Open incidents</h3>
            <div className="space-y-2">
              {(detail.incidents || []).map((incident) => (
                <div key={incident.id} className="rounded-xl border border-error/20 bg-error-container/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black text-primary">{incident.title}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-error">{incident.severity}</span>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{incident.description}</p>
                  <p className="mt-2 text-xs font-bold text-on-surface-variant">{formatDateTime(incident.createdAt)} · {incident.status}</p>
                </div>
              ))}
              {!detail.incidents?.length ? (
                <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">No open incidents for this trip.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <div className="py-16 text-center text-sm text-on-surface-variant">Trip detail is unavailable.</div>
      )}
    </aside>
  </div>
);

const AdminActiveTripsPage = () => {
  const [trips, setTrips] = useState([]);
  const [kpis, setKpis] = useState({});
  const [filterOptions, setFilterOptions] = useState({ routes: [], drivers: [], vehicles: [], statuses: [] });
  const [filters, setFilters] = useState({ routeId: '', status: '', driverId: '', vehicleId: '', keyword: '', sort: 'lastGpsAt:desc' });
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const loadTripsRef = useRef(null);

  const loadTrips = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const result = await fleetMonitoringService.getActiveTrips(params);
    setTrips((result.trips || []).map(normalizeTrip));
    setKpis(result.kpis || {});
    setFilterOptions(result.filters || {});
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadTrips().catch((error) => {
      setLoading(false);
      toast.error(error?.message || 'Unable to load active trips');
    });
  }, [loadTrips]);

  useEffect(() => {
    loadTripsRef.current = loadTrips;
  }, [loadTrips]);

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
    socket.on('server:fleet:locationUpdated', () => loadTripsRef.current?.().catch(() => {}));
    socket.on('server:trip:statusUpdated', () => loadTripsRef.current?.().catch(() => {}));
    socket.on('server:incident:new', () => loadTripsRef.current?.().catch(() => {}));
    socket.on('server:trip:vehicleReassigned', () => loadTripsRef.current?.().catch(() => {}));

    return () => {
      socket.emit('admin:fleet:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (socketConnected) return undefined;
    const timer = window.setInterval(() => loadTrips().catch(() => {}), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadTrips, socketConnected]);

  const visibleTrips = useMemo(() => trips, [trips]);

  const openDetail = async (trip) => {
    setSelectedTrip(trip);
    setDetail(null);
    setDetailLoading(true);
    try {
      const result = await fleetMonitoringService.getActiveTripDetail(trip.tripId);
      setDetail(normalizeTrip(result));
    } catch (error) {
      toast.error(error?.message || 'Unable to load trip detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const scanSystemIncidents = async () => {
    setScanning(true);
    try {
      const result = await fleetMonitoringService.scanSystemIncidents();
      await loadTrips();
      toast.success(`System scan completed: ${result.createdCount || 0} new alerts`);
    } catch (error) {
      toast.error(error?.message || 'Unable to scan system incidents');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-black text-primary">Monitor Active Trips</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Real-time operations table for active, paused, delayed, and incident trips.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex h-10 w-fit items-center gap-2 rounded-full px-4 text-xs font-black uppercase ${
            socketConnected ? 'bg-on-tertiary-container/10 text-on-tertiary-container' : 'bg-secondary-container text-secondary'
          }`}
          >
            <span className="material-symbols-outlined text-base">{socketConnected ? 'sensors' : 'sync'}</span>
            {socketConnected ? 'Live socket' : 'Polling fallback'}
          </span>
          <button
            type="button"
            onClick={scanSystemIncidents}
            disabled={scanning}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">{scanning ? 'sync' : 'rule_settings'}</span>
            {scanning ? 'Scanning...' : 'Scan System'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="route" label="Total active trips" value={kpis.totalActiveTrips} tone="bg-on-tertiary-container/10 text-on-tertiary-container" />
        <KpiCard icon="check_circle" label="On-time trips" value={kpis.onTimeTrips} tone="bg-emerald-100 text-emerald-700" />
        <KpiCard icon="schedule" label="Delayed trips" value={kpis.delayedTrips} tone="bg-amber-100 text-amber-800" />
        <KpiCard icon="warning" label="Trips with incidents" value={kpis.tripsWithIncidents} tone="bg-error-container text-on-error-container" />
      </section>

      <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Route</span>
            <select value={filters.routeId} onChange={(event) => setFilters((current) => ({ ...current, routeId: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All routes</option>
              {(filterOptions.routes || []).map((route) => <option key={route.id} value={route.id}>{route.routeCode} {route.routeName}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All statuses</option>
              {[...(filterOptions.statuses || []), ...(filterOptions.operationalStatuses || [])].filter((value, index, array) => value && array.indexOf(value) === index).map((status) => <option key={status} value={status}>{STATUS_META[status]?.label || status}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Driver</span>
            <select value={filters.driverId} onChange={(event) => setFilters((current) => ({ ...current, driverId: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All drivers</option>
              {(filterOptions.drivers || []).map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Vehicle</span>
            <select value={filters.vehicleId} onChange={(event) => setFilters((current) => ({ ...current, vehicleId: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All vehicles</option>
              {(filterOptions.vehicles || []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicleCode} {vehicle.plateNumber}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sort</span>
            <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="lastGpsAt:desc">Last GPS newest</option>
              <option value="delayMinutes:desc">Delay highest</option>
              <option value="startTime:asc">Start earliest</option>
              <option value="route:asc">Route A-Z</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Keyword</span>
            <input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary" placeholder="Trip, route, plate..." />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Times</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Delay</th>
                <th className="px-4 py-3">Load</th>
                <th className="px-4 py-3">GPS / Incidents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan="11" className="px-4 py-14 text-center text-sm font-bold text-on-surface-variant">Loading active trips...</td></tr>
              ) : visibleTrips.length ? visibleTrips.map((trip) => (
                <tr key={trip.tripId} onClick={() => openDetail(trip)} className="cursor-pointer hover:bg-surface-container-low">
                  <td className="px-4 py-4 font-black text-primary">{trip.tripCode}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{trip.route?.routeCode || 'N/A'}</p>
                    <p className="text-xs text-on-surface-variant">{trip.route?.routeName || 'No route name'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{trip.vehicle?.vehicleCode || 'N/A'}</p>
                    <p className="text-xs text-on-surface-variant">{trip.vehicle?.plateNumber || 'No plate'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{trip.driver?.fullName || 'No driver'}</p>
                    <p className="text-xs text-on-surface-variant">{trip.assistant?.fullName || 'No assistant'}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-on-surface-variant">
                    <p>Plan: {formatDateTime(trip.plannedStartTime)}</p>
                    <p>Actual: {formatDateTime(trip.actualStartTime)}</p>
                  </td>
                  <td className="px-4 py-4"><StatusPill status={trip.operationalStatus || trip.status} /></td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{trip.currentStop?.name || 'Unknown'}</p>
                    <p className="text-xs text-on-surface-variant">Next: {trip.nextStop?.name || 'N/A'}</p>
                  </td>
                  <td className="px-4 py-4"><ProgressBar value={trip.progressPercent} /></td>
                  <td className="px-4 py-4 font-black text-primary">{trip.delayMinutes || 0} min</td>
                  <td className="px-4 py-4 text-sm text-primary">{trip.passengerCount ?? trip.occupancyStatus ?? 'N/A'}</td>
                  <td className="px-4 py-4">
                    <p className="text-xs font-bold text-primary">{minutesSince(trip.lastGpsAt)}</p>
                    <p className={`text-xs font-black ${trip.openIncidentCount > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{trip.openIncidentCount || 0} open incidents</p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="11" className="px-4 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant">route</span>
                    <p className="mt-2 font-black text-primary">No active trips are currently operating.</p>
                    <p className="text-sm text-on-surface-variant">Trips with active, paused, delayed, or incident status will appear here automatically.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTrip ? (
        <DetailDrawer
          trip={selectedTrip}
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setSelectedTrip(null);
            setDetail(null);
            setReplacementModalOpen(false);
          }}
          onAssignReplacement={() => setReplacementModalOpen(true)}
        />
      ) : null}

      <ReplacementVehicleModal
        open={replacementModalOpen}
        tripId={selectedTrip?.tripId}
        routeId={selectedTrip?.routeId}
        requiredCapacity={detail?.vehicle?.capacity || selectedTrip?.vehicle?.capacity}
        title="Assign Replacement Vehicle"
        onClose={() => setReplacementModalOpen(false)}
        onAssigned={async () => {
          setReplacementModalOpen(false);
          await loadTrips();
          if (selectedTrip?.tripId) {
            try {
              const result = await fleetMonitoringService.getActiveTripDetail(selectedTrip.tripId);
              setDetail(normalizeTrip(result));
            } catch {
              setDetail(null);
            }
          }
        }}
      />
    </div>
  );
};

export default AdminActiveTripsPage;
