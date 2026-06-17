import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import fleetMonitoringService from '../services/fleetMonitoringService.js';
import toast from '../../../../shared/utils/toast.js';

const POLL_INTERVAL_MS = 20000;

const SEVERITY_META = {
  minor: { label: 'Minor', tone: 'bg-emerald-100 text-emerald-700' },
  moderate: { label: 'Moderate', tone: 'bg-amber-100 text-amber-800' },
  severe: { label: 'Severe', tone: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', tone: 'bg-red-100 text-red-700' },
};

const REASON_LABELS = {
  accident_incident: 'Accident incident',
  breakdown_incident: 'Breakdown incident',
  traffic_congestion: 'Traffic congestion',
  vehicle_idle: 'Vehicle idle',
  late_departure: 'Late departure',
  status_marked_delayed: 'Marked delayed',
  reported_delay: 'Reported delay',
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
  relatedIncident: trip.relatedIncident || null,
  operationNotes: trip.operationNotes || [],
});

const SeverityBadge = ({ severity }) => {
  const meta = SEVERITY_META[severity] || SEVERITY_META.minor;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${meta.tone}`}>
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

const AcknowledgeModal = ({ trip, onClose, onSubmit }) => {
  const [reason, setReason] = useState(trip?.delayReason || '');
  const [note, setNote] = useState('');
  const [notifyTargetRole, setNotifyTargetRole] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(trip.tripId, {
        reason,
        note,
        notifyTargetRole: notifyTargetRole || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" aria-label="Close acknowledge modal" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-xl rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-on-tertiary-container">Acknowledge delay</p>
            <h2 className="mt-1 text-xl font-headline font-black text-primary">{trip.tripCode}</h2>
            <p className="text-sm text-on-surface-variant">
              {trip.route?.routeCode} · {trip.vehicle?.plateNumber} · {trip.delayMinutes} min
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Reason</span>
            <select
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary"
            >
              <option value="">Select reason</option>
              {Object.entries(REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Operation note</span>
            <textarea
              required
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-28 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary"
              placeholder="Record dispatcher action, driver instruction, or passenger communication..."
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Notify</span>
            <select
              value={notifyTargetRole}
              onChange={(event) => setNotifyTargetRole(event.target.value)}
              className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary"
            >
              <option value="">Do not send notification</option>
              <option value="driver">Driver</option>
              <option value="assistant">Assistant</option>
              <option value="passenger">Affected passengers</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-bold text-primary hover:bg-surface-container-low">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="h-10 rounded-full bg-primary px-5 text-sm font-bold text-on-primary disabled:opacity-60">
            {saving ? 'Saving...' : 'Acknowledge'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminDelayedTripsPage = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [kpis, setKpis] = useState({});
  const [filterOptions, setFilterOptions] = useState({ routes: [], severities: [], reasons: [] });
  const [filters, setFilters] = useState({ routeId: '', severity: '', reason: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [ackTrip, setAckTrip] = useState(null);
  const socketRef = useRef(null);

  const loadTrips = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const result = await fleetMonitoringService.getDelayedTrips(params);
    setTrips((result.trips || []).map(normalizeTrip));
    setKpis(result.kpis || {});
    setFilterOptions(result.filters || {});
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadTrips().catch((error) => {
      setLoading(false);
      toast.error(error?.message || 'Unable to load delayed trips');
    });
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
    socket.on('server:trip:delayed', () => loadTrips().catch(() => {}));
    socket.on('server:trip:statusUpdated', () => loadTrips().catch(() => {}));
    socket.on('server:incident:new', () => loadTrips().catch(() => {}));
    socket.on('server:incident:updated', () => loadTrips().catch(() => {}));

    return () => {
      socket.emit('admin:fleet:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadTrips]);

  useEffect(() => {
    if (socketConnected) return undefined;
    const timer = window.setInterval(() => loadTrips().catch(() => {}), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadTrips, socketConnected]);

  const liveKpis = useMemo(() => ({
    delayedTripsTotal: trips.length || kpis.delayedTripsTotal || 0,
    minor: trips.filter((trip) => trip.delaySeverity === 'minor').length || kpis.minor || 0,
    moderate: trips.filter((trip) => trip.delaySeverity === 'moderate').length || kpis.moderate || 0,
    severeCritical: trips.filter((trip) => ['severe', 'critical'].includes(trip.delaySeverity)).length || kpis.severeCritical || 0,
  }), [kpis, trips]);

  const acknowledgeTrip = async (tripId, payload) => {
    try {
      await fleetMonitoringService.acknowledgeDelayedTrip(tripId, payload);
      setAckTrip(null);
      await loadTrips();
      toast.success('Delay acknowledged');
    } catch (error) {
      toast.error(error?.message || 'Unable to acknowledge delay');
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-black text-primary">Monitor Delayed Trips</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Rule-based delay detection for trips that need dispatcher attention.
          </p>
        </div>
        <span className={`inline-flex h-10 w-fit items-center gap-2 rounded-full px-4 text-xs font-black uppercase ${
          socketConnected ? 'bg-on-tertiary-container/10 text-on-tertiary-container' : 'bg-secondary-container text-secondary'
        }`}
        >
          <span className="material-symbols-outlined text-base">{socketConnected ? 'sensors' : 'sync'}</span>
          {socketConnected ? 'Live socket' : 'Polling fallback'}
        </span>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="schedule" label="Delayed trips total" value={liveKpis.delayedTripsTotal} tone="bg-amber-100 text-amber-800" />
        <KpiCard icon="timer" label="Minor" value={liveKpis.minor} tone="bg-emerald-100 text-emerald-700" />
        <KpiCard icon="pending_actions" label="Moderate" value={liveKpis.moderate} tone="bg-orange-100 text-orange-800" />
        <KpiCard icon="warning" label="Severe / critical" value={liveKpis.severeCritical} tone="bg-error-container text-on-error-container" />
      </section>

      <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Route</span>
            <select value={filters.routeId} onChange={(event) => setFilters((current) => ({ ...current, routeId: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All routes</option>
              {(filterOptions.routes || []).map((route) => <option key={route.id} value={route.id}>{route.routeCode} {route.routeName}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Severity</span>
            <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All severities</option>
              {(filterOptions.severities || Object.keys(SEVERITY_META)).map((severity) => <option key={severity} value={severity}>{SEVERITY_META[severity]?.label || severity}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Reason</span>
            <select value={filters.reason} onChange={(event) => setFilters((current) => ({ ...current, reason: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary">
              <option value="">All reasons</option>
              {(filterOptions.reasons || []).map((reason) => <option key={reason} value={reason}>{REASON_LABELS[reason] || reason}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">From</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">To</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="h-11 w-full rounded-lg border-outline-variant/60 bg-white text-sm text-primary" />
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
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Times</th>
                <th className="px-4 py-3">Next stop</th>
                <th className="px-4 py-3">Delay</th>
                <th className="px-4 py-3">Reason / incident</th>
                <th className="px-4 py-3">GPS</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan="10" className="px-4 py-14 text-center text-sm font-bold text-on-surface-variant">Loading delayed trips...</td></tr>
              ) : trips.length ? trips.map((trip) => (
                <tr key={trip.tripId} className="hover:bg-surface-container-low">
                  <td className="px-4 py-4 font-black text-primary">{trip.tripCode}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{trip.route?.routeCode || 'N/A'}</p>
                    <p className="text-xs text-on-surface-variant">{trip.route?.routeName || 'No route name'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{trip.vehicle?.vehicleCode || 'N/A'}</p>
                    <p className="text-xs text-on-surface-variant">{trip.vehicle?.plateNumber || 'No plate'}</p>
                  </td>
                  <td className="px-4 py-4">{trip.driver?.fullName || 'No driver'}</td>
                  <td className="px-4 py-4 text-xs text-on-surface-variant">
                    <p>Plan: {formatDateTime(trip.plannedStartTime)}</p>
                    <p>Actual: {formatDateTime(trip.actualStartTime)}</p>
                  </td>
                  <td className="px-4 py-4">{trip.nextStop?.name || 'N/A'}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-primary">{trip.delayMinutes} min</p>
                    <SeverityBadge severity={trip.delaySeverity} />
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-primary">{REASON_LABELS[trip.delayReason] || trip.delayReason || 'Unknown'}</p>
                    <p className={`text-xs font-bold ${trip.relatedIncident ? 'text-error' : 'text-on-surface-variant'}`}>
                      {trip.relatedIncident ? `${trip.relatedIncident.type} · ${trip.relatedIncident.title}` : 'No related incident'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs text-on-surface-variant">{minutesSince(trip.lastGpsAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => navigate(`/admin/fleet/locations?vehicleId=${trip.vehicle?.id || ''}`)} className="rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-black text-primary">
                        View on map
                      </button>
                      <button type="button" onClick={() => setAckTrip(trip)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-black text-on-primary">
                        {trip.delayAcknowledgedAt ? 'Add note' : 'Acknowledge'}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="10" className="px-4 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant">task_alt</span>
                    <p className="mt-2 font-black text-primary">No delayed trips match the current filters.</p>
                    <p className="text-sm text-on-surface-variant">Trips are detected through schedule, GPS, delay, and incident rules.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {ackTrip ? (
        <AcknowledgeModal
          trip={ackTrip}
          onClose={() => setAckTrip(null)}
          onSubmit={acknowledgeTrip}
        />
      ) : null}
    </div>
  );
};

export default AdminDelayedTripsPage;
