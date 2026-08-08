import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import fleetMonitoringService from '../services/fleetMonitoringService.js';
import { acquireFleetSocket, releaseFleetSocket } from '../services/fleetSocket.js';
import toast from '../../../../shared/utils/toast.js';
import adminService from '../../services/adminService.js';
import { FleetOperationsPanel } from '../../pages/routes/RouteWorkflowPage.jsx';

const DA_NANG_CENTER = [16.0544, 108.2022];
const POLL_INTERVAL_MS = 20000;

const STATUS_META = {
  available: { label: 'Sẵn sàng', color: '#0891b2', icon: 'check_circle' },
  active: { label: 'Đang hoạt động', color: '#059669', icon: 'directions_bus' },
  incident: { label: 'Gặp sự cố', color: '#dc2626', icon: 'warning' },
  maintenance: { label: 'Đang bảo trì', color: '#7c3aed', icon: 'build' },
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

const isDemoFleetItem = (item) => [
  item?.vehicleCode,
  item?.plateNumber,
  item?.route?.routeCode,
  item?.route?.routeName,
  item?.driver?.fullName,
].some((value) => /DEMO|^DN-AUTO-/i.test(String(value || '')));

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

const SelectedRoute = ({ bus }) => {
  const map = useMap();
  const positions = useMemo(() => (bus?.routePath || [])
    .map((point) => [Number(point.lat), Number(point.lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)), [bus]);

  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 15 });
  }, [map, positions]);

  if (positions.length < 2) return null;
  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
      <Polyline positions={positions} pathOptions={{ color: '#059669', weight: 5, opacity: 0.95 }} />
      {(bus?.routeStops || []).map((stop, index, stops) => {
        const lat = Number(stop.lat);
        const lng = Number(stop.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const isStart = stop.isStart || index === 0;
        const isEnd = stop.isEnd || index === stops.length - 1;
        const color = isStart ? '#16a34a' : isEnd ? '#dc2626' : '#0284c7';
        return (
          <CircleMarker
            key={`${stop.id || stop.name}-${index}`}
            center={[lat, lng]}
            radius={isStart || isEnd ? 8 : 6}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="min-w-40">
                <strong>{isStart ? 'Điểm đầu' : isEnd ? 'Điểm cuối' : `Trạm ${stop.order || index + 1}`}</strong>
                <div>{stop.name}</div>
                {stop.address ? <small>{stop.address}</small> : null}
              </div>
            </Tooltip>
            <Popup>
              <div className="min-w-48 space-y-1">
                <strong>{stop.name}</strong>
                <div>{isStart ? 'Điểm xuất phát' : isEnd ? 'Điểm kết thúc' : `Thứ tự trạm: ${stop.order || index + 1}`}</div>
                {stop.address ? <div>{stop.address}</div> : null}
                {stop.arrivalOffsetMinutes !== null && stop.arrivalOffsetMinutes !== undefined
                  ? <div>Dự kiến sau {stop.arrivalOffsetMinutes} phút</div>
                  : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

const FleetMap = ({ fleet, selectedId, onSelect }) => {
  const selectedBus = fleet.find((bus) => bus.id === selectedId) || null;
  return (
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
      <SelectedRoute bus={selectedBus} />
      {fleet.map((bus) => {
        if (!['active', 'incident'].includes(bus.operationalStatus)) return null;
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
};

const AdminFleetLocationPage = () => {
  const [searchParams] = useSearchParams();
  const focusedVehicleId = searchParams.get('vehicleId') || '';
  const [fleet, setFleet] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [filters, setFilters] = useState({ routeId: '', status: '', keyword: '', vehicleId: focusedVehicleId });
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [managedBuses, setManagedBuses] = useState([]);

  const loadManagedBuses = useCallback(async () => {
    const response = await adminService.getBuses();
    setManagedBuses(response.buses || []);
  }, []);

  const loadLocations = useCallback(async () => {
    const params = {
      routeId: filters.routeId || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
    };
    const result = await fleetMonitoringService.getLocations(params);
    setFleet((result.fleet || []).filter((item) => !isDemoFleetItem(item)).map(normalizeFleetItem));
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
    const socket = acquireFleetSocket();
    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('admin:fleet:subscribe');
    };
    const handleDisconnect = () => setSocketConnected(false);
    const handleLocationUpdated = (payload) => {
      if (isDemoFleetItem(payload)) return;
      const next = normalizeFleetItem(payload);
      setFleet((current) => {
        const exists = current.some((item) => item.id === next.id);
        return exists
          ? current.map((item) => (item.id === next.id ? next : item))
          : [next, ...current];
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('server:fleet:locationUpdated', handleLocationUpdated);
    socket.on('server:incident:new', loadLocations);
    socket.on('server:vehicleIssue:emergencyReported', loadLocations);
    socket.on('server:vehicleIssue:reported', loadLocations);
    socket.on('server:maintenance:taskUpdated', loadLocations);
    socket.on('server:maintenance:approvalUpdated', loadLocations);
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.off('server:fleet:locationUpdated', handleLocationUpdated);
      socket.off('server:incident:new', loadLocations);
      socket.off('server:vehicleIssue:emergencyReported', loadLocations);
      socket.off('server:vehicleIssue:reported', loadLocations);
      socket.off('server:maintenance:taskUpdated', loadLocations);
      socket.off('server:maintenance:approvalUpdated', loadLocations);
      setSocketConnected(false);
      releaseFleetSocket();
    };
  }, [loadLocations]);

  useEffect(() => {
    loadManagedBuses().catch(() => toast.error('Không thể tải danh sách xe quản lý.'));
  }, [loadManagedBuses]);

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
      if (isDemoFleetItem(bus)) return false;
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

  const displayManagedBuses = useMemo(() => {
    const activeVehicleKeys = new Set(fleet
      .filter((item) => item.operationalStatus === 'active')
      .flatMap((item) => [item.vehicleCode, item.plateNumber])
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean));
    return managedBuses.map((bus) => {
      if (['ISSUE', 'MAINTENANCE'].includes(bus.status)) return bus;
      const isRunning = [bus.busCode, bus.plateNumber]
        .some((value) => activeVehicleKeys.has(String(value || '').trim().toUpperCase()));
      return { ...bus, status: isRunning ? 'ACTIVE' : 'AVAILABLE' };
    });
  }, [fleet, managedBuses]);

  const liveKpis = useMemo(() => ({
    activeBuses: displayManagedBuses.filter((bus) => bus.status === 'ACTIVE').length,
    availableBuses: displayManagedBuses.filter((bus) => bus.status === 'AVAILABLE').length,
    maintenanceBuses: displayManagedBuses.filter((bus) => bus.status === 'MAINTENANCE').length,
    incidentBuses: displayManagedBuses.filter((bus) => bus.status === 'ISSUE').length,
  }), [displayManagedBuses]);

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
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="check_circle" label="Xe sẵn sàng" value={liveKpis.availableBuses} tone="bg-cyan-100 text-cyan-700" />
        <KpiCard icon="directions_bus" label="Xe đang hoạt động" value={liveKpis.activeBuses} tone="bg-on-tertiary-container/10 text-on-tertiary-container" />
        <KpiCard icon="warning" label="Xe gặp sự cố" value={liveKpis.incidentBuses} tone="bg-error-container text-on-error-container" />
        <KpiCard icon="build" label="Xe đang bảo trì" value={liveKpis.maintenanceBuses} tone="bg-violet-100 text-violet-700" />
      </section>

      <section>
        <FleetOperationsPanel
          buses={displayManagedBuses}
          onSaved={async () => {
            await Promise.all([loadManagedBuses(), loadLocations()]);
          }}
        />
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
              placeholder="Biển số, mã xe, tài xế..."
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
