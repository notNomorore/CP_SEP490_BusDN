import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
} from 'react-leaflet';
import fleetMonitoringService from '../services/fleetMonitoringService.js';
import toast from '../../../../shared/utils/toast.js';

const DA_NANG_CENTER = [16.0544, 108.2022];
const POLL_INTERVAL_MS = 20000;
const FLEET_SECTIONS = [
  { label: 'Live Fleet Map', path: '/admin/dashboard', icon: 'location_on' },
  { label: 'Active Trips', path: '/admin/fleet/active-trips', icon: 'route' },
  { label: 'Delayed Trips', path: '/admin/fleet/delayed-trips', icon: 'schedule' },
  { label: 'Vehicle Issues', path: '/admin/vehicle-issues', icon: 'build_circle' },
  { label: 'Maintenance', path: '/admin/maintenance-approval', icon: 'fact_check' },
];

const STATUS_META = {
  active: { label: 'Active', color: '#059669', icon: 'directions_bus' },
  idle: { label: 'Idle', color: '#64748b', icon: 'pause_circle' },
  delayed: { label: 'Delayed', color: '#d97706', icon: 'schedule' },
  incident: { label: 'Incident', color: '#dc2626', icon: 'warning' },
  lost_signal: { label: 'Lost signal', color: '#4b5563', icon: 'signal_disconnected' },
};

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
};

const formatTime = (value) => {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
};

const minutesSince = (value) => {
  if (!value) return 'No signal';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60000)}m ago`;
};

const createBusIcon = (status, heading = 0) => {
  const meta = STATUS_META[status] || STATUS_META.active;
  const rotation = Number.isFinite(Number(heading)) ? Number(heading) : 0;

  return L.divIcon({
    className: '',
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    html: `
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        border: 4px solid #ffffff;
        background: ${meta.color};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.28);
      ">
        <span class="material-symbols-outlined" style="font-size: 20px; transform: rotate(${rotation}deg);">
          ${meta.icon}
        </span>
      </div>
    `,
  });
};

const normalizeFleetItem = (item) => ({
  ...item,
  currentLocation: item.currentLocation || {},
  route: item.route || {},
  driver: item.driver || null,
});

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.active;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  );
};

const KpiCard = ({ icon, label, value, tone }) => (
  <div className="flex h-28 flex-col justify-between rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className={`material-symbols-outlined rounded-xl p-2 text-lg ${tone}`}>{icon}</span>
    </div>
    <span className="text-3xl font-headline font-black text-primary">{value}</span>
  </div>
);

const FleetPopup = ({ bus }) => (
  <div className="min-w-64 space-y-3">
    <div>
      <p className="text-base font-black text-primary">
        {bus.vehicleCode || bus.plateNumber}
      </p>
      <p className="text-xs font-bold text-on-surface-variant">{bus.plateNumber}</p>
    </div>
    <StatusPill status={bus.operationalStatus} />
    <div className="grid grid-cols-2 gap-2 text-xs">
      <span><strong>Route</strong><br />{bus.route?.routeCode || 'N/A'} {bus.route?.routeName || ''}</span>
      <span><strong>Trip</strong><br />{bus.tripCode || bus.tripId}</span>
      <span><strong>Driver</strong><br />{bus.driver?.fullName || 'Unassigned'}</span>
      <span><strong>Status</strong><br />{bus.tripStatus}</span>
      <span><strong>Speed</strong><br />{Number(bus.speed || 0).toFixed(0)} km/h</span>
      <span><strong>Heading</strong><br />{bus.heading ?? 'N/A'}</span>
      <span><strong>Next stop</strong><br />{bus.nextStop?.name || 'N/A'}</span>
      <span><strong>Delay</strong><br />{bus.delayMinutes || 0} min</span>
    </div>
    <p className="text-xs text-on-surface-variant">GPS: {formatTime(bus.lastGpsAt)}</p>
  </div>
);

const FleetMap = ({ fleet, selectedId, onSelect }) => (
  <div className="h-[620px] overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
    <MapContainer
      center={DA_NANG_CENTER}
      className="h-full w-full"
      scrollWheelZoom
      zoom={13}
      zoomControl={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {fleet.map((bus) => {
        const lat = Number(bus.currentLocation?.lat);
        const lng = Number(bus.currentLocation?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return (
          <Marker
            key={bus.id}
            icon={createBusIcon(bus.operationalStatus, bus.heading)}
            position={[lat, lng]}
            title={`${bus.vehicleCode} ${bus.plateNumber}`}
            eventHandlers={{ click: () => onSelect(bus.id) }}
            zIndexOffset={bus.id === selectedId ? 1000 : 0}
          >
            <Popup>
              <FleetPopup bus={bus} />
            </Popup>
          </Marker>
        );
      })}
      <ZoomControl position="bottomright" />
    </MapContainer>
  </div>
);

const AdminFleetLocationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusedVehicleId = searchParams.get('vehicleId') || '';
  const [fleet, setFleet] = useState([]);
  const [kpis, setKpis] = useState({
    activeBuses: 0,
    delayedBuses: 0,
    lostSignalBuses: 0,
    incidentBuses: 0,
  });
  const [routes, setRoutes] = useState([]);
  const [filters, setFilters] = useState({ routeId: '', status: '', keyword: '', vehicleId: focusedVehicleId });
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const socketRef = useRef(null);

  const loadLocations = useCallback(async () => {
    const params = {
      routeId: filters.routeId || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
    };
    const result = await fleetMonitoringService.getLocations(params);
    setFleet((result.fleet || []).map(normalizeFleetItem));
    setKpis(result.kpis || {});
    setRoutes(result.filters?.routes || []);
    setLoading(false);
  }, [filters.keyword, filters.routeId, filters.status]);

  useEffect(() => {
    loadLocations().catch((error) => {
      setLoading(false);
      toast.error(error?.message || 'Unable to load fleet locations');
    });
  }, [loadLocations]);

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
    socket.on('server:fleet:locationUpdated', (payload) => {
      const next = normalizeFleetItem(payload);
      setFleet((current) => {
        const exists = current.some((item) => item.id === next.id);
        return exists
          ? current.map((item) => (item.id === next.id ? next : item))
          : [next, ...current];
      });
    });

    return () => {
      socket.emit('admin:fleet:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (socketConnected) return undefined;
    const timer = window.setInterval(() => {
      loadLocations().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadLocations, socketConnected]);

  const visibleFleet = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return fleet.filter((bus) => {
      const matchesVehicle = !filters.vehicleId || bus.vehicleId === filters.vehicleId;
      const matchesRoute = !filters.routeId || bus.routeId === filters.routeId;
      const matchesStatus = !filters.status || bus.operationalStatus === filters.status;
      const matchesKeyword = !keyword || [
        bus.vehicleCode,
        bus.plateNumber,
        bus.route?.routeCode,
        bus.route?.routeName,
        bus.driver?.fullName,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
      return matchesVehicle && matchesRoute && matchesStatus && matchesKeyword;
    });
  }, [filters, fleet]);

  const liveKpis = useMemo(() => ({
    activeBuses: fleet.filter((bus) => bus.operationalStatus === 'active').length || kpis.activeBuses || 0,
    delayedBuses: fleet.filter((bus) => bus.operationalStatus === 'delayed').length || kpis.delayedBuses || 0,
    lostSignalBuses: fleet.filter((bus) => bus.operationalStatus === 'lost_signal').length || kpis.lostSignalBuses || 0,
    incidentBuses: fleet.filter((bus) => bus.operationalStatus === 'incident').length || kpis.incidentBuses || 0,
  }), [fleet, kpis]);

  const selectedBus = visibleFleet.find((bus) => bus.id === selectedId) || visibleFleet[0] || null;

  useEffect(() => {
    if (!focusedVehicleId) return;
    setFilters((current) => ({ ...current, vehicleId: focusedVehicleId }));
  }, [focusedVehicleId]);

  useEffect(() => {
    if (!focusedVehicleId || selectedId) return;
    const match = fleet.find((bus) => bus.vehicleId === focusedVehicleId);
    if (match) setSelectedId(match.id);
  }, [fleet, focusedVehicleId, selectedId]);

  const handleSeedDemo = async () => {
    try {
      await fleetMonitoringService.seedDemoFleet();
      await loadLocations();
      toast.success('Demo fleet data is ready');
    } catch (error) {
      toast.error(error?.message || 'Unable to seed demo fleet');
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-black text-primary">Fleet Operations</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Real-time fleet location, vehicle health, and dispatch visibility across Da Nang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-black uppercase ${
            socketConnected
              ? 'bg-on-tertiary-container/10 text-on-tertiary-container'
              : 'bg-secondary-container text-secondary'
          }`}
          >
            <span className="material-symbols-outlined text-base">{socketConnected ? 'sensors' : 'sync'}</span>
            {socketConnected ? 'Live socket' : 'Polling fallback'}
          </span>
          <button
            type="button"
            onClick={handleSeedDemo}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-on-primary"
          >
            <span className="material-symbols-outlined text-base">add_location_alt</span>
            Demo Data
          </button>
        </div>
      </section>

      <nav
        aria-label="Fleet operations sections"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-outline-variant/30 bg-white/80 p-2 shadow-sm"
      >
        {FLEET_SECTIONS.map((section, index) => (
          <button
            key={section.path}
            type="button"
            onClick={() => navigate(section.path)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${
              index === 0
                ? 'bg-primary text-on-primary'
                : 'text-primary hover:bg-surface-container-low'
            }`}
            aria-current={index === 0 ? 'page' : undefined}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </nav>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="directions_bus" label="Active buses" value={liveKpis.activeBuses} tone="bg-on-tertiary-container/10 text-on-tertiary-container" />
        <KpiCard icon="schedule" label="Delayed buses" value={liveKpis.delayedBuses} tone="bg-secondary-container text-secondary" />
        <KpiCard icon="signal_disconnected" label="Lost signal" value={liveKpis.lostSignalBuses} tone="bg-surface-container-high text-on-surface-variant" />
        <KpiCard icon="warning" label="Incidents" value={liveKpis.incidentBuses} tone="bg-error-container text-on-error-container" />
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Route</span>
            <select
              value={filters.routeId}
              onChange={(event) => setFilters((current) => ({ ...current, routeId: event.target.value }))}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
            >
              <option value="">All routes</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.routeCode} {route.routeName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Vehicle</span>
            <select
              value={filters.vehicleId}
              onChange={(event) => setFilters((current) => ({ ...current, vehicleId: event.target.value }))}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
            >
              <option value="">All vehicles</option>
              {fleet.map((bus) => (
                <option key={bus.vehicleId} value={bus.vehicleId}>
                  {bus.vehicleCode} - {bus.plateNumber}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Plate search</span>
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
              placeholder="43A, DN-DEMO, driver..."
            />
          </label>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {loading ? (
          <div className="flex h-[620px] items-center justify-center rounded-2xl border border-outline-variant/10 bg-surface-container-lowest text-sm font-bold text-on-surface-variant">
            Loading fleet map...
          </div>
        ) : (
          <FleetMap fleet={visibleFleet} selectedId={selectedBus?.id} onSelect={setSelectedId} />
        )}

        <aside className="space-y-4">
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-headline text-lg font-black text-primary">Visible Fleet</h2>
              <span className="text-xs font-bold text-on-tertiary-container">{visibleFleet.length} buses</span>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {visibleFleet.map((bus) => (
                <button
                  key={bus.id}
                  type="button"
                  onClick={() => setSelectedId(bus.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedBus?.id === bus.id
                      ? 'border-on-tertiary-container bg-on-tertiary-container/10'
                      : 'border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-primary">{bus.vehicleCode}</p>
                      <p className="text-xs text-on-surface-variant">{bus.plateNumber}</p>
                    </div>
                    <StatusPill status={bus.operationalStatus} />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {bus.route?.routeCode || 'No route'} · {Number(bus.speed || 0).toFixed(0)} km/h · {minutesSince(bus.lastGpsAt)}
                  </p>
                </button>
              ))}
              {!visibleFleet.length ? (
                <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  No buses match the current filters.
                </p>
              ) : null}
            </div>
          </div>

          {selectedBus ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-headline text-lg font-black text-primary">{selectedBus.vehicleCode}</h2>
                  <p className="text-xs font-bold text-on-surface-variant">{selectedBus.plateNumber}</p>
                </div>
                <StatusPill status={selectedBus.operationalStatus} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs font-bold uppercase text-on-surface-variant">Route</dt><dd className="font-semibold text-primary">{selectedBus.route?.routeCode || 'N/A'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-on-surface-variant">Trip</dt><dd className="font-semibold text-primary">{selectedBus.tripCode || selectedBus.tripId}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-on-surface-variant">Driver</dt><dd className="font-semibold text-primary">{selectedBus.driver?.fullName || 'Unassigned'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-on-surface-variant">Trip status</dt><dd className="font-semibold text-primary">{selectedBus.tripStatus}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-on-surface-variant">Speed</dt><dd className="font-semibold text-primary">{Number(selectedBus.speed || 0).toFixed(0)} km/h</dd></div>
                <div><dt className="text-xs font-bold uppercase text-on-surface-variant">Delay</dt><dd className="font-semibold text-primary">{selectedBus.delayMinutes || 0} min</dd></div>
                <div className="col-span-2"><dt className="text-xs font-bold uppercase text-on-surface-variant">Next stop</dt><dd className="font-semibold text-primary">{selectedBus.nextStop?.name || 'N/A'}</dd></div>
                <div className="col-span-2"><dt className="text-xs font-bold uppercase text-on-surface-variant">Last GPS</dt><dd className="font-semibold text-primary">{formatTime(selectedBus.lastGpsAt)} ({minutesSince(selectedBus.lastGpsAt)})</dd></div>
              </dl>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
};

export default AdminFleetLocationPage;
