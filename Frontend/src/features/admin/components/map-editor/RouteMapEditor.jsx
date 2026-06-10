<<<<<<< HEAD
import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DA_NANG_BOUNDS,
  DA_NANG_CENTER,
  isInsideDaNang,
} from '../../pages/routes/routeWorkflowUtils.js';

const markerIcon = (tone = 'route', selected = false, label = '') => L.divIcon({
  className: '',
  html: `
    <div class="route-map-editor-marker route-map-editor-marker-${tone} ${selected ? 'route-map-editor-marker-selected' : ''}">
      ${tone === 'station' ? '<span class="material-symbols-outlined">directions_bus</span>' : `<span>${label}</span>`}
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 27],
  popupAnchor: [0, -24],
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

const RouteMapEditor = ({
  activeDirection,
  direction,
  isDarkMode,
  routeColor,
  stations,
  showStationLayer,
=======
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
>>>>>>> origin/MinhHai
  onAddMapStop,
  onAddStationStop,
  onSelectStop,
  onUpdateStop,
<<<<<<< HEAD
  routingStatus,
  selectedStopIndex,
}) => {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const activeDirectionRef = useRef(activeDirection);
  const addMapStopRef = useRef(onAddMapStop);

  const stops = useMemo(() => (
    (direction?.orderedStops || []).filter((stop) => isInsideDaNang(stop.latitude, stop.longitude))
  ), [direction?.orderedStops]);
  const routedPoints = useMemo(() => (
    Array.isArray(direction?.polylinePath)
      ? direction.polylinePath
        .filter((point) => isInsideDaNang(point.latitude, point.longitude))
        .map((point) => [Number(point.latitude), Number(point.longitude)])
      : []
  ), [direction?.polylinePath]);

  useEffect(() => {
    activeDirectionRef.current = activeDirection;
    addMapStopRef.current = onAddMapStop;
  }, [activeDirection, onAddMapStop]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(elementRef.current, {
      center: DA_NANG_CENTER,
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true,
      maxBounds: DA_NANG_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: 10,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (event) => {
      if (isInsideDaNang(event.latlng.lat, event.latlng.lng)) {
        addMapStopRef.current(activeDirectionRef.current, event.latlng);
      }
    });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });

    window.setTimeout(() => map.invalidateSize(), 80);
    window.setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) {
      return;
    }

    const layer = layerRef.current;
    const bounds = [];
    layer.clearLayers();

    L.rectangle(DA_NANG_BOUNDS, {
      color: '#14b8a6',
      weight: 1,
      opacity: 0.45,
      fillOpacity: 0,
      dashArray: '6 8',
    }).addTo(layer);

    const stopPoints = stops.map((stop) => [Number(stop.latitude), Number(stop.longitude)]);
    const routePoints = routedPoints.length >= 2 ? routedPoints : stopPoints;
    if (routePoints.length >= 2) {
      L.polyline(routePoints, {
        color: routeColor || '#10b981',
        weight: 5,
        opacity: 0.9,
      }).addTo(layer);
      const arrowStep = Math.max(8, Math.floor(routePoints.length / 6));
      for (let pointIndex = arrowStep; pointIndex < routePoints.length; pointIndex += arrowStep) {
        const previousPoint = routePoints[pointIndex - 1];
        const currentPoint = routePoints[pointIndex];
        L.marker(currentPoint, {
          icon: arrowIcon(routeColor || '#10b981', bearingDeg(previousPoint, currentPoint)),
          interactive: false,
        }).addTo(layer);
      }
      bounds.push(...routePoints);
    }

    stops.forEach((stop, index) => {
      const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
        icon: markerIcon('route', index === selectedStopIndex, String(index + 1)),
        draggable: true,
        title: stop.stopName,
      });

      marker.bindTooltip(`${index + 1}. ${stop.stopName || 'Điểm dừng'}`);
      marker.on('click', () => onSelectStop(index));
      marker.on('dragend', (event) => {
        const { lat, lng } = event.target.getLatLng();
        if (isInsideDaNang(lat, lng)) {
          onUpdateStop(activeDirection, index, { latitude: lat, longitude: lng });
        }
      });
      marker.addTo(layer);
      bounds.push([Number(stop.latitude), Number(stop.longitude)]);
    });

    if (showStationLayer) {
      stations
        .filter((station) => isInsideDaNang(station.latitude, station.longitude))
        .slice(0, 120)
        .forEach((station) => {
          const marker = L.marker([Number(station.latitude), Number(station.longitude)], {
            icon: markerIcon('station', false),
            title: station.stationName,
          });
          marker.bindPopup(`<strong>${station.stationName || ''}</strong><br/>${station.address || ''}`);
          marker.on('click', () => onAddStationStop(activeDirection, station));
          marker.addTo(layer);
        });
    }

    if (bounds.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (bounds.length === 1) {
      mapRef.current.setView(bounds[0], 15);
    } else {
      mapRef.current.fitBounds(DA_NANG_BOUNDS, { padding: [20, 20] });
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
  }, [
    activeDirection,
    onAddStationStop,
    onSelectStop,
    onUpdateStop,
    routeColor,
    routedPoints,
    selectedStopIndex,
    showStationLayer,
    stations,
    stops,
  ]);

  return (
    <div className={`relative h-[640px] min-h-[520px] w-full overflow-hidden rounded-2xl border ${isDarkMode ? 'border-white/10 bg-[#071416]' : 'border-slate-200 bg-slate-100'}`}>
      <div ref={elementRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/20 bg-slate-950/75 px-4 py-3 text-xs font-semibold text-white shadow-lg">
        Bấm bản đồ để thêm điểm dừng. Kéo marker để chỉnh vị trí.
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
=======
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
>>>>>>> origin/MinhHai
    </div>
  );
};

export default RouteMapEditor;
