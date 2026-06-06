import React, { useMemo } from 'react';
import { DA_NANG_BOUNDS } from '../../pages/routes/routeWorkflowUtils.js';

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 520;

const getStopLabel = (stop, index) => stop?.stopName || stop?.stationName || `Diem dung ${index + 1}`;

const toPoint = (item) => ({
  latitude: Number(item?.latitude),
  longitude: Number(item?.longitude),
});

const isValidPoint = (point) => (
  Number.isFinite(point.latitude)
  && Number.isFinite(point.longitude)
);

const RouteMapEditor = ({
  activeDirection,
  direction = {},
  isDarkMode = false,
  routeColor = '#10b981',
  stations = [],
  showStationLayer = false,
  onAddMapStop,
  onAddStationStop,
  onSelectStop,
  onUpdateStop,
  routingStatus = 'idle',
  selectedStopIndex,
}) => {
  const stops = Array.isArray(direction.orderedStops) ? direction.orderedStops : [];
  const path = Array.isArray(direction.polylinePath) && direction.polylinePath.length >= 2
    ? direction.polylinePath
    : stops;

  const bounds = useMemo(() => {
    const points = [...stops, ...path, ...stations].map(toPoint).filter(isValidPoint);
    if (!points.length) {
      return {
        minLat: DA_NANG_BOUNDS[0][0],
        maxLat: DA_NANG_BOUNDS[1][0],
        minLng: DA_NANG_BOUNDS[0][1],
        maxLng: DA_NANG_BOUNDS[1][1],
      };
    }

    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latPadding = Math.max((maxLat - minLat) * 0.22, 0.01);
    const lngPadding = Math.max((maxLng - minLng) * 0.22, 0.01);

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    };
  }, [path, stations, stops]);

  const project = (point) => {
    const latitude = Number(point?.latitude);
    const longitude = Number(point?.longitude);
    const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.00001);
    const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.00001);

    return {
      x: ((longitude - bounds.minLng) / lngRange) * DEFAULT_WIDTH,
      y: DEFAULT_HEIGHT - (((latitude - bounds.minLat) / latRange) * DEFAULT_HEIGHT),
    };
  };

  const routePoints = path.map(toPoint).filter(isValidPoint).map(project);
  const routePolyline = routePoints.map((point) => `${point.x},${point.y}`).join(' ');
  const mapClassName = isDarkMode
    ? 'border-white/10 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-slate-50 text-slate-900';

  const handleMapClick = (event) => {
    if (!onAddMapStop || !activeDirection) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const longitude = bounds.minLng + ((bounds.maxLng - bounds.minLng) * xRatio);
    const latitude = bounds.maxLat - ((bounds.maxLat - bounds.minLat) * yRatio);

    onAddMapStop(activeDirection, { lat: latitude, lng: longitude });
  };

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
            Bam vao ban do de them diem dung thu cong, chon diem dung de xem va dieu chinh toa do.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{stops.length} diem dung</span>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">{direction.estimatedDistanceKm || 0} km</span>
          {routingStatus === 'loading' ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Dang tinh duong</span> : null}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <button
          type="button"
          onClick={handleMapClick}
          className="relative block min-h-[360px] cursor-crosshair overflow-hidden bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_55%,#dcfce7_100%)] text-left"
          aria-label="Them diem dung tren ban do"
        >
          <svg viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`} className="absolute inset-0 h-full w-full">
            <defs>
              <pattern id="route-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={DEFAULT_WIDTH} height={DEFAULT_HEIGHT} fill="url(#route-grid)" />
            {routePolyline ? (
              <polyline
                points={routePolyline}
                fill="none"
                stroke={routeColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="8"
              />
            ) : null}
            {showStationLayer ? stations.map((station) => {
              const point = toPoint(station);
              if (!isValidPoint(point)) return null;
              const projected = project(point);
              return (
                <g key={station._id || `${station.latitude}-${station.longitude}`}>
                  <circle cx={projected.x} cy={projected.y} r="8" fill="#0ea5e9" opacity="0.42" />
                </g>
              );
            }) : null}
            {stops.map((stop, index) => {
              const point = toPoint(stop);
              if (!isValidPoint(point)) return null;
              const projected = project(point);
              const selected = selectedStopIndex === index;
              return (
                <g key={`${getStopLabel(stop, index)}-${index}`}>
                  <circle
                    cx={projected.x}
                    cy={projected.y}
                    r={selected ? 18 : 15}
                    fill={selected ? '#f59e0b' : '#022c22'}
                    stroke="#ffffff"
                    strokeWidth="5"
                  />
                  <text
                    x={projected.x}
                    y={projected.y + 5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="800"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </button>

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
    </div>
  );
};

export default RouteMapEditor;
