import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import routeService from '../services/routeService';
import useAuthStore from '../../auth/stores/authStore';
import Header from '../../../shared/components/navigation/Header';
import {
  DA_NANG_MAP_CONFIG,
  isInsideDaNang,
} from '../../../shared/config/mapConfig.js';

const {
  bounds: DA_NANG_BOUNDS,
  center: DA_NANG_CENTER,
  initialZoom: INITIAL_MAP_ZOOM,
  minZoom: MIN_MAP_ZOOM,
  maxZoom: MAX_MAP_ZOOM,
  routeFitMaxZoom: ROUTE_FIT_MAX_ZOOM,
  maxBoundsViscosity: MAX_BOUNDS_VISCOSITY,
  tileUrl: MAP_TILE_URL,
  tileAttribution: MAP_TILE_ATTRIBUTION,
} = DA_NANG_MAP_CONFIG;
const DEFAULT_CENTER = {
  latitude: DA_NANG_CENTER[0],
  longitude: DA_NANG_CENTER[1],
};
const DA_NANG_CENTRAL = { name: 'Da Nang Central', latitude: 16.0667, longitude: 108.1690 };
const MAP_UI = {
  bus: '#059669',
  busDark: '#047857',
  busHalo: '#ffffff',
  walk: '#2563eb',
  transfer: '#f59e0b',
  origin: '#0284c7',
  destination: '#dc2626',
  board: '#059669',
  alight: '#ea580c',
  ink: '#0f172a',
  muted: '#64748b',
};

const formatDuration = (minutes) => {
  const normalizedMinutes = Math.max(Math.round(Number(minutes) || 0), 0);
  const hours = Math.floor(normalizedMinutes / 60);
  const remainder = normalizedMinutes % 60;

  if (!hours) {
    return `${remainder} min`;
  }

  return `${hours}h ${remainder}m`;
};

const formatVietnameseDuration = (minutes) => {
  const normalizedMinutes = Math.max(Math.round(Number(minutes) || 0), 0);
  const hours = Math.floor(normalizedMinutes / 60);
  const remainder = normalizedMinutes % 60;

  if (!hours) {
    return `${remainder} phút`;
  }

  return remainder ? `${hours} giờ ${remainder} phút` : `${hours} giờ`;
};

const formatMeters = (meters) => {
  const value = Math.max(Math.round(Number(meters) || 0), 0);
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  }

  return `${value} m`;
};

const formatTimeFromOffset = (offsetMinutes = 0, baseDate = new Date()) => {
  const nextTime = new Date(baseDate.getTime() + Math.round(Number(offsetMinutes) || 0) * 60 * 1000);
  return nextTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const formatFare = (fare) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(fare);

const toRadians = (degrees) => degrees * (Math.PI / 180);

const calculateDistanceKm = (start, end) => {
  if (!isValidLocation(start) || !isValidLocation(end)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLng = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const addMinutesToTime = (time, minutesToAdd) => {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const nextHours = Math.floor(totalMinutes / 60) % 24;
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const getRouteCenter = (route) => {
  const stops = route?.stops?.length ? route.stops : [];
  const validStops = stops.filter((stop) => (
    typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
  ));

  if (!validStops.length) {
    return DEFAULT_CENTER;
  }

  return {
    latitude: validStops.reduce((total, stop) => total + stop.latitude, 0) / validStops.length,
    longitude: validStops.reduce((total, stop) => total + stop.longitude, 0) / validStops.length,
  };
};

const toLatLng = ({ latitude, longitude }) => [latitude, longitude];

const isValidLocation = (location) => (
  typeof location?.latitude === 'number'
  && typeof location?.longitude === 'number'
  && isInsideDaNang(location.latitude, location.longitude)
);

const normalizeStopLocation = (stop) => {
  if (stop.name === DA_NANG_CENTRAL.name) {
    return {
      ...stop,
      latitude: DA_NANG_CENTRAL.latitude,
      longitude: DA_NANG_CENTRAL.longitude,
    };
  }

  return stop;
};

const stationToLocation = (station) => ({
  latitude: Number(station?.latitude),
  longitude: Number(station?.longitude),
  name: station?.stationName || station?.stopName || station?.address || '',
});

const geometryToLatLngs = (geometry) => {
  if (!geometry?.coordinates?.length) {
    return [];
  }

  if (geometry.type === 'LineString') {
    return geometry.coordinates
      .map(([longitude, latitude]) => ({ latitude: Number(latitude), longitude: Number(longitude) }))
      .filter(isValidLocation)
      .map(toLatLng);
  }

  return [];
};

const getLegGeometryPositions = (leg) => geometryToLatLngs(leg?.geometry);

const toDegrees = (radians) => radians * (180 / Math.PI);

const distanceBetweenLatLngs = ([latA, lngA], [latB, lngB]) => {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const bearingBetweenLatLngs = ([latA, lngA], [latB, lngB]) => {
  const startLat = toRadians(latA);
  const endLat = toRadians(latB);
  const deltaLng = toRadians(lngB - lngA);
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat)
    - Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const interpolateLatLng = ([latA, lngA], [latB, lngB], ratio) => [
  latA + (latB - latA) * ratio,
  lngA + (lngB - lngA) * ratio,
];

const createDirectionArrowIcon = (color = '#047857', bearing = 0) => L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `
    <div class="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/90 bg-white/90 shadow-sm">
      <span style="
        display:block;
        width:0;
        height:0;
        border-top:5px solid transparent;
        border-bottom:5px solid transparent;
        border-left:9px solid ${color};
        transform:rotate(${bearing - 90}deg);
        transform-origin:center;
      "></span>
    </div>
  `,
});

const getRouteDirectionMarkers = (positions, { intervalMeters = 850 } = {}) => {
  if (!positions?.length || positions.length < 2) {
    return [];
  }

  const segmentLengths = [];
  let totalMeters = 0;
  for (let index = 1; index < positions.length; index += 1) {
    const length = distanceBetweenLatLngs(positions[index - 1], positions[index]);
    segmentLengths.push(length);
    totalMeters += length;
  }

  if (totalMeters < 120) {
    return [];
  }

  const markerCount = Math.max(1, Math.min(8, Math.floor(totalMeters / intervalMeters)));
  const targetDistances = Array.from({ length: markerCount }, (_, index) => (
    ((index + 1) * totalMeters) / (markerCount + 1)
  ));

  const markers = [];
  let traversed = 0;
  let targetIndex = 0;

  for (let segmentIndex = 0; segmentIndex < segmentLengths.length && targetIndex < targetDistances.length; segmentIndex += 1) {
    const segmentLength = segmentLengths[segmentIndex];
    const segmentStart = positions[segmentIndex];
    const segmentEnd = positions[segmentIndex + 1];

    while (targetIndex < targetDistances.length && traversed + segmentLength >= targetDistances[targetIndex]) {
      const ratio = segmentLength ? (targetDistances[targetIndex] - traversed) / segmentLength : 0;
      markers.push({
        position: interpolateLatLng(segmentStart, segmentEnd, ratio),
        bearing: bearingBetweenLatLngs(segmentStart, segmentEnd),
      });
      targetIndex += 1;
    }

    traversed += segmentLength;
  }

  return markers;
};

const getItineraryBoundsPositions = (itinerary) => {
  if (!itinerary?.legs?.length) {
    return [];
  }

  const geometryPositions = itinerary.legs
    .flatMap((leg) => getLegGeometryPositions(leg).map(([latitude, longitude]) => ({ latitude, longitude })));

  const stopPositions = itinerary.legs.flatMap((leg) => {
    if (leg.type === 'BUS') {
      return [stationToLocation(leg.fromStation), stationToLocation(leg.toStation)];
    }

    if (leg.type === 'WALK') {
      return [stationToLocation(leg.from), stationToLocation(leg.to)];
    }

    if (leg.type === 'TRANSFER') {
      return [stationToLocation(leg.fromStation), stationToLocation(leg.toStation)];
    }

    return [];
  }).filter(isValidLocation);

  return [
    stationToLocation(itinerary.mapOrigin),
    ...geometryPositions,
    ...stopPositions,
    stationToLocation(itinerary.mapDestination),
  ].filter(isValidLocation);
};

const getItineraryStopMarkers = (itinerary) => {
  if (!itinerary?.legs?.length) {
    return [];
  }

  const markers = [
    {
      key: 'origin',
      type: 'ORIGIN',
      label: 'Điểm đón',
      point: stationToLocation(itinerary.mapOrigin),
    },
    {
      key: 'destination',
      type: 'DESTINATION',
      label: 'Điểm đến',
      point: stationToLocation(itinerary.mapDestination),
    },
  ];

  itinerary.legs.forEach((leg, index) => {
    if (leg.type === 'BUS') {
      markers.push({
        key: `board-${index}-${leg.fromStation?.stationId}`,
        type: 'BOARD',
        label: `Lên xe ${leg.routeCode}`,
        point: stationToLocation(leg.fromStation),
      });
      markers.push({
        key: `alight-${index}-${leg.toStation?.stationId}`,
        type: 'ALIGHT',
        label: `Xuống xe ${leg.routeCode}`,
        point: stationToLocation(leg.toStation),
      });
    }
  });

  return markers.filter((marker) => isValidLocation(marker.point));
};

const currentLocationIcon = L.divIcon({
  className: '',
  iconAnchor: [24, 24],
  html: `
    <div class="relative flex h-12 w-12 items-center justify-center">
      <span class="absolute h-12 w-12 rounded-full bg-sky-400/25"></span>
      <span class="absolute h-7 w-7 rounded-full bg-sky-500/25"></span>
      <span class="relative h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-lg"></span>
    </div>
  `,
});

const liveBusIcon = (status, heading = null) => {
  const isDelayed = status === 'Delayed';
  const rotation = Number.isFinite(Number(heading)) ? Number(heading) : 0;

  return L.divIcon({
    className: '',
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
    html: `
      <div class="relative flex h-[38px] w-[38px] items-center justify-center">
        <span class="absolute h-10 w-10 rounded-full ${
          isDelayed ? 'bg-amber-300/35' : 'bg-emerald-300/35'
        } animate-ping"></span>
        <div class="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white ${
          isDelayed ? 'bg-amber-500' : 'bg-emerald-600'
        } text-white shadow-xl">
          <span class="material-symbols-outlined text-[21px]">directions_bus</span>
        </div>
        <span style="
          position:absolute;
          top:-3px;
          width:0;
          height:0;
          border-left:5px solid transparent;
          border-right:5px solid transparent;
          border-bottom:8px solid ${isDelayed ? '#f59e0b' : '#059669'};
          transform:rotate(${rotation}deg);
          transform-origin:50% 22px;
        "></span>
        </div>
    `,
  });
};

const RouteLabelIcon = (routeNumber) => L.divIcon({
  className: '',
  iconAnchor: [18, -2],
  html: `<span class="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow">${routeNumber}</span>`,
});

const MapAutoFocus = ({ selectedRoute, selectedItinerary, currentLocation, focusedPositions = [] }) => {
  const map = useMap();

  useEffect(() => {
    if (focusedPositions.length > 1) {
      map.fitBounds(focusedPositions, {
        animate: true,
        maxZoom: 17,
        paddingTopLeft: [60, 80],
        paddingBottomRight: [420, 80],
      });
      return;
    }

    const itineraryPath = getItineraryBoundsPositions(selectedItinerary);
    if (itineraryPath.length > 1) {
      map.fitBounds(itineraryPath.map(toLatLng), {
        animate: true,
        maxZoom: ROUTE_FIT_MAX_ZOOM,
        paddingTopLeft: [60, 60],
        paddingBottomRight: [400, 60],
      });
      return;
    }

    const routePath = selectedRoute?.pathPoints?.length
      ? selectedRoute.pathPoints
      : selectedRoute?.stops || [];
    const validPath = routePath.filter(isValidLocation);

    if (validPath.length > 1) {
      map.fitBounds(validPath.map(toLatLng), {
        animate: true,
        maxZoom: ROUTE_FIT_MAX_ZOOM,
        paddingTopLeft: [60, 60],
        paddingBottomRight: [400, 60],
      });
      return;
    }

    if (validPath.length === 1) {
      map.setView(toLatLng(validPath[0]), ROUTE_FIT_MAX_ZOOM, { animate: true });
      return;
    }

    if (isValidLocation(currentLocation)) {
      map.setView(toLatLng(currentLocation), ROUTE_FIT_MAX_ZOOM, { animate: true });
      return;
    }

    map.setView(toLatLng(DEFAULT_CENTER), INITIAL_MAP_ZOOM, { animate: true });
  }, [currentLocation, focusedPositions, map, selectedItinerary, selectedRoute]);

  return null;
};

const MapCanvas = ({
  selectedRoute,
  selectedItinerary,
  focusedItineraryLegIndex = null,
  currentLocation,
  liveBusData,
  liveError,
  arrivalAlerts,
  onDismissArrivalAlert,
  onSelectItineraryLeg,
  onUseCurrentLocation,
}) => {
  const itineraryMarkers = getItineraryStopMarkers(selectedItinerary);
  const routePath = selectedRoute?.pathPoints?.length
    ? selectedRoute.pathPoints
    : selectedRoute?.stops || [];
  const routePositions = selectedItinerary ? [] : routePath.filter(isValidLocation).map(toLatLng);
  const routeDirectionMarkers = getRouteDirectionMarkers(routePositions);
  const focusedLeg = Number.isInteger(focusedItineraryLegIndex)
    ? selectedItinerary?.legs?.[focusedItineraryLegIndex]
    : null;
  const focusedPositions = useMemo(() => getLegGeometryPositions(focusedLeg), [focusedLeg]);
  const stops = (selectedRoute?.stops || [])
    .map(normalizeStopLocation)
    .filter(isValidLocation);
  const selectedRouteStop = stops[0];

  return (
    <section className="relative min-w-0 flex-1 overflow-hidden bg-slate-200">
      <MapContainer
        center={toLatLng(getRouteCenter(selectedRoute))}
        zoom={INITIAL_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        maxBounds={DA_NANG_BOUNDS}
        maxBoundsViscosity={MAX_BOUNDS_VISCOSITY}
        zoomControl={false}
        scrollWheelZoom
        preferCanvas
        className="h-full w-full"
      >
        <TileLayer
          attribution={MAP_TILE_ATTRIBUTION}
          maxZoom={MAX_MAP_ZOOM}
          url={MAP_TILE_URL}
        />

        <MapAutoFocus
          selectedRoute={selectedRoute}
          selectedItinerary={selectedItinerary}
          currentLocation={currentLocation}
          focusedPositions={focusedPositions}
        />
        <ZoomControl position="bottomright" />

        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#0f172a',
                weight: 10,
                opacity: 0.34,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#ffffff',
                weight: 7,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: MAP_UI.bus, weight: 5, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }}
            />
            {routeDirectionMarkers.map((marker, markerIndex) => (
              <Marker
                key={`route-direction-${markerIndex}`}
                position={marker.position}
                icon={createDirectionArrowIcon('#047857', marker.bearing)}
                interactive={false}
                zIndexOffset={500}
              />
            ))}
          </>
        )}

        {selectedItinerary && (selectedItinerary.legs || []).map((leg, index) => {
          const legPositions = getLegGeometryPositions(leg);
          const hasFocusedLeg = Number.isInteger(focusedItineraryLegIndex);
          const isFocusedLeg = focusedItineraryLegIndex === index;
          const layerOpacity = hasFocusedLeg && !isFocusedLeg ? 0.28 : 0.96;

          if (legPositions.length < 2) {
            return null;
          }

          if (leg.type === 'BUS') {
            const color = leg.routeColor || '#047857';
            const directionMarkers = getRouteDirectionMarkers(legPositions);

            return (
              <React.Fragment key={`bus-geometry-${index}-${leg.routeId}`}>
                <Polyline
                  positions={legPositions}
                  pathOptions={{
                    color: MAP_UI.ink,
                    weight: isFocusedLeg ? 13 : 10,
                    opacity: hasFocusedLeg && !isFocusedLeg ? 0.16 : 0.32,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{ click: () => onSelectItineraryLeg?.(index) }}
                />
                <Polyline
                  positions={legPositions}
                  pathOptions={{
                    color: MAP_UI.busHalo,
                    weight: isFocusedLeg ? 10 : 8,
                    opacity: layerOpacity,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{ click: () => onSelectItineraryLeg?.(index) }}
                />
                <Polyline
                  positions={legPositions}
                  pathOptions={{
                    color,
                    weight: isFocusedLeg ? 6 : 5,
                    opacity: layerOpacity,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{ click: () => onSelectItineraryLeg?.(index) }}
                />
                {directionMarkers.map((marker, markerIndex) => (
                  <Marker
                    key={`bus-direction-${index}-${markerIndex}`}
                    position={marker.position}
                    icon={createDirectionArrowIcon(color, marker.bearing)}
                    interactive={false}
                    zIndexOffset={650}
                  />
                ))}
              </React.Fragment>
            );
          }

          const isTransfer = leg.type === 'TRANSFER';
          const walkColor = isTransfer ? MAP_UI.transfer : MAP_UI.walk;

          return (
            <React.Fragment key={`walk-geometry-${index}`}>
              <Polyline
                positions={legPositions}
                pathOptions={{
                  color: '#ffffff',
                  weight: isFocusedLeg ? 8 : 6,
                  opacity: hasFocusedLeg && !isFocusedLeg ? 0.2 : 0.86,
                  dashArray: isTransfer ? '4 7' : '2 8',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{ click: () => onSelectItineraryLeg?.(index) }}
              />
              <Polyline
                positions={legPositions}
                pathOptions={{
                  color: walkColor,
                  weight: isFocusedLeg ? 5 : 4,
                  opacity: layerOpacity,
                  dashArray: isTransfer ? '4 7' : '2 8',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{ click: () => onSelectItineraryLeg?.(index) }}
              />
            </React.Fragment>
          );
        })}

        {!selectedItinerary && stops.map((stop, index) => {
          const isOrigin = index === 0;
          const isEndpoint = isOrigin || index === stops.length - 1;

          return (
            <CircleMarker
              key={`${selectedRoute.id}-${stop.order}-${stop.name}`}
              center={toLatLng(stop)}
              radius={isEndpoint ? 10 : 4}
              pathOptions={{
                color: isEndpoint ? '#0f172a' : '#ffffff',
                fillColor: isEndpoint ? (isOrigin ? MAP_UI.board : MAP_UI.alight) : MAP_UI.bus,
                fillOpacity: 1,
                weight: isEndpoint ? 4 : 2,
              }}
            >
              <Tooltip
                permanent={isEndpoint}
                direction="top"
                offset={[0, isEndpoint ? -10 : -6]}
                opacity={0.98}
              >
                {isEndpoint ? `${isOrigin ? 'Bắt đầu' : 'Kết thúc'}: ` : `${index + 1}. `}
                {stop.name}
              </Tooltip>
              <Popup>
                <div className="min-w-[180px]">
                  <div className="text-sm font-black text-slate-950">{stop.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{selectedRoute.routeNumber} · {selectedRoute.name}</div>
                  <div className="mt-2 text-xs font-semibold text-emerald-700">
                    {isOrigin ? 'Điểm đầu tuyến' : isEndpoint ? 'Điểm cuối tuyến' : `Trạm số ${index + 1}`}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {selectedItinerary && itineraryMarkers.map((marker) => {
          const markerStyle = {
            ORIGIN: { fillColor: MAP_UI.origin, radius: 10, label: 'Điểm đón' },
            DESTINATION: { fillColor: MAP_UI.destination, radius: 10, label: 'Điểm đến' },
            BOARD: { fillColor: MAP_UI.board, radius: 7, label: marker.label },
            ALIGHT: { fillColor: MAP_UI.alight, radius: 7, label: marker.label },
          }[marker.type] || { fillColor: '#0f766e', radius: 6, label: marker.label };

          return (
          <CircleMarker
            key={marker.key}
            center={toLatLng(marker.point)}
            radius={markerStyle.radius}
            pathOptions={{
              color: '#0f172a',
              fillColor: markerStyle.fillColor,
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent={marker.type === 'ORIGIN' || marker.type === 'DESTINATION'} direction="top" offset={[0, -8]} opacity={0.98}>
              {markerStyle.label}
            </Tooltip>
            <Popup>
              <div className="min-w-[180px]">
                <div className="text-sm font-black text-slate-950">{markerStyle.label}</div>
                <div className="mt-1 text-xs text-slate-500">{marker.point.name || marker.label}</div>
              </div>
            </Popup>
          </CircleMarker>
          );
        })}

        {selectedRouteStop && (
          <Marker
            position={toLatLng(selectedRouteStop)}
            icon={RouteLabelIcon(selectedRoute.routeNumber)}
            interactive={false}
          />
        )}

        {isValidLocation(currentLocation) && (
          <Marker
            position={toLatLng(currentLocation)}
            icon={currentLocationIcon}
            title="Vị trí hiện tại"
            interactive={false}
          />
        )}

        {(liveBusData?.buses || []).filter((bus) => isValidLocation(bus.currentLocation)).map((bus) => (
          <Marker
            key={bus.busId}
            position={toLatLng(bus.currentLocation)}
            icon={liveBusIcon(bus.status, bus.heading ?? bus.bearing)}
            title={`${bus.busId} - ${bus.status}`}
            interactive={false}
          />
        ))}
      </MapContainer>

      {(selectedRoute || selectedItinerary) && (
        <div className="pointer-events-none absolute left-4 top-4 z-[1000] rounded-2xl bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
              {selectedItinerary ? `${selectedItinerary.transferCount} đổi tuyến` : selectedRoute.routeNumber}
            </span>
            <span className="text-sm font-black text-slate-900">{selectedItinerary ? 'Lộ trình đang xem' : 'Tuyến đang xem'}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="h-1.5 w-10 rounded-full bg-emerald-600 ring-2 ring-white shadow-sm" />
            Xe buýt
            <span className="ml-2 h-0 w-10 border-t-2 border-dashed border-blue-600" />
            Đi bộ
            <span className="material-symbols-outlined ml-1 text-[15px] text-emerald-700">arrow_forward</span>
            Chiều đi
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onUseCurrentLocation}
        className="absolute right-4 top-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-[0_10px_30px_rgba(15,23,42,0.16)] hover:bg-emerald-50"
        aria-label="Dùng vị trí hiện tại"
        title="Dùng vị trí hiện tại"
      >
        <span className="material-symbols-outlined text-[22px]">my_location</span>
      </button>

      <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] rounded-xl bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-500 shadow-sm backdrop-blur">
        © OpenStreetMap
      </div>

      {(liveBusData || liveError) && (
        <div className="absolute right-4 top-20 z-[1000] w-72 rounded-2xl bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Xe đang chạy</div>
            <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
              liveError ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {liveError ? 'Lỗi' : 'Live'}
            </span>
          </div>
          {liveError ? (
            <p className="mt-2 text-sm text-slate-600">{liveError}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {(liveBusData.buses || []).map((bus) => (
                <div key={bus.busId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-slate-950">{bus.busId}</span>
                    <span className={bus.status === 'Delayed' ? 'font-bold text-amber-600' : 'font-bold text-emerald-700'}>
                      {bus.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Trạm kế: {bus.nextStop} • ETA {bus.estimatedArrivalTime}
                  </div>
                  {bus.tripProgress && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span>Tiến độ</span>
                        <span>{bus.tripProgress.progressPercent}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${bus.tripProgress.progressPercent}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {bus.tripProgress.completedStops.length} đã qua • {bus.tripProgress.remainingStops.length} còn lại • {bus.tripProgress.estimatedRemainingTime}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {arrivalAlerts.length > 0 && (
        <div className="absolute left-4 top-24 z-[1000] w-80 space-y-2">
          {arrivalAlerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <span className="material-symbols-outlined text-[19px] text-emerald-600">notifications_active</span>
                    {alert.title}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{alert.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismissArrivalAlert?.(alert.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng thông báo"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
const isSameRouteId = (left, right) => String(left || '') === String(right || '');

const buildStopId = (route, stop) => {
  const normalizedName = stop.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${route.routeNumber}-${stop.originalOrder || stop.order}-${normalizedName}`;
};

const buildArrivalNotificationId = (route, stop) => (
  `${route.routeNumber}-${buildStopId(route, stop)}-arrival`
);

const buildDelayNotificationId = (route) => `${route.routeNumber}-delay`;

const buildRouteChangeNotificationId = (route) => `${route.routeNumber}-route-change`;

const RouteCard = ({
  route,
  compact = false,
  isHighlighted = false,
  isFavorite = false,
  onSelect,
  onToggleFavorite,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.();
      }
    }}
    className={`relative block w-full rounded-2xl bg-white p-4 pr-14 text-left shadow-sm transition hover:shadow-md ${
      isHighlighted ? 'ring-2 ring-emerald-200' : ''
    }`}
  >
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite?.(route);
      }}
      className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border ${
        isFavorite
          ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
      }`}
      aria-label={isFavorite ? 'Bỏ lưu tuyến' : 'Lưu tuyến'}
    >
      <span className="material-symbols-outlined text-[20px] leading-none">{isFavorite ? 'star' : 'star_border'}</span>
    </button>

    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-slate-600">
        <span className="material-symbols-outlined text-[22px]">directions_bus</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
            {route.routeNumber}
          </span>
          <h3 className="min-w-0 truncate text-base font-bold text-slate-950">{route.name}</h3>
        </div>
        <p className="mt-1 text-sm text-slate-700">
          {route.origin} - {route.destination}
        </p>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Thời gian</div>
        <div className="font-semibold text-slate-950">{formatDuration(route.estimatedDurationMinutes)}</div>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Giá vé</div>
        <div className="font-semibold text-slate-950">{formatFare(route.fare)}</div>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Quãng đường</div>
        <div className="font-semibold text-slate-950">{route.distanceKm} km</div>
      </div>
    </div>

    {!compact && (
      <div className="mt-3">
        <div className="mb-2 text-xs font-bold uppercase text-slate-500">Điểm dừng</div>
        <div className="flex flex-wrap gap-1.5">
          {route.stops.map((stop) => (
            <span
              key={`${route.id}-${stop.order}`}
              className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700"
            >
              {stop.name}
            </span>
          ))}
        </div>
      </div>
    )}

    <button
      type="button"
      onClick={onSelect}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
    >
      <span className="material-symbols-outlined text-[18px]">map</span>
      View details
    </button>
  </article>
);

const RouteDetailsPanel = ({
  route,
  currentLocation,
  liveBusData,
  isLiveTracking = false,
  isLiveLoading = false,
  liveError = '',
  isStopFavorite,
  isArrivalNotificationEnabled,
  isDelayNotificationEnabled,
  isRouteChangeNotificationEnabled,
  panelMessage = '',
  onToggleFavoriteStop,
  onToggleArrivalNotification,
  onToggleDelayNotification,
  onToggleRouteChangeNotification,
  onToggleLiveLocation,
  onPurchaseTicket,
  onClose,
}) => {
  const [directionTab, setDirectionTab] = useState('outbound');
  const [detailTab, setDetailTab] = useState('info');
  const validStops = (route.stops || []).map(normalizeStopLocation).filter(isValidLocation);
  const nearestStop = currentLocation && validStops.length
    ? validStops
      .map((stop) => ({
        ...stop,
        distanceKm: calculateDistanceKm(currentLocation, stop),
      }))
      .filter((stop) => typeof stop.distanceKm === 'number')
      .sort((first, second) => first.distanceKm - second.distanceKm)[0]
    : null;
  const firstDeparture = route.operatingHours?.firstDeparture || '05:30';
  const lastDeparture = route.operatingHours?.lastDeparture || '21:00';
  const frequencyMinutes = route.operatingHours?.frequencyMinutes || 30;
  const maxOffsetMinutes = Math.max(
    ...route.stops.map((stop) => stop.estimatedOffsetMinutes || 0),
    route.estimatedDurationMinutes || 0
  );
  const directionStops = directionTab === 'outbound'
    ? route.stops
    : route.stops
      .slice()
      .reverse()
      .map((stop, index) => ({
        ...stop,
        originalOrder: stop.order,
        order: index + 1,
        estimatedOffsetMinutes: Math.max(maxOffsetMinutes - (stop.estimatedOffsetMinutes || 0), 0),
      }));
  const directionOrigin = directionTab === 'outbound' ? route.origin : route.destination;
  const directionDestination = directionTab === 'outbound' ? route.destination : route.origin;
  const detailTabs = [
    { id: 'info', label: 'Thông tin' },
    { id: 'stops', label: 'Trạm' },
    { id: 'arrival', label: 'Lịch chạy' },
    { id: 'progress', label: 'Tiến độ' },
    { id: 'feedback', label: 'Phản hồi' },
  ];
  const stopEtaSummary = liveBusData?.stopEtaSummary || [];
  const getStopEta = (stop) => (
    stopEtaSummary.find((eta) => eta.stopId === buildStopId(route, stop))
  );

  return (
    <aside className="fixed inset-x-3 bottom-3 top-auto z-[1200] flex max-h-[74vh] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:inset-x-auto md:bottom-4 md:right-4 md:top-[96px] md:max-h-none md:w-[390px]">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-black text-white">
                {route.routeNumber}
              </span>
              <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                {route.status || 'ACTIVE'}
              </span>
            </div>
            <h2 className="mt-2 truncate text-xl font-black text-slate-950">{route.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {directionOrigin} - {directionDestination}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng chi tiết tuyến"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {[
            { id: 'outbound', label: 'Lượt đi' },
            { id: 'inbound', label: 'Lượt về' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDirectionTab(tab.id)}
              className={`rounded-md px-3 py-2 text-sm font-black ${
                directionTab === tab.id
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              title={tab.label}
              className={`min-w-0 truncate rounded-lg px-1 py-2 text-[10px] font-black ${
                detailTab === tab.id
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {panelMessage && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
            {panelMessage}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {detailTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Giá vé</div>
                <div className="mt-1 font-black text-slate-950">{formatFare(route.fare)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Thời gian</div>
                <div className="mt-1 font-black text-slate-950">{formatDuration(route.estimatedDurationMinutes)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Quãng đường</div>
                <div className="mt-1 font-black text-slate-950">{route.distanceKm} km</div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Hoạt động</div>
                  <div className="font-semibold text-slate-700">{firstDeparture} - {lastDeparture}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Xuất phát</div>
                  <div className="font-semibold text-slate-950">{directionOrigin}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Điểm đến</div>
                  <div className="font-semibold text-slate-950">{directionDestination}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-slate-700">
              <div className="mb-1 text-[11px] font-black uppercase text-emerald-700">Mô tả tuyến</div>
              Tuyến từ {directionOrigin} đến {directionDestination}, gồm điểm dừng chính, giờ hoạt động,
              thời gian dự kiến, giá vé và hỗ trợ tìm trạm gần bạn.
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-950">Vé xe buýt</div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Mua vé một chiều hoặc vé tháng cho tuyến này.
                  </p>
                </div>
                <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                  {formatFare(route.fare)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPurchaseTicket?.(route)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
              >
                <span className="material-symbols-outlined text-[19px]">confirmation_number</span>
                Mua vé
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">notifications</span>
                  Cài đặt thông báo chuyến đi
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thông báo xe đến</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Bật chuông cạnh điểm dừng để nhận thông báo khi xe sắp đến.
                    </p>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                    Trạm
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thông báo trễ chuyến</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Nhận thông báo khi xe trên tuyến bị trễ so với lịch dự kiến.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleDelayNotification?.(route)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      isDelayNotificationEnabled?.(route) ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                    aria-label={isDelayNotificationEnabled?.(route) ? 'Disable delay alerts' : 'Enable delay alerts'}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        isDelayNotificationEnabled?.(route) ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thông báo đổi tuyến</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Nhận thông báo khi tuyến có thay đổi điểm dừng hoặc lộ trình tạm thời.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleRouteChangeNotification?.(route)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      isRouteChangeNotificationEnabled?.(route) ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                    aria-label={isRouteChangeNotificationEnabled?.(route) ? 'Disable route change alerts' : 'Enable route change alerts'}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        isRouteChangeNotificationEnabled?.(route) ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Vị trí xe trực tiếp
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Theo dõi xe đang chạy trên tuyến bằng vị trí GPS, trạng thái và ETA trạm kế tiếp.
                  </p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                  isLiveTracking ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isLiveTracking ? 'Live' : 'Tắt'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleLiveLocation?.(route)}
                disabled={isLiveLoading}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:opacity-60 ${
                  isLiveTracking
                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isLiveLoading ? 'progress_activity' : 'gps_fixed'}
                </span>
                {isLiveTracking ? 'Tắt theo dõi' : 'Xem xe trực tiếp'}
              </button>
              {liveError && (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {liveError}
                </div>
              )}
              {isLiveTracking && liveBusData?.buses?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {liveBusData.buses.map((bus) => (
                    <div key={bus.busId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-slate-950">{bus.busId}</span>
                        <span className={bus.status === 'Delayed' ? 'font-bold text-amber-600' : 'font-bold text-emerald-700'}>
                          {bus.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Trạm kế: {bus.nextStop} - ETA {bus.estimatedArrivalTime}
                      </div>
                      {bus.delay && (
                        <div className="mt-2 rounded border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                          Delayed {bus.delay.delayDurationMinutes} min • {bus.delay.delayReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isLiveTracking && stopEtaSummary.length > 0 && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                    Thời gian xe đến dự kiến
                  </div>
                  <div className="space-y-2">
                    {stopEtaSummary.slice(0, 4).map((eta) => (
                      <div key={eta.stopId} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-900">{eta.stopName}</div>
                          <div className="text-slate-500">{eta.nextBusId || 'Chưa có xe hoạt động'}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-black text-emerald-700">{eta.estimatedArrivalTime}</div>
                          <div className="text-[10px] font-bold uppercase text-slate-400">{eta.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isLiveTracking && liveBusData?.routeChange && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-amber-700">
                    <span className="material-symbols-outlined text-[16px]">route</span>
                    Đổi tuyến
                  </div>
                  <div className="font-semibold">{liveBusData.routeChange.reasonForChange}</div>
                  <p className="mt-1 text-xs leading-5">{liveBusData.routeChange.updatedRoutePath}</p>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm gần nhất</div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                  Live
                </span>
              </div>
              {nearestStop ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="font-black text-slate-950">{nearestStop.name}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Cách vị trí hiện tại {nearestStop.distanceKm.toFixed(2)} km
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  Dùng vị trí hiện tại để hiển thị trạm gần nhất của tuyến này.
                </div>
              )}
            </div>
          </div>
        )}

        {detailTab === 'stops' && (
          <div className="space-y-3">
            {!isLiveTracking && (
              <button
                type="button"
                onClick={() => onToggleLiveLocation?.(route)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100"
              >
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Xem ETA thời gian thực
              </button>
            )}
            {directionStops.map((stop) => {
              const stopEta = getStopEta(stop);

              return (
                <div key={`${route.id}-${directionTab}-stop-${stop.order}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">
                    {stop.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900">{stop.name}</div>
                    <div className="text-xs text-slate-500">
                      Dự kiến sớm nhất: {addMinutesToTime(firstDeparture, stop.estimatedOffsetMinutes || 0)}
                    </div>
                    <div className={`mt-1 text-xs font-black ${
                      stopEta?.etaMinutes ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      ETA: {stopEta?.estimatedArrivalTime || 'chưa có dữ liệu'}
                      {stopEta?.nextBusId ? ` • ${stopEta.nextBusId}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleArrivalNotification?.(route, stop)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        isArrivalNotificationEnabled?.(route, stop)
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      aria-label={isArrivalNotificationEnabled?.(route, stop) ? 'Tắt thông báo xe đến' : 'Bật thông báo xe đến'}
                      title={isArrivalNotificationEnabled?.(route, stop) ? 'Tắt thông báo xe đến' : 'Bật thông báo xe đến'}
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        {isArrivalNotificationEnabled?.(route, stop) ? 'notifications_active' : 'notifications'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavoriteStop?.(route, stop)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        isStopFavorite?.(route, stop)
                          ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      aria-label={isStopFavorite?.(route, stop) ? 'Bỏ lưu điểm dừng' : 'Lưu điểm dừng'}
                      title={isStopFavorite?.(route, stop) ? 'Bỏ lưu điểm dừng' : 'Lưu điểm dừng'}
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        {isStopFavorite?.(route, stop) ? 'star' : 'star_border'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {detailTab === 'arrival' && (
          <div>
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-4 border-b border-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-400">
                <span>Trạm</span>
                <span>Sớm nhất</span>
                <span>ETA</span>
                <span>Tần suất</span>
              </div>
              {directionStops.map((stop) => {
                const stopEta = getStopEta(stop);

                return (
                  <div
                    key={`${route.id}-${directionTab}-arrival-${stop.order}`}
                    className="grid grid-cols-4 gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                  >
                    <span className="font-semibold text-slate-800">{stop.name}</span>
                    <span className="text-slate-600">{addMinutesToTime(firstDeparture, stop.estimatedOffsetMinutes || 0)}</span>
                    <span className={stopEta?.etaMinutes ? 'font-black text-emerald-700' : 'text-slate-400'}>
                      {stopEta?.estimatedArrivalTime || 'Chưa có'}
                    </span>
                    <span className="text-slate-600">Mỗi {frequencyMinutes} phút</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500">
              Thời gian sớm nhất được tính từ chuyến đầu lúc {firstDeparture}.
              ETA trực tiếp tự cập nhật khi bật theo dõi xe.
            </div>
          </div>
        )}

        {detailTab === 'progress' && (
          <div className="space-y-3">
            {!isLiveTracking && (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-black text-slate-950">Chưa có tiến độ chuyến</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Bật theo dõi xe trực tiếp để xem trạm đã qua, trạm còn lại, vị trí xe,
                  trạng thái chuyến và thời gian còn lại.
                </p>
                <button
                  type="button"
                  onClick={() => onToggleLiveLocation?.(route)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-[18px]">route</span>
                  Xem tiến độ chuyến
                </button>
              </div>
            )}

            {isLiveTracking && (liveBusData?.buses || []).map((bus) => {
              const progress = bus.tripProgress;

              if (!progress) {
                return null;
              }

              return (
                <div key={progress.tripId} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-slate-400">{progress.tripId}</div>
                      <div className="mt-1 font-black text-slate-950">{bus.busId}</div>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                      progress.tripStatus === 'Delayed'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {progress.tripStatus}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-black text-slate-500">
                      <span>Tiến độ tới điểm cuối</span>
                      <span>{progress.progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Trạm hiện tại</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.currentStop}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Trạm kế</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.nextStop}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Đã qua</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.completedStops.length} trạm</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="font-black uppercase text-slate-400">Còn lại</div>
                      <div className="mt-1 font-semibold text-slate-900">{progress.estimatedRemainingTime}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm đã qua</div>
                    <div className="space-y-1">
                      {progress.completedStops.length ? progress.completedStops.map((stop) => (
                        <div key={stop.stopId} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{stop.stopName}</span>
                        </div>
                      )) : (
                        <div className="text-xs text-slate-400">Chưa qua trạm nào.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Trạm còn lại</div>
                    <div className="space-y-1">
                      {progress.remainingStops.length ? progress.remainingStops.map((stop) => (
                        <div key={stop.stopId} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          <span>{stop.stopName}</span>
                        </div>
                      )) : (
                        <div className="text-xs text-emerald-700">Chuyến sắp hoàn tất.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {detailTab === 'feedback' && (
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-950">Phản hồi hành khách</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Phản hồi về lịch chạy, chất lượng điểm dừng và trải nghiệm chuyến đi sẽ hiển thị tại đây.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-500">
              <div className="rounded-lg bg-white px-2 py-3">Lịch chạy</div>
              <div className="rounded-lg bg-white px-2 py-3">Trạm</div>
              <div className="rounded-lg bg-white px-2 py-3">Dịch vụ</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

const FavoriteRoutesPanel = ({ favoriteRoutes, routes, onSelect, onRemove }) => (
  <section className="mt-5 border-t border-slate-200 pt-4">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Favorite Routes</div>
        <p className="mt-1 text-xs text-slate-500">Manage your frequently used routes.</p>
      </div>
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
        Passenger
      </span>
    </div>

    {favoriteRoutes.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
        No favorite routes saved yet.
      </div>
    ) : (
      <div className="space-y-3">
        {favoriteRoutes.map((favoriteRoute) => {
          const route = routes.find((item) => (
            isSameRouteId(item.id, favoriteRoute.routeId)
            || item.routeNumber === favoriteRoute.routeNumber
          ));
          const savedDate = favoriteRoute.savedAt
            ? new Date(favoriteRoute.savedAt).toLocaleDateString('en-GB')
            : 'Recently saved';

          return (
            <article
              key={`${favoriteRoute.routeId || favoriteRoute.routeNumber}-${favoriteRoute.destination}`}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                      {favoriteRoute.routeNumber}
                    </span>
                    <span className="truncate text-sm font-black text-slate-950">
                      {route?.name || favoriteRoute.destination}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Saved: {savedDate}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(favoriteRoute)}
                  className="rounded p-1 text-amber-600 hover:bg-amber-50"
                  aria-label="Remove favorite route"
                >
                  <span className="material-symbols-outlined text-[18px]">star</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSelect(favoriteRoute)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                View Details
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

const FavoriteStopsPanel = ({ favoriteStops, onRemove }) => (
  <section className="mt-5 border-t border-slate-200 pt-4">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Favorite Stops</div>
        <p className="mt-1 text-xs text-slate-500">Quick access to frequently used bus stops.</p>
      </div>
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
        Passenger
      </span>
    </div>

    {favoriteStops.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
        No favorite stops saved yet.
      </div>
    ) : (
      <div className="space-y-3">
        {favoriteStops.map((favoriteStop) => {
          const savedDate = favoriteStop.savedAt
            ? new Date(favoriteStop.savedAt).toLocaleDateString('en-GB')
            : 'Recently saved';

          return (
            <article
              key={favoriteStop.stopId || `${favoriteStop.routeNumber}-${favoriteStop.stopName}`}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-700">
                      <span className="material-symbols-outlined text-[17px]">directions_bus</span>
                    </span>
                    <span className="truncate text-sm font-black text-slate-950">{favoriteStop.stopName}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {favoriteStop.routeNumber || 'Route'} • Saved: {savedDate}
                  </p>
                  {favoriteStop.nearbyArrivalText ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">{favoriteStop.nearbyArrivalText}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(favoriteStop)}
                  className="rounded p-1 text-amber-600 hover:bg-amber-50"
                  aria-label="Remove favorite stop"
                >
                  <span className="material-symbols-outlined text-[18px]">star</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

const getStationName = (station) => (
  station?.stationName || station?.stopName || station?.address || ''
);

const getBusLegs = (itinerary) => (itinerary?.legs || []).filter((leg) => leg.type === 'BUS');

const getDepartureTime = () => formatTimeFromOffset(0);

const getArrivalTime = (itinerary) => formatTimeFromOffset(itinerary?.totalDurationMinutes || itinerary?.totalDuration || 0);

const getWaitLegs = (itinerary) => (itinerary?.legs || []).filter((leg) => leg.type === 'WAIT');

const formatExpectedArrivalTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const getWaitSummaryText = (durationMinutes) => {
  const duration = Number(durationMinutes) || 0;
  return duration > 0 ? `Chờ khoảng ${formatVietnameseDuration(duration)}` : 'Không cần chờ';
};

const getWaitDetailText = (leg) => {
  const eta = formatExpectedArrivalTime(leg?.estimatedArrivalTime);
  if (eta) {
    return `${eta} · Dự kiến xe đến`;
  }

  return getWaitSummaryText(leg?.durationMinutes);
};

const ItineraryResultCard = ({
  itinerary,
  isRecommended = false,
  isSelected = false,
  onPreview,
  onOpenDetails,
}) => {
  const busLegs = getBusLegs(itinerary);
  const routeCodes = busLegs.map((leg) => leg.routeCode).filter(Boolean);
  const firstBusLeg = busLegs[0];
  const lastBusLeg = busLegs[busLegs.length - 1];
  const totalWaitMinutes = getWaitLegs(itinerary)
    .reduce((total, leg) => total + (Number(leg.durationMinutes) || 0), 0);

  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm transition ${
        isSelected || isRecommended ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
      }`}
    >
      <button type="button" onClick={onPreview} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <span className="material-symbols-outlined text-[18px] text-slate-700">directions_bus</span>
              {getDepartureTime()} - {getArrivalTime(itinerary)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span className="material-symbols-outlined text-[14px]">directions_walk</span>
              {routeCodes.map((code) => (
                <React.Fragment key={code}>
                  <span className="text-slate-400">›</span>
                  <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-black text-slate-950">
                    {code}
                  </span>
                </React.Fragment>
              ))}
              <span className="text-slate-400">›</span>
              <span className="material-symbols-outlined text-[14px]">directions_walk</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-black text-slate-950">
              {formatVietnameseDuration(itinerary.totalDurationMinutes || itinerary.totalDuration)}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-slate-500">
              {itinerary.transferCount} đổi tuyến
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">directions_walk</span>
            {formatMeters(itinerary.totalWalkingDistance)}
          </span>
          <span>·</span>
          <span>{getWaitSummaryText(totalWaitMinutes)}</span>
          {isRecommended && (
            <>
              <span>·</span>
              <span className="font-black text-emerald-700">Tốt nhất</span>
            </>
          )}
        </div>

        {firstBusLeg && lastBusLeg && (
          <div className="mt-2 grid grid-cols-[58px_1fr] gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="font-black uppercase text-slate-400">Lên</span>
            <span className="truncate font-semibold text-slate-800">{getStationName(firstBusLeg.fromStation)}</span>
            <span className="font-black uppercase text-slate-400">Xuống</span>
            <span className="truncate font-semibold text-slate-800">{getStationName(lastBusLeg.toStation)}</span>
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={onOpenDetails}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
      >
        Xem chi tiết lộ trình
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
      </button>
    </article>
  );
};

const TimelineRail = ({
  children,
  isFirst = false,
  isLast = false,
}) => {
  const lineStyle = isFirst
    ? { top: 12, bottom: 0 }
    : isLast
      ? { top: 0, height: 12 }
      : { top: 0, bottom: 0 };

  return (
    <div className="relative flex w-6 self-stretch justify-center">
      {!(isFirst && isLast) && (
        <span
          className="absolute left-1/2 w-0.5 -translate-x-1/2 bg-blue-300"
          style={lineStyle}
        />
      )}
      {children}
    </div>
  );
};

const StopTimelineIcon = ({ tone = 'emerald' }) => {
  const colorClass = tone === 'red' ? 'border-red-500' : 'border-emerald-600';
  const fillClass = tone === 'red' ? 'bg-red-500' : 'bg-emerald-600';

  return (
    <span className={`relative z-10 mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white ${colorClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${fillClass}`} />
    </span>
  );
};

const ModeTimelineIcon = ({ icon, tone = 'slate' }) => {
  const toneClass = {
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-700',
    slate: 'text-slate-600',
  }[tone] || 'text-slate-600';

  return (
    <span className={`relative z-10 mt-2 flex h-5 w-5 items-center justify-center rounded-full bg-white ${toneClass}`}>
      <span className="material-symbols-outlined text-[17px]">{icon}</span>
    </span>
  );
};

const TimelineTime = ({ children }) => (
  <div className="pt-1 text-right text-xs font-semibold text-slate-500">{children}</div>
);

const ItineraryDetailsPanel = ({
  itinerary,
  originPlace,
  destinationPlace,
  focusedLegIndex = null,
  onFocusLeg,
  onClose,
}) => {
  const startTime = new Date();
  let accumulatedMinutes = 0;
  const resolvePointName = (point) => {
    if (point?.type === 'ORIGIN') {
      return originPlace?.displayName || originPlace?.address || 'Điểm đón';
    }

    if (point?.type === 'DESTINATION') {
      return destinationPlace?.displayName || destinationPlace?.address || 'Điểm đến';
    }

    return getStationName(point) || 'Vị trí';
  };

  const legTime = (leg) => {
    const time = formatTimeFromOffset(accumulatedMinutes, startTime);
    if (leg.type === 'WALK') {
      accumulatedMinutes += (Number(leg.durationSeconds) || 0) / 60;
    } else if (leg.type === 'WAIT') {
      accumulatedMinutes += Number(leg.durationMinutes) || 0;
    } else if (leg.type === 'BUS') {
      accumulatedMinutes += Number(leg.durationMinutes) || 0;
    } else if (leg.type === 'TRANSFER') {
      accumulatedMinutes += (Number(leg.walkingDurationSeconds) || 0) / 60 + (Number(leg.transferPenaltyMinutes) || 0);
    }
    return time;
  };

  const routeCodes = getBusLegs(itinerary).map((leg) => leg.routeCode).filter(Boolean).join(' · ');
  const timelineGridClass = 'grid grid-cols-[44px_24px_minmax(0,1fr)] gap-3 items-stretch';

  return (
    <aside className="fixed inset-x-3 bottom-3 top-auto z-[1200] flex max-h-[78vh] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:inset-x-auto md:bottom-4 md:right-4 md:top-[96px] md:max-h-none md:w-[392px]">
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Đóng chi tiết lộ trình"
          >
            <span className="material-symbols-outlined text-[21px]">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1 text-sm font-black text-slate-950">Chi tiết lộ trình</div>
        </div>

        <div className="mt-3">
          <div className="text-xl font-black tracking-tight text-slate-950">
            {getDepartureTime()} - {getArrivalTime(itinerary)}
            <span className="ml-1 text-base font-semibold text-slate-500">
              ({formatVietnameseDuration(itinerary.totalDurationMinutes || itinerary.totalDuration)})
            </span>
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {itinerary.transferCount} chuyển tuyến · {formatMeters(itinerary.totalWalkingDistance)} đi bộ
            {routeCodes ? ` · ${routeCodes}` : ''}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        <div>
          <div>
            <div className={`${timelineGridClass} py-1`}>
              <TimelineTime>{getDepartureTime()}</TimelineTime>
              <TimelineRail isFirst>
                <StopTimelineIcon />
              </TimelineRail>
              <div>
                <div className="text-sm font-black text-slate-950">{originPlace?.displayName || originPlace?.address || 'Điểm đón'}</div>
              </div>
            </div>

            {(itinerary.legs || []).map((leg, index) => {
              const time = legTime(leg);
              const endTime = formatTimeFromOffset(accumulatedMinutes, startTime);
              const isFocused = focusedLegIndex === index;
              const rowClassName = `${timelineGridClass} w-full rounded-xl py-1 text-left transition ${
                isFocused ? 'bg-emerald-50/70 ring-1 ring-emerald-100' : 'hover:bg-slate-50'
              }`;

              if (leg.type === 'WAIT') {
                return (
                  <button type="button" onClick={() => onFocusLeg?.(index)} key={`${leg.type}-${index}`} className={rowClassName}>
                    <TimelineTime>{time}</TimelineTime>
                    <TimelineRail>
                      <ModeTimelineIcon icon="schedule" tone="amber" />
                    </TimelineRail>
                    <div className="py-1.5">
                      <div className="text-sm font-semibold text-slate-800">
                        Chờ xe
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {getWaitDetailText(leg)}
                      </div>
                    </div>
                  </button>
                );
              }

              if (leg.type === 'WALK') {
                return (
                  <button type="button" onClick={() => onFocusLeg?.(index)} key={`${leg.type}-${index}`} className={rowClassName}>
                    <div />
                    <TimelineRail>
                      <ModeTimelineIcon icon="directions_walk" tone="blue" />
                    </TimelineRail>
                    <div className="py-2">
                      <div className="text-sm font-semibold text-slate-800">
                        Đi bộ {formatVietnameseDuration(leg.durationMinutes)}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {formatMeters(leg.distanceMeters)} · đến {resolvePointName(leg.to)}
                        {leg.isFallback ? ' · chưa có hình học đường đi bộ' : ''}
                      </div>
                    </div>
                  </button>
                );
              }

              if (leg.type === 'TRANSFER') {
                return (
                  <button type="button" onClick={() => onFocusLeg?.(index)} key={`${leg.type}-${index}`} className={rowClassName}>
                    <div />
                    <TimelineRail>
                      <ModeTimelineIcon icon="directions_walk" tone="blue" />
                    </TimelineRail>
                    <div className="py-2">
                      <div className="text-sm font-semibold text-slate-800">
                        {leg.sameStation ? 'Chuyển tuyến cùng trạm' : `Đi bộ ${formatVietnameseDuration(leg.walkingDurationMinutes)}`}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {getStationName(leg.fromStation)} → {getStationName(leg.toStation)} · {formatMeters(leg.walkingDistanceMeters)}
                        {leg.walkingIsFallback ? ' · chưa có hình học đường đi bộ' : ''}
                      </div>
                    </div>
                  </button>
                );
              }

              if (leg.type === 'BUS') {
                return (
                  <React.Fragment key={`${leg.type}-${leg.routeId}-${index}`}>
                    <div className={`${timelineGridClass} py-1`}>
                      <TimelineTime>{time}</TimelineTime>
                      <TimelineRail>
                        <StopTimelineIcon />
                      </TimelineRail>
                      <div>
                        <div className="text-sm font-black text-slate-950">{getStationName(leg.fromStation)}</div>
                      </div>
                    </div>

                    <button type="button" onClick={() => onFocusLeg?.(index)} className={rowClassName}>
                      <div />
                      <TimelineRail>
                        <ModeTimelineIcon icon="directions_bus" tone="emerald" />
                      </TimelineRail>
                      <div className={`rounded-xl px-3 py-2 ${
                        isFocused ? 'bg-emerald-100' : 'bg-emerald-50'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs font-black text-emerald-700">
                            {leg.routeCode}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-slate-500">
                            {Math.max((leg.stops || []).length - 1, 0)} điểm dừng · {formatVietnameseDuration(leg.durationMinutes)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-medium text-slate-600">
                          Hướng {leg.direction === 'INBOUND' ? 'về' : 'đi'}
                        </div>
                      </div>
                    </button>

                    <div className={`${timelineGridClass} py-1`}>
                      <TimelineTime>{endTime}</TimelineTime>
                      <TimelineRail>
                        <StopTimelineIcon />
                      </TimelineRail>
                      <div>
                        <div className="text-sm font-black text-slate-950">{getStationName(leg.toStation)}</div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              return null;
            })}

            <div className={`${timelineGridClass} py-1`}>
              <TimelineTime>{getArrivalTime(itinerary)}</TimelineTime>
              <TimelineRail isLast>
                <StopTimelineIcon tone="red" />
              </TimelineRail>
              <div>
                <div className="text-sm font-black text-slate-950">{destinationPlace?.displayName || destinationPlace?.address || 'Điểm đến'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const NearbyStopCard = ({ stop, onSelect }) => {
  const routeMinutes = stop.route.estimatedDurationMinutes;
  const routeDistanceKm = stop.route.distanceKm;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-700">
        <span className="material-symbols-outlined text-[21px]">directions_bus</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-black text-slate-950">{stop.name}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {stop.route.routeNumber} - {stop.route.name}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-black text-slate-950">{formatDuration(routeMinutes)}</div>
            <div className="text-[11px] font-semibold text-slate-500">{routeDistanceKm} km</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] font-semibold text-slate-400">
          Nearest stop: {stop.distanceKm} km away
        </div>
      </div>
    </button>
  );
};

const SearchRoutesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('lookup');
  const [bestFrom, setBestFrom] = useState(searchParams.get('from') || '');
  const [bestTo, setBestTo] = useState(searchParams.get('to') || '');
  const [routes, setRoutes] = useState([]);
  const [nearbyStops, setNearbyStops] = useState([]);
  const [bestRouteResult, setBestRouteResult] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [selectedItineraryDetails, setSelectedItineraryDetails] = useState(null);
  const [focusedItineraryLegIndex, setFocusedItineraryLegIndex] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isFindingBest, setIsFindingBest] = useState(false);
  const [error, setError] = useState('');
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [favoriteStops, setFavoriteStops] = useState([]);
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [arrivalNotifications, setArrivalNotifications] = useState([]);
  const [delayNotifications, setDelayNotifications] = useState([]);
  const [routeChangeNotifications, setRouteChangeNotifications] = useState([]);
  const [arrivalAlerts, setArrivalAlerts] = useState([]);
  const [delayAlerts, setDelayAlerts] = useState([]);
  const [notifiedArrivalKeys, setNotifiedArrivalKeys] = useState(new Set());
  const [notifiedDelayKeys, setNotifiedDelayKeys] = useState(new Set());
  const [notifiedRouteChangeKeys, setNotifiedRouteChangeKeys] = useState(new Set());
  const [liveRouteId, setLiveRouteId] = useState(null);
  const [liveBusData, setLiveBusData] = useState(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');

  const activeFilters = useMemo(() => ({
    q: searchParams.get('q') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  }), [searchParams]);

  const favoriteRouteIds = useMemo(() => new Set(
    favoriteRoutes.map((favoriteRoute) => String(favoriteRoute.routeId || favoriteRoute.routeNumber))
  ), [favoriteRoutes]);

  const favoriteStopIds = useMemo(() => new Set(
    favoriteStops.map((favoriteStop) => String(favoriteStop.stopId))
  ), [favoriteStops]);

  const arrivalNotificationIds = useMemo(() => new Set(
    arrivalNotifications
      .filter((subscription) => subscription.notificationStatus !== 'DISABLED')
      .map((subscription) => String(subscription.subscriptionId))
  ), [arrivalNotifications]);

  const delayNotificationIds = useMemo(() => new Set(
    delayNotifications
      .filter((subscription) => subscription.notificationStatus !== 'DISABLED')
      .map((subscription) => String(subscription.subscriptionId))
  ), [delayNotifications]);

  const routeChangeNotificationIds = useMemo(() => new Set(
    routeChangeNotifications
      .filter((subscription) => subscription.notificationStatus !== 'DISABLED')
      .map((subscription) => String(subscription.subscriptionId))
  ), [routeChangeNotifications]);

  const itineraryRecommendations = useMemo(() => {
    if (!bestRouteResult?.recommendations) {
      return [];
    }

    return bestRouteResult.recommendations;
  }, [bestRouteResult]);

  const isRouteFavorite = (route) => (
    favoriteRouteIds.has(String(route.id)) || favoriteRouteIds.has(String(route.routeNumber))
  );

  const isStopFavorite = (route, stop) => favoriteStopIds.has(buildStopId(route, stop));
  const isArrivalNotificationEnabled = (route, stop) => (
    arrivalNotificationIds.has(buildArrivalNotificationId(route, stop))
  );
  const isDelayNotificationEnabled = (route) => (
    delayNotificationIds.has(buildDelayNotificationId(route))
  );
  const isRouteChangeNotificationEnabled = (route) => (
    routeChangeNotificationIds.has(buildRouteChangeNotificationId(route))
    || routeChangeNotifications.some((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        subscription.routeNumber === route.routeNumber
        || isSameRouteId(subscription.routeId, route.id)
      )
    ))
  );
  const routePanelMessage = /notification|alert/i.test(favoriteMessage) ? favoriteMessage : '';
  const isLiveTrackingSelectedRoute = Boolean(
    selectedRoute?.id && isSameRouteId(liveRouteId, selectedRoute.id)
  );

  useEffect(() => {
    setFocusedItineraryLegIndex(null);
  }, [selectedItinerary?.rank, selectedRoute?.id]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoutes = async () => {
      setIsLoading(true);
      setError('');

      try {
        const result = await routeService.searchRoutes(activeFilters);

        if (isMounted) {
          const nextRoutes = result.routes || [];
          setRoutes(nextRoutes);
          setSelectedRoute(null);
          setSelectedItinerary(null);
          setSelectedItineraryDetails(null);
          setNearbyStops([]);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to search routes.');
          setRoutes([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRoutes();

    return () => {
      isMounted = false;
    };
  }, [activeFilters]);

  useEffect(() => {
    let isMounted = true;

    const fetchFavoriteRoutes = async () => {
      if (!user) {
        setFavoriteRoutes([]);
        setFavoriteStops([]);
        setArrivalNotifications([]);
        setDelayNotifications([]);
        setRouteChangeNotifications([]);
        return;
      }

      try {
        const [
          favoriteRouteResult,
          favoriteStopResult,
          arrivalNotificationResult,
          delayNotificationResult,
          routeChangeNotificationResult,
        ] = await Promise.all([
          routeService.getFavoriteRoutes(),
          routeService.getFavoriteStops(),
          routeService.getArrivalNotifications(),
          routeService.getDelayNotifications(),
          routeService.getRouteChangeNotifications(),
        ]);

        if (isMounted) {
          setFavoriteRoutes(favoriteRouteResult || []);
          setFavoriteStops(favoriteStopResult || []);
          setArrivalNotifications(arrivalNotificationResult || []);
          setDelayNotifications(delayNotificationResult || []);
          setRouteChangeNotifications(routeChangeNotificationResult || []);
        }
      } catch (err) {
        if (isMounted && err.statusCode !== 403) {
          setError(err.message || 'Unable to load favorites.');
        }
      }
    };

    fetchFavoriteRoutes();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!liveRouteId) {
      setLiveBusData(null);
      setLiveError('');
      return undefined;
    }

    let isMounted = true;

    const fetchLiveBusLocations = async () => {
      setIsLiveLoading(true);

      try {
        const result = await routeService.getLiveBusLocations(liveRouteId);

        if (isMounted) {
          setLiveBusData(result);
          setLiveError(result.buses?.length ? '' : (result.message || 'Live location unavailable.'));
        }
      } catch (err) {
        if (isMounted) {
          setLiveBusData(null);
          setLiveError(err.message || 'Live location unavailable.');
        }
      } finally {
        if (isMounted) {
          setIsLiveLoading(false);
        }
      }
    };

    fetchLiveBusLocations();
    const intervalId = window.setInterval(fetchLiveBusLocations, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [liveRouteId]);

  useEffect(() => {
    if (!liveBusData?.stopEtaSummary?.length || !arrivalNotifications.length) {
      return;
    }

    const activeSubscriptions = arrivalNotifications.filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        isSameRouteId(subscription.routeId, liveBusData.route?.id)
        || subscription.routeNumber === liveBusData.route?.routeNumber
      )
    ));

    const nextAlerts = [];
    const nextNotifiedKeys = new Set(notifiedArrivalKeys);

    activeSubscriptions.forEach((subscription) => {
      const eta = liveBusData.stopEtaSummary.find((item) => item.stopId === subscription.stopId);
      const threshold = Number(subscription.etaThresholdMinutes) || 5;

      if (!eta || typeof eta.etaMinutes !== 'number' || eta.etaMinutes > threshold) {
        return;
      }

      const notificationType = eta.etaMinutes <= 1 ? 'arriving' : 'approaching';
      const notificationKey = `${subscription.subscriptionId}-${notificationType}`;

      if (nextNotifiedKeys.has(notificationKey)) {
        return;
      }

      nextNotifiedKeys.add(notificationKey);
      nextAlerts.push({
        id: `${notificationKey}-${Date.now()}`,
        title: notificationType === 'arriving' ? 'Bus arriving now' : 'Bus approaching',
        message: `${subscription.routeNumber} to ${subscription.stopName}: ${eta.estimatedArrivalTime}. ${eta.nextBusId || 'Tracked bus'} is ${eta.status.toLowerCase()}.`,
        status: eta.status,
      });
    });

    if (!nextAlerts.length) {
      return;
    }

    setNotifiedArrivalKeys(nextNotifiedKeys);
    setArrivalAlerts((current) => [...nextAlerts, ...current].slice(0, 4));

    if ('Notification' in window && Notification.permission === 'granted') {
      nextAlerts.forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
        });
      });
    }
  }, [arrivalNotifications, liveBusData, notifiedArrivalKeys]);

  useEffect(() => {
    if (!liveBusData?.buses?.length || !delayNotifications.length) {
      return;
    }

    const activeSubscriptions = delayNotifications.filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        isSameRouteId(subscription.routeId, liveBusData.route?.id)
        || subscription.routeNumber === liveBusData.route?.routeNumber
      )
    ));

    const delayedBuses = liveBusData.buses.filter((bus) => (
      ['Delayed', 'DELAYED'].includes(bus.status) && bus.delay
    ));
    const nextAlerts = [];
    const nextNotifiedKeys = new Set(notifiedDelayKeys);

    activeSubscriptions.forEach((subscription) => {
      delayedBuses.forEach((bus) => {
        const delayMinutes = bus.delay?.delayDurationMinutes || 0;
        const threshold = Number(subscription.delayThresholdMinutes) || 5;

        if (delayMinutes < threshold) {
          return;
        }

        const notificationKey = `${subscription.subscriptionId}-${bus.busId}-${delayMinutes}`;

        if (nextNotifiedKeys.has(notificationKey)) {
          return;
        }

        nextNotifiedKeys.add(notificationKey);
        nextAlerts.push({
          id: `${notificationKey}-${Date.now()}`,
          title: 'Bus delayed',
          message: `${subscription.routeNumber} ${bus.busId} is delayed ${delayMinutes} min. Reason: ${bus.delay.delayReason}. Updated ETA: ${bus.delay.updatedEta}.`,
          status: 'Delayed',
        });
      });
    });

    if (!nextAlerts.length) {
      return;
    }

    setNotifiedDelayKeys(nextNotifiedKeys);
    setDelayAlerts((current) => [...nextAlerts, ...current].slice(0, 4));

    if ('Notification' in window && Notification.permission === 'granted') {
      nextAlerts.forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
        });
      });
    }
  }, [delayNotifications, liveBusData, notifiedDelayKeys]);

  useEffect(() => {
    if (!liveBusData?.routeChange || !routeChangeNotifications.length) {
      return;
    }

    const routeChange = liveBusData.routeChange;
    const activeSubscriptions = routeChangeNotifications.filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        isSameRouteId(subscription.routeId, liveBusData.route?.id)
        || subscription.routeNumber === liveBusData.route?.routeNumber
      )
    ));

    if (!activeSubscriptions.length) {
      return;
    }

    const nextNotifiedKeys = new Set(notifiedRouteChangeKeys);
    const nextAlerts = [];

    activeSubscriptions.forEach((subscription) => {
      const notificationKey = `${subscription.subscriptionId}-${routeChange.changeId}`;

      if (nextNotifiedKeys.has(notificationKey)) {
        return;
      }

      nextNotifiedKeys.add(notificationKey);
      nextAlerts.push({
        id: `${notificationKey}-${Date.now()}`,
        title: 'Route change detected',
        message: `${routeChange.routeNumber}: ${routeChange.reasonForChange}. ${routeChange.updatedRoutePath}`,
        status: 'Route changed',
      });
    });

    if (!nextAlerts.length) {
      return;
    }

    setNotifiedRouteChangeKeys(nextNotifiedKeys);
    setDelayAlerts((current) => [...nextAlerts, ...current].slice(0, 4));

    if ('Notification' in window && Notification.permission === 'granted') {
      nextAlerts.forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
        });
      });
    }
  }, [liveBusData, notifiedRouteChangeKeys, routeChangeNotifications]);

  const clearError = () => {
    if (error) {
      setError('');
    }
    if (favoriteMessage) {
      setFavoriteMessage('');
    }
  };

  const handleBackToAllRoutes = () => {
    clearError();
    setSearchParams({});
    setBestFrom('');
    setBestTo('');
    setBestRouteResult(null);
    setNearbyStops([]);
    setSelectedRoute(null);
    setSelectedItinerary(null);
    setSelectedItineraryDetails(null);
    setLiveRouteId(null);
    setLiveBusData(null);
    setLiveError('');
    setActiveTab('lookup');
  };

  const handleUseCurrentLocation = () => {
    setError('');

    if (!navigator.geolocation) {
      setError('Trình duyệt chưa hỗ trợ lấy vị trí hiện tại.');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const nextLocation = { latitude, longitude };
          const result = await routeService.searchNearbyRoutes({
            latitude,
            longitude,
            radiusKm: 8,
          });

          setCurrentLocation(nextLocation);
          setRoutes(result.routes || []);
          setSelectedRoute(null);
          setSelectedItinerary(null);
          setSelectedItineraryDetails(null);
          setNearbyStops(result.nearbyStops || []);
          setActiveTab('lookup');
        } catch (err) {
          setError(err.message || 'Unable to find nearby routes.');
          setRoutes([]);
          setNearbyStops([]);
          setCurrentLocation(null);
        } finally {
          setIsLocating(false);
        }
      },
      (geoError) => {
        const messages = {
          1: 'Location permission was denied.',
          2: 'Không thể lấy vị trí hiện tại.',
          3: 'Location request timed out.',
        };

        setError(messages[geoError.code] || 'Unable to read current location.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleSelectNearbyStop = (stop) => {
    const matchingRoute = routes.find((route) => (
      route.routeNumber === stop.route.routeNumber || route.id === stop.route.id
    ));

    if (matchingRoute) {
      setSelectedRoute(matchingRoute);
      setSelectedItinerary(null);
      setSelectedItineraryDetails(null);
    }
  };

  const handleToggleFavoriteRoute = async (route) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Please log in before saving a favorite route.');
      return;
    }

    try {
      if (isRouteFavorite(route)) {
        await routeService.removeFavoriteRoute(route.id);
        setFavoriteRoutes((current) => current.filter((favoriteRoute) => (
          !isSameRouteId(favoriteRoute.routeId, route.id)
          && favoriteRoute.routeNumber !== route.routeNumber
        )));
        setFavoriteMessage('Route removed from favorites.');
        return;
      }

      const favoriteRoute = await routeService.saveFavoriteRoute(route.id);
      setFavoriteRoutes((current) => [
        favoriteRoute,
        ...current.filter((item) => (
          !isSameRouteId(item.routeId, favoriteRoute.routeId)
          && item.routeNumber !== favoriteRoute.routeNumber
        )),
      ]);
      setFavoriteMessage('Route saved to favorites.');
    } catch (err) {
      if (err.message === 'Route already exists in favorites') {
        setFavoriteMessage('Route already exists in favorites.');
        return;
      }

      setError(err.message || 'Unable to update favorite route.');
    }
  };

  const handleSelectFavoriteRoute = async (favoriteRoute) => {
    const matchingRoute = routes.find((route) => (
      isSameRouteId(route.id, favoriteRoute.routeId)
      || route.routeNumber === favoriteRoute.routeNumber
    ));

    if (matchingRoute) {
      setSelectedRoute(matchingRoute);
      setSelectedItinerary(null);
      setSelectedItineraryDetails(null);
      return;
    }

    try {
      const result = await routeService.searchRoutes({ q: favoriteRoute.routeNumber });
      const nextRoutes = result.routes || [];
      setRoutes(nextRoutes);
      setSelectedRoute(nextRoutes.find((route) => route.routeNumber === favoriteRoute.routeNumber) || nextRoutes[0] || null);
      setSelectedItinerary(null);
      setSelectedItineraryDetails(null);
      setActiveTab('lookup');
    } catch (err) {
      setError(err.message || 'Unable to open favorite route.');
    }
  };

  const handleRemoveFavoriteRoute = async (favoriteRoute) => {
    const routeId = favoriteRoute.routeId
      || routes.find((route) => route.routeNumber === favoriteRoute.routeNumber)?.id;

    if (!routeId) {
      setError('Không tìm thấy tuyến.');
      return;
    }

    try {
      await routeService.removeFavoriteRoute(routeId);
      setFavoriteRoutes((current) => current.filter((item) => (
        !isSameRouteId(item.routeId, routeId)
        && item.routeNumber !== favoriteRoute.routeNumber
      )));
      setFavoriteMessage('Route removed from favorites.');
    } catch (err) {
      setError(err.message || 'Unable to remove favorite route.');
    }
  };

  const handleToggleFavoriteStop = async (route, stop) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Please log in before saving a favorite stop.');
      return;
    }

    const stopId = buildStopId(route, stop);

    try {
      if (favoriteStopIds.has(stopId)) {
        await routeService.removeFavoriteStop(stopId);
        setFavoriteStops((current) => current.filter((favoriteStop) => favoriteStop.stopId !== stopId));
        setFavoriteMessage('Stop removed from favorites.');
        return;
      }

      const favoriteStop = await routeService.saveFavoriteStop({
        routeId: route.id,
        routeNumber: route.routeNumber,
        stopId,
        stopName: stop.name,
        order: stop.originalOrder || stop.order,
        address: `${route.name} stop`,
        nearbyArrivalText: `Every ${route.operatingHours?.frequencyMinutes || 30} min`,
        latitude: stop.latitude,
        longitude: stop.longitude,
      });

      setFavoriteStops((current) => [
        favoriteStop,
        ...current.filter((item) => item.stopId !== favoriteStop.stopId),
      ]);
      setFavoriteMessage('Stop saved to favorites.');
    } catch (err) {
      if (err.message === 'Stop already exists in favorites') {
        setFavoriteMessage('Stop already exists in favorites.');
        return;
      }

      setError(err.message || 'Unable to update favorite stop.');
    }
  };

  const handleRemoveFavoriteStop = async (favoriteStop) => {
    if (!favoriteStop.stopId) {
      setError('Không tìm thấy điểm dừng.');
      return;
    }

    try {
      await routeService.removeFavoriteStop(favoriteStop.stopId);
      setFavoriteStops((current) => current.filter((item) => item.stopId !== favoriteStop.stopId));
      setFavoriteMessage('Stop removed from favorites.');
    } catch (err) {
      setError(err.message || 'Unable to remove favorite stop.');
    }
  };

  const handleToggleArrivalNotification = async (route, stop) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Please log in before enabling arrival notifications.');
      return;
    }

    const subscriptionId = buildArrivalNotificationId(route, stop);

    try {
      if (arrivalNotificationIds.has(subscriptionId)) {
        await routeService.removeArrivalNotification(subscriptionId);
        setArrivalNotifications((current) => (
          current.filter((subscription) => subscription.subscriptionId !== subscriptionId)
        ));
        setFavoriteMessage('Arrival notification disabled.');
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const subscription = await routeService.subscribeArrivalNotification({
        routeId: route.id,
        stopId: buildStopId(route, stop),
        stopName: stop.name,
        order: stop.originalOrder || stop.order,
        etaThresholdMinutes: 5,
      });

      setArrivalNotifications((current) => [
        subscription,
        ...current.filter((item) => item.subscriptionId !== subscription.subscriptionId),
      ]);
      setFavoriteMessage(
        'Arrival notification enabled. You will be alerted when a bus is within 5 minutes of this stop.'
      );

      if ('Notification' in window && Notification.permission === 'denied') {
        setError('Browser notification permission is disabled. In-app alerts will still appear.');
      }
    } catch (err) {
      if (err.message === 'Arrival notification already enabled') {
        setFavoriteMessage('Arrival notification already enabled.');
        return;
      }

      setError(err.message || 'Unable to update arrival notification.');
    }
  };

  const handleToggleDelayNotification = async (route) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Please log in before enabling delay notifications.');
      return;
    }

    const subscriptionId = buildDelayNotificationId(route);

    try {
      if (delayNotificationIds.has(subscriptionId)) {
        await routeService.removeDelayNotification(subscriptionId);
        setDelayNotifications((current) => (
          current.filter((subscription) => subscription.subscriptionId !== subscriptionId)
        ));
        setFavoriteMessage('Delay notification disabled.');
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const subscription = await routeService.subscribeDelayNotification({
        routeId: route.id,
        routeNumber: route.routeNumber,
        delayThresholdMinutes: 5,
      });

      setDelayNotifications((current) => [
        subscription,
        ...current.filter((item) => item.subscriptionId !== subscription.subscriptionId),
      ]);
      setFavoriteMessage('Delay notification enabled for this route.');

      if ('Notification' in window && Notification.permission === 'denied') {
        setError('Browser notification permission is disabled. In-app delay alerts will still appear.');
      }
    } catch (err) {
      if (err.message === 'Delay notification already enabled') {
        setFavoriteMessage('Delay notification already enabled.');
        return;
      }

      setError(err.message || 'Unable to update delay notification.');
    }
  };

  const handleToggleRouteChangeNotification = async (route) => {
    setError('');
    setFavoriteMessage('');

    if (!user) {
      setError('Please log in before enabling route change notifications.');
      return;
    }

    const subscriptionId = buildRouteChangeNotificationId(route);
    const existingSubscription = routeChangeNotifications.find((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
      && (
        subscription.subscriptionId === subscriptionId
        || subscription.routeNumber === route.routeNumber
        || isSameRouteId(subscription.routeId, route.id)
      )
    ));

    try {
      if (existingSubscription) {
        await routeService.removeRouteChangeNotification(existingSubscription.subscriptionId);
        setRouteChangeNotifications((current) => (
          current.filter((subscription) => subscription.subscriptionId !== existingSubscription.subscriptionId)
        ));
        setFavoriteMessage('Route change notification disabled.');
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const subscription = await routeService.subscribeRouteChangeNotification({
        routeId: route.id,
        routeNumber: route.routeNumber,
      });

      setRouteChangeNotifications((current) => [
        subscription,
        ...current.filter((item) => item.subscriptionId !== subscription.subscriptionId),
      ]);
      setFavoriteMessage('Route change notification enabled for this route.');

      if ('Notification' in window && Notification.permission === 'denied') {
        setError('Browser notification permission is disabled. In-app route change alerts will still appear.');
      }
    } catch (err) {
      if (err.message === 'Route change notification already enabled') {
        const subscriptions = await routeService.getRouteChangeNotifications();
        setRouteChangeNotifications(subscriptions || []);
        setFavoriteMessage('Route change notification already enabled.');
        return;
      }

      setError(err.message || 'Unable to update route change notification.');
    }
  };

  const handleToggleLiveLocation = (route) => {
    clearError();

    if (!route?.id) {
      setLiveError('Không tìm thấy xe.');
      return;
    }

    if (isSameRouteId(liveRouteId, route.id)) {
      setLiveRouteId(null);
      setLiveBusData(null);
      setLiveError('');
      return;
    }

    setSelectedRoute(route);
    setSelectedItinerary(null);
    setSelectedItineraryDetails(null);
    setLiveRouteId(route.id);
    setLiveBusData(null);
    setLiveError('');
  };

  const handleDismissArrivalAlert = (alertId) => {
    setArrivalAlerts((current) => current.filter((alert) => alert.id !== alertId));
    setDelayAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const handleOpenPurchaseTicket = (route) => {
    const params = route?.routeNumber ? `?route=${encodeURIComponent(route.routeNumber)}` : '';
    navigate(`/buy-tickets${params}`, { state: { route } });
  };

  const handleFindBestRoute = async (event) => {
    event.preventDefault();
    setError('');
    setBestRouteResult(null);
    setSelectedRoute(null);
    setSelectedItinerary(null);
    setSelectedItineraryDetails(null);

    if (!bestFrom.trim() || !bestTo.trim()) {
      setError('Vui lòng nhập cả điểm đón và điểm đến.');
      return;
    }

    setIsFindingBest(true);

    try {
      const [originSearch, destinationSearch] = await Promise.all([
        routeService.geocodePlace(bestFrom.trim()),
        routeService.geocodePlace(bestTo.trim()),
      ]);
      const originPlace = originSearch.results?.[0];
      const destinationPlace = destinationSearch.results?.[0];

      if (!originPlace || !destinationPlace) {
        setError('Không tìm thấy tọa độ cho điểm đón hoặc điểm đến. Vui lòng nhập địa chỉ cụ thể hơn.');
        return;
      }

      const result = await routeService.recommendItineraries({
        fromLat: originPlace.latitude,
        fromLng: originPlace.longitude,
        toLat: destinationPlace.latitude,
        toLng: destinationPlace.longitude,
        maxTransfers: 1,
        preference: 'FASTEST',
      });

      const decoratedRecommendations = (result.recommendations || []).map((itinerary) => ({
        ...itinerary,
        mapOrigin: originPlace,
        mapDestination: destinationPlace,
      }));
      const nextResult = {
        ...result,
        recommendations: decoratedRecommendations,
        originPlace,
        destinationPlace,
      };

      setBestRouteResult(nextResult);
      if (decoratedRecommendations.length) {
        setSelectedItinerary(decoratedRecommendations[0]);
      }
    } catch (err) {
      setError(err.message || 'Không thể tìm lộ trình phù hợp.');
    } finally {
      setIsFindingBest(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <Header />

      <main className="relative mt-[80px] flex h-[calc(100vh-80px)]">
        <aside className="absolute inset-x-3 bottom-3 z-[1100] flex max-h-[58vh] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur md:static md:inset-auto md:max-h-none md:w-[380px] md:shrink-0 md:rounded-none md:bg-white md:shadow-[8px_0_30px_rgba(15,23,42,0.08)]">
          <div className="p-3">
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                activeTab === 'lookup'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined">search</span>
              TÌM KIẾM
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('directions')}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                activeTab === 'directions'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined">conversion_path</span>
              LỘ TRÌNH
            </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {activeTab === 'lookup' ? (
              <>
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-slate-950">Khám phá tuyến xe</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Tìm điểm dừng gần bạn và xem nhanh tuyến đang phục vụ.
                  </p>

                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isLocating ? 'progress_activity' : 'my_location'}
                    </span>
                    {isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
                  </button>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Nearby stops</div>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                      Live
                    </span>
                  </div>

                  {currentLocation && (
                    <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-600">
                      <div className="font-bold text-slate-950">Đã xác định vị trí</div>
                      <div>
                        {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                      </div>
                    </div>
                  )}

                  {isLocating && (
                    <div className="rounded-lg bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600">
                      Đang lấy vị trí GPS...
                    </div>
                  )}

                  {!isLocating && currentLocation && nearbyStops.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                      Không tìm thấy điểm dừng gần bạn. Hãy kiểm tra quyền vị trí hoặc thử lại sau.
                    </div>
                  )}

                  {nearbyStops.length > 0 && (
                    <div className="space-y-3">
                      {nearbyStops.map((stop) => (
                        <NearbyStopCard
                          key={`${stop.route.routeNumber}-${stop.order}-${stop.name}`}
                          stop={stop}
                          onSelect={() => handleSelectNearbyStop(stop)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {user && (
                  <>
                    <FavoriteRoutesPanel
                      favoriteRoutes={favoriteRoutes}
                      routes={routes}
                      onSelect={handleSelectFavoriteRoute}
                      onRemove={handleRemoveFavoriteRoute}
                    />
                    <FavoriteStopsPanel
                      favoriteStops={favoriteStops}
                      onRemove={handleRemoveFavoriteStop}
                    />
                  </>
                )}
              </>
            ) : (
              <form onSubmit={handleFindBestRoute} className="space-y-3">
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-slate-950">Tìm lộ trình</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Nhập điểm đón và điểm đến, BusDN sẽ tự chuyển sang tọa độ và chọn lộ trình tốt nhất.
                  </p>
                </div>
                <input
                  type="text"
                  value={bestFrom}
                  onChange={(event) => {
                    setBestFrom(event.target.value);
                    clearError();
                  }}
                  placeholder="Nhập điểm đón"
                  className="w-full rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={bestTo}
                  onChange={(event) => {
                    setBestTo(event.target.value);
                    clearError();
                  }}
                  placeholder="Nhập điểm đến"
                  className="w-full rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isFindingBest}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined">
                    {isFindingBest ? 'progress_activity' : 'route'}
                  </span>
                  {isFindingBest ? 'Đang tìm lộ trình...' : 'Tìm lộ trình'}
                </button>

                {bestRouteResult && (
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-emerald-900">Lộ trình được đề xuất</div>
                        <p className="mt-1 text-xs text-emerald-800">
                          Hệ thống tự chuyển địa điểm sang tọa độ và đề xuất lộ trình đi bộ, chờ xe, xe buýt, chuyển tuyến.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-emerald-700">
                        {itineraryRecommendations.length > 1
                          ? `${itineraryRecommendations.length} lộ trình`
                          : 'Tốt nhất'}
                      </span>
                    </div>

                    {itineraryRecommendations.length ? (
                      <div className="mt-3 space-y-3">
                        {itineraryRecommendations.map((itinerary, index) => (
                          <ItineraryResultCard
                            key={`${itinerary.rank}-${itinerary.totalDurationMinutes}-${itinerary.transferCount}`}
                            itinerary={itinerary}
                            isRecommended={index === 0}
                            isSelected={selectedItinerary?.rank === itinerary.rank}
                            onPreview={() => {
                              setSelectedRoute(null);
                              setSelectedItinerary(itinerary);
                              setSelectedItineraryDetails(null);
                            }}
                            onOpenDetails={() => {
                              setSelectedRoute(null);
                              setSelectedItinerary(itinerary);
                              setSelectedItineraryDetails(itinerary);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                        Không tìm thấy lộ trình xe buýt phù hợp. Hãy thử điểm đón hoặc điểm đến khác.
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {favoriteMessage && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {favoriteMessage}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Đang tải tuyến...
              </div>
            )}

            {activeTab === 'lookup' && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-700">
                    {routes.length} tuyến phù hợp
                  </div>
                  {(activeFilters.q || activeFilters.from || activeFilters.to || selectedRoute || nearbyStops.length > 0 || bestRouteResult) && (
                    <button
                      type="button"
                      onClick={handleBackToAllRoutes}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      Quay lại
                    </button>
                  )}
                </div>
                {routes.map((route) => {
                  const isSelected = selectedRoute?.routeNumber === route.routeNumber;

                  return (
                    <div key={route.id} className="space-y-3">
                      <RouteCard
                        route={route}
                        compact={activeTab === 'directions'}
                        isHighlighted={isSelected}
                        isFavorite={isRouteFavorite(route)}
                        onSelect={() => {
                          setSelectedRoute(route);
                          setSelectedItinerary(null);
                          setSelectedItineraryDetails(null);
                        }}
                        onToggleFavorite={handleToggleFavoriteRoute}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <MapCanvas
          selectedRoute={selectedRoute}
          selectedItinerary={selectedItinerary}
          focusedItineraryLegIndex={focusedItineraryLegIndex}
          currentLocation={currentLocation}
          liveBusData={liveBusData}
          liveError={liveError}
          arrivalAlerts={[...delayAlerts, ...arrivalAlerts]}
          onDismissArrivalAlert={handleDismissArrivalAlert}
          onSelectItineraryLeg={setFocusedItineraryLegIndex}
          onUseCurrentLocation={handleUseCurrentLocation}
        />
        {selectedItineraryDetails && (
          <ItineraryDetailsPanel
            itinerary={selectedItineraryDetails}
            originPlace={bestRouteResult?.originPlace}
            destinationPlace={bestRouteResult?.destinationPlace}
            focusedLegIndex={focusedItineraryLegIndex}
            onFocusLeg={setFocusedItineraryLegIndex}
            onClose={() => setSelectedItineraryDetails(null)}
          />
        )}
        {selectedRoute && !selectedItineraryDetails && (
          <RouteDetailsPanel
            route={selectedRoute}
            currentLocation={currentLocation}
            liveBusData={isLiveTrackingSelectedRoute ? liveBusData : null}
            isLiveTracking={isLiveTrackingSelectedRoute}
            isLiveLoading={isLiveTrackingSelectedRoute && isLiveLoading}
            liveError={isLiveTrackingSelectedRoute ? liveError : ''}
            isFavorite={isRouteFavorite(selectedRoute)}
            isStopFavorite={isStopFavorite}
            isArrivalNotificationEnabled={isArrivalNotificationEnabled}
            isDelayNotificationEnabled={isDelayNotificationEnabled}
            isRouteChangeNotificationEnabled={isRouteChangeNotificationEnabled}
            panelMessage={routePanelMessage}
            onToggleFavorite={handleToggleFavoriteRoute}
            onToggleFavoriteStop={handleToggleFavoriteStop}
            onToggleArrivalNotification={handleToggleArrivalNotification}
            onToggleDelayNotification={handleToggleDelayNotification}
            onToggleRouteChangeNotification={handleToggleRouteChangeNotification}
            onToggleLiveLocation={handleToggleLiveLocation}
            onPurchaseTicket={handleOpenPurchaseTicket}
            onClose={() => setSelectedRoute(null)}
          />
        )}
      </main>
    </div>
  );
};

export default SearchRoutesPage;
