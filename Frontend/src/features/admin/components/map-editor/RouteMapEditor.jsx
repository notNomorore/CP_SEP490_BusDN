import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DA_NANG_BOUNDS } from '../../pages/routes/routeWorkflowUtils.js';

const DA_NANG_CENTER = [16.0544, 108.2022];

const getStopLabel = (stop, index) => stop?.stopName || stop?.stationName || `Diem dung ${index + 1}`;

const toPoint = (item) => ({
  latitude: Number(item?.latitude),
  longitude: Number(item?.longitude),
});

const bearingDeg = (fromPoint, toPoint) => {
  const [fromLat, fromLng] = fromPoint.map(Number);
  const [toLat, toLng] = toPoint.map(Number);
  return (Math.atan2(toLng - fromLng, toLat - fromLat) * 180) / Math.PI;
};

const arrowIcon = (color, angle) => L.divIcon({
  className: '',
  html: `
    <div class="route-map-editor-arrow" style="--route-arrow-color: ${color}; transform: rotate(${angle}deg);">
      <span class="material-symbols-outlined">navigation</span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const toLatLng = (item) => {
  const point = toPoint(item);
  return isValidPoint(point) ? [point.latitude, point.longitude] : null;
};

const createStopIcon = (index, selected = false) => L.divIcon({
  className: '',
  html: `
    <div style="
      width:${selected ? 32 : 28}px;
      height:${selected ? 32 : 28}px;
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:${selected ? '#f59e0b' : '#022c22'};
      color:#ffffff;
      border:3px solid #ffffff;
      box-shadow:0 10px 22px rgba(2,44,34,.26);
      font-size:13px;
      font-weight:900;
    ">${index + 1}</div>
  `,
  iconSize: [selected ? 32 : 28, selected ? 32 : 28],
  iconAnchor: [selected ? 16 : 14, selected ? 16 : 14],
});

const stationIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:18px;
      height:18px;
      border-radius:999px;
      background:#0ea5e9;
      border:3px solid #ffffff;
      box-shadow:0 8px 18px rgba(14,165,233,.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const FitRouteBounds = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (positions.length === 1) {
        map.setView(positions[0], 15);
        return;
      }
      if (positions.length > 1) {
        map.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 15 });
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [map, positions]);

  return null;
};

const MapClickHandler = ({ activeDirection, onAddMapStop }) => {
  useMapEvents({
    click(event) {
      if (!onAddMapStop || !activeDirection) return;
      onAddMapStop(activeDirection, event.latlng);
    },
  });

  return null;
};

const RouteMapEditor = ({
  activeDirection,
  direction,
  isDarkMode,
  routeColor,
  stations,
  showStationLayer,
  onAddMapStop,
  onAddStationStop,
  onSelectStop,
  onUpdateStop,
  routingStatus,
  selectedStopIndex,
}) => {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const activeDirectionRef = useRef(activeDirection);
  const addMapStopRef = useRef(onAddMapStop);

  const stopPositions = useMemo(() => stops.map(toLatLng).filter(Boolean), [stops]);
  const routePositions = useMemo(() => path.map(toLatLng).filter(Boolean), [path]);
  const stationPositions = useMemo(() => stations.map(toLatLng).filter(Boolean), [stations]);
  const fitPositions = routePositions.length ? routePositions : stopPositions;

  const mapClassName = isDarkMode
    ? 'border-white/10 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-slate-50 text-slate-900';

  const moveStop = (index, patch) => {
    if (!onUpdateStop || !activeDirection) return;
    onUpdateStop(activeDirection, index, patch);
  };

  return (
    <div className={`overflow-hidden rounded-2xl border ${mapClassName}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
        <div>
          <p className="text-sm font-black">Ban do lo trinh</p>
          <p className="mt-1 text-xs text-slate-500">
            Bam vao ban do de them diem dung thu cong, keo marker de chinh toa do.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{stops.length} diem dung</span>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">{direction.estimatedDistanceKm || 0} km</span>
          {routingStatus === 'loading' ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Dang tinh duong</span> : null}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[460px] overflow-hidden bg-slate-100">
          <MapContainer
            center={fitPositions[0] || DA_NANG_CENTER}
            zoom={13}
            minZoom={11}
            maxBounds={DA_NANG_BOUNDS}
            scrollWheelZoom
            className="h-[460px] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler activeDirection={activeDirection} onAddMapStop={onAddMapStop} />
            <FitRouteBounds positions={fitPositions} />

            {routePositions.length > 1 ? (
              <Polyline
                positions={routePositions}
                pathOptions={{ color: routeColor, weight: 7, opacity: 0.9 }}
              />
            ) : null}

            {showStationLayer ? stations.map((station) => {
              const position = toLatLng(station);
              if (!position) return null;
              return (
                <Marker
                  key={station._id || `${station.latitude}-${station.longitude}`}
                  position={position}
                  icon={stationIcon}
                  eventHandlers={{
                    click: () => onAddStationStop?.(activeDirection, station),
                  }}
                >
                  <Popup>
                    <strong>{station.stationName || station.stopName}</strong>
                    <br />
                    {station.address}
                  </Popup>
                </Marker>
              );
            }) : null}

            {stops.map((stop, index) => {
              const position = toLatLng(stop);
              if (!position) return null;
              const selected = selectedStopIndex === index;

              return (
                <Marker
                  key={`${getStopLabel(stop, index)}-${index}`}
                  position={position}
                  icon={createStopIcon(index, selected)}
                  draggable={Boolean(onUpdateStop && activeDirection)}
                  eventHandlers={{
                    click: () => onSelectStop?.(index),
                    dragend: (event) => {
                      const next = event.target.getLatLng();
                      moveStop(index, { latitude: next.lat, longitude: next.lng });
                    },
                  }}
                >
                  <Popup>
                    <strong>#{index + 1} {getStopLabel(stop, index)}</strong>
                    <br />
                    {Number(stop.latitude).toFixed(6)}, {Number(stop.longitude).toFixed(6)}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <aside className="border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Diem dung</h4>
            <span className="text-xs font-bold text-slate-400">Theo thu tu tuyen</span>
          </div>

          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {stops.length ? stops.map((stop, index) => (
              <button
                key={`${getStopLabel(stop, index)}-${index}`}
                type="button"
                onClick={() => onSelectStop?.(index)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  selectedStopIndex === index
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-slate-50 hover:border-emerald-300'
                }`}
              >
                <span className="text-xs font-black text-emerald-700">#{index + 1}</span>
                <span className="ml-2 font-bold text-slate-950">{getStopLabel(stop, index)}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {Number(stop.latitude).toFixed(6)}, {Number(stop.longitude).toFixed(6)}
                </span>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                Chua co diem dung nao tren tuyen.
              </div>
            )}
          </div>

          {selectedStopIndex !== null && stops[selectedStopIndex] ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Chinh toa do</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.000001"
                  value={stops[selectedStopIndex].latitude}
                  onChange={(event) => moveStop(selectedStopIndex, { latitude: Number(event.target.value) })}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                  aria-label="Latitude"
                />
                <input
                  type="number"
                  step="0.000001"
                  value={stops[selectedStopIndex].longitude}
                  onChange={(event) => moveStop(selectedStopIndex, { longitude: Number(event.target.value) })}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                  aria-label="Longitude"
                />
              </div>
            </div>
          ) : null}

          {showStationLayer && stations.length ? (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tram tim thay</p>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                {stations.slice(0, 8).map((station) => (
                  <button
                    key={station._id || `${station.latitude}-${station.longitude}`}
                    type="button"
                    onClick={() => onAddStationStop?.(activeDirection, station)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-cyan-300"
                  >
                    <strong className="block text-slate-900">{station.stationName || station.stopName}</strong>
                    <span className="text-slate-500">{station.address}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
      {routingStatus !== 'idle' ? (
        <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-white/20 bg-slate-950/75 px-4 py-3 text-xs font-semibold text-white shadow-lg">
          {routingStatus === 'loading' ? 'Đang bám theo mạng lưới đường phố...' : null}
          {routingStatus === 'ready' ? 'Đã bám theo đường thật và hướng một chiều.' : null}
          {routingStatus === 'error' ? 'Không lấy được lộ trình, kiểm tra kết nối OSRM.' : null}
        </div>
      ) : null}
      <style>{`
        .route-map-editor-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 2px solid #fff;
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
        }
        .route-map-editor-marker-route { background: ${routeColor || '#10b981'}; color: #052e24; }
        .route-map-editor-marker-station { background: #22d3ee; color: #083344; }
        .route-map-editor-marker-selected { transform: scale(1.18); box-shadow: 0 0 0 8px rgba(20,184,166,0.18); }
        .route-map-editor-marker .material-symbols-outlined {
          font-size: 17px;
          font-variation-settings: 'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24;
        }
        .route-map-editor-marker-route span:not(.material-symbols-outlined) {
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
        }
        .route-map-editor-arrow {
          align-items: center;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 999px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
          color: var(--route-arrow-color);
          display: flex;
          height: 24px;
          justify-content: center;
          width: 24px;
        }
        .route-map-editor-arrow .material-symbols-outlined {
          font-size: 17px;
          font-variation-settings: 'FILL' 1, 'wght' 900, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>
    </div>
  );
};

export default RouteMapEditor;
