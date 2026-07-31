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
  stations = [],
  showStationLayer,
  onAddMapStop,
  onAddStationStop,
  onSelectStop,
  onUpdateStop,
  routingStatus = 'idle',
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
        addMapStopRef.current?.(activeDirectionRef.current, event.latlng);
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
        draggable: Boolean(onUpdateStop && activeDirection),
        title: stop.stopName,
      });

      marker.bindTooltip(`${index + 1}. ${stop.stopName || 'Diem dung'}`);
      marker.on('click', () => onSelectStop?.(index));
      marker.on('dragend', (event) => {
        const { lat, lng } = event.target.getLatLng();
        if (isInsideDaNang(lat, lng)) {
          onUpdateStop?.(activeDirection, index, { latitude: lat, longitude: lng });
        } else {
          marker.setLatLng([Number(stop.latitude), Number(stop.longitude)]);
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
          marker.on('click', () => onAddStationStop?.(activeDirection, station));
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
        Bam ban do de them diem dung. Keo marker de chinh vi tri.
      </div>
      {routingStatus !== 'idle' ? (
        <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-white/20 bg-slate-950/75 px-4 py-3 text-xs font-semibold text-white shadow-lg">
          {routingStatus === 'loading' ? 'Dang tinh lo trinh...' : null}
          {routingStatus === 'ready' ? 'Da cap nhat lo trinh theo duong thuc.' : null}
          {routingStatus === 'error' ? 'Khong lay duoc lo trinh, vui long kiem tra ket noi OSRM.' : null}
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
