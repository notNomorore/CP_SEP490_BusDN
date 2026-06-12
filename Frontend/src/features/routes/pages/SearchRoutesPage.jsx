import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  CircleMarker,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import routeService from '../services/routeService';
import useAuthStore from '../../auth/stores/authStore';
import Header from '../../../shared/components/navigation/Header';

const INITIAL_MAP_ZOOM = 13;
const MIN_MAP_ZOOM = 11;
const MAX_MAP_ZOOM = 19;
const DEFAULT_CENTER = { latitude: 16.0614, longitude: 108.2272 };
const DA_NANG_CENTRAL = { name: 'Da Nang Central', latitude: 16.0667, longitude: 108.1690 };
const ROUTE_PREFERENCES = [
  { id: 'fastest', label: 'Fastest Route', icon: 'bolt' },
  { id: 'shortest', label: 'Shortest', icon: 'straighten' },
  { id: 'lowest-cost', label: 'Lowest Cost', icon: 'payments' },
  { id: 'least-traffic', label: 'Least Traffic', icon: 'traffic' },
];

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) {
    return `${remainder} min`;
  }

  return `${hours}h ${remainder}m`;
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
  typeof location?.latitude === 'number' && typeof location?.longitude === 'number'
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

const createBusIcon = (isSelected) => L.divIcon({
  className: '',
  iconAnchor: [18, 46],
  popupAnchor: [0, -44],
  html: `
    <div class="relative flex flex-col items-center">
      <div class="flex h-9 w-9 items-center justify-center rounded-full border-[3px] bg-white shadow-lg ${
        isSelected
          ? 'border-emerald-700 text-emerald-700 ring-[6px] ring-emerald-300/55'
          : 'border-emerald-500 text-emerald-600 ring-2 ring-white/80'
      }">
        <span class="material-symbols-outlined text-[20px]">directions_bus</span>
      </div>
      <div class="h-0 w-0 border-x-[7px] border-x-transparent ${
        isSelected ? 'border-t-emerald-700' : 'border-t-emerald-500'
      } border-t-[10px]"></div>
    </div>
  `,
});

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

const liveBusIcon = (status) => {
  const isDelayed = status === 'Delayed';

  return L.divIcon({
    className: '',
    iconAnchor: [22, 45],
    popupAnchor: [0, -44],
    html: `
      <div class="relative flex flex-col items-center">
        <span class="absolute h-12 w-12 rounded-full ${
          isDelayed ? 'bg-amber-300/35' : 'bg-emerald-300/35'
        } animate-ping"></span>
        <div class="relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white ${
          isDelayed ? 'bg-amber-500' : 'bg-emerald-600'
        } text-white shadow-xl">
          <span class="material-symbols-outlined text-[23px]">directions_bus</span>
        </div>
        <div class="h-0 w-0 border-x-[7px] border-x-transparent ${
          isDelayed ? 'border-t-amber-500' : 'border-t-emerald-600'
        } border-t-[10px]"></div>
      </div>
    `,
  });
};

const RouteLabelIcon = (routeNumber) => L.divIcon({
  className: '',
  iconAnchor: [18, -2],
  html: `<span class="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow">${routeNumber}</span>`,
});

const MapAutoFocus = ({ selectedRoute, currentLocation }) => {
  const map = useMap();

  useEffect(() => {
    const routePath = selectedRoute?.pathPoints?.length
      ? selectedRoute.pathPoints
      : selectedRoute?.stops || [];
    const validPath = routePath.filter(isValidLocation);

    if (validPath.length > 1) {
      map.fitBounds(validPath.map(toLatLng), {
        animate: true,
        maxZoom: 15,
        padding: [80, 80],
      });
      return;
    }

    if (validPath.length === 1) {
      map.setView(toLatLng(validPath[0]), 15, { animate: true });
      return;
    }

    if (isValidLocation(currentLocation)) {
      map.setView(toLatLng(currentLocation), 15, { animate: true });
      return;
    }

    map.setView(toLatLng(DEFAULT_CENTER), INITIAL_MAP_ZOOM, { animate: true });
  }, [currentLocation, map, selectedRoute]);

  return null;
};

const MapCanvas = ({
  stops,
  selectedRoute,
  currentLocation,
  liveBusData,
  liveError,
  onUseCurrentLocation,
}) => {
  const routePath = selectedRoute?.pathPoints?.length
    ? selectedRoute.pathPoints
    : selectedRoute?.stops || [];
  const routePositions = routePath.filter(isValidLocation).map(toLatLng);
  const selectedRouteStop = selectedRoute?.stops
    ?.map(normalizeStopLocation)
    .find(isValidLocation);

  return (
    <section className="relative min-w-0 flex-1 overflow-hidden bg-slate-200">
      <MapContainer
        center={toLatLng(getRouteCenter(selectedRoute))}
        zoom={INITIAL_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        zoomControl={false}
        zoomDelta={0.5}
        zoomSnap={0.25}
        wheelPxPerZoomLevel={160}
        preferCanvas
        className="h-full w-full"
      >
        <TileLayer
          attribution="Map data © OpenStreetMap"
          detectRetina
          keepBuffer={4}
          maxNativeZoom={19}
          maxZoom={MAX_MAP_ZOOM}
          updateWhenIdle
          updateWhenZooming={false}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoFocus selectedRoute={selectedRoute} currentLocation={currentLocation} />
        <ZoomControl position="bottomright" />

        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#ffffff', weight: 12, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#10b981', weight: 7, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#047857', weight: 2, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            {routePositions.map((position) => (
              <CircleMarker
                key={`${position[0]}-${position[1]}`}
                center={position}
                radius={3}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#ffffff',
                  fillOpacity: 1,
                  weight: 1,
                }}
                interactive={false}
              />
            ))}
          </>
        )}

        {stops.filter(isValidLocation).map((stop) => (
          <Marker
            key={`${stop.name}-${stop.latitude.toFixed(5)}-${stop.longitude.toFixed(5)}`}
            position={toLatLng(stop)}
            icon={createBusIcon(stop.routeNumbers?.includes(selectedRoute?.routeNumber))}
            title={stop.name}
            interactive={false}
          />
        ))}

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
            title="Current location"
            interactive={false}
          />
        )}

        {(liveBusData?.buses || []).filter((bus) => isValidLocation(bus.currentLocation)).map((bus) => (
          <Marker
            key={bus.busId}
            position={toLatLng(bus.currentLocation)}
            icon={liveBusIcon(bus.status)}
            title={`${bus.busId} - ${bus.status}`}
            interactive={false}
          />
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={onUseCurrentLocation}
        className="absolute right-5 top-5 z-[1000] flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold shadow-lg hover:bg-emerald-50"
      >
        <span className="material-symbols-outlined text-emerald-600">location_on</span>
        Nearby places
      </button>

      {currentLocation && (
        <div className="absolute right-5 top-24 z-[1000] w-56 rounded-lg bg-white px-4 py-3 text-xs shadow-lg">
          <div className="flex items-center gap-2 font-black uppercase tracking-wide text-slate-950">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Traffic status
          </div>
          <p className="mt-2 leading-5 text-slate-500">
            Nearby routes are being checked from your current GPS position.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-5 right-5 z-[1000] rounded-lg bg-white px-3 py-2 text-xs text-slate-500 shadow">
        Leaflet map © OpenStreetMap
      </div>

      {(liveBusData || liveError) && (
        <div className="absolute right-5 top-24 z-[1000] w-72 rounded-xl bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Live Bus Location</div>
            <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
              liveError ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {liveError ? 'Unavailable' : 'Live'}
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
                    Next stop: {bus.nextStop} • ETA {bus.estimatedArrivalTime}
                  </div>
                </div>
              ))}
            </div>
          )}
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
    className={`relative block w-full rounded-xl border bg-white p-4 pr-14 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md ${
      isHighlighted ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
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
      aria-label={isFavorite ? 'Remove favorite route' : 'Save to favorites'}
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
        <div className="text-[11px] font-semibold uppercase text-slate-500">Trip duration</div>
        <div className="font-semibold text-slate-950">{formatDuration(route.estimatedDurationMinutes)}</div>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Fare</div>
        <div className="font-semibold text-slate-950">{formatFare(route.fare)}</div>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Distance</div>
        <div className="font-semibold text-slate-950">{route.distanceKm} km</div>
      </div>
    </div>

    {!compact && (
      <div className="mt-3">
        <div className="mb-2 text-xs font-bold uppercase text-slate-500">Stops</div>
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
  </article>
);

const RouteDetailsPanel = ({
  route,
  currentLocation,
  liveBusData,
  isLiveTracking = false,
  isLiveLoading = false,
  liveError = '',
  isFavorite = false,
  isStopFavorite,
  onToggleFavorite,
  onToggleFavoriteStop,
  onToggleLiveLocation,
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
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <aside className="fixed bottom-0 right-0 top-[80px] z-[1200] flex w-[360px] max-w-[calc(100vw-24px)] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-200 px-5 py-4">
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
            aria-label="Close route details"
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

        <div className="mt-3 grid grid-cols-4 gap-1">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              title={tab.label}
              className={`min-w-0 truncate rounded-lg border px-1.5 py-2 text-[11px] font-black ${
                detailTab === tab.id
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {detailTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Fare</div>
                <div className="mt-1 font-black text-slate-950">{formatFare(route.fare)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Trip duration</div>
                <div className="mt-1 font-black text-slate-950">{formatDuration(route.estimatedDurationMinutes)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-black uppercase text-slate-400">Distance</div>
                <div className="mt-1 font-black text-slate-950">{route.distanceKm} km</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Operating hours</div>
                  <div className="font-semibold text-slate-700">{firstDeparture} - {lastDeparture}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Departure</div>
                  <div className="font-semibold text-slate-950">{directionOrigin}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-400">Destination</div>
                  <div className="font-semibold text-slate-950">{directionDestination}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-slate-700">
              <div className="mb-1 text-[11px] font-black uppercase text-emerald-700">Route Description</div>
              Optimized route from {directionOrigin} to {directionDestination}, including key stops,
              operating hours, estimated minimum trip duration, fare, and nearby stop support.
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Live Bus Location
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Track active buses on this route with GPS position, status, and next-stop ETA.
                  </p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                  isLiveTracking ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isLiveTracking ? 'Live' : 'Off'}
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
                {isLiveTracking ? 'Stop live location' : 'View live location'}
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
                        Next stop: {bus.nextStop} - ETA {bus.estimatedArrivalTime}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Nearby Stop</div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                  Live
                </span>
              </div>
              {nearestStop ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="font-black text-slate-950">{nearestStop.name}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {nearestStop.distanceKm.toFixed(2)} km from your current location
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  Use current location to show the nearest stop for this route.
                </div>
              )}
            </div>
          </div>
        )}

        {detailTab === 'stops' && (
          <div className="space-y-3">
            {directionStops.map((stop) => (
              <div key={`${route.id}-${directionTab}-stop-${stop.order}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">
                  {stop.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-slate-900">{stop.name}</div>
                  <div className="text-xs text-slate-500">
                    Minimum arrival: {addMinutesToTime(firstDeparture, stop.estimatedOffsetMinutes || 0)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFavoriteStop?.(route, stop)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    isStopFavorite?.(route, stop)
                      ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                  aria-label={isStopFavorite?.(route, stop) ? 'Remove favorite stop' : 'Save stop to favorites'}
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">
                    {isStopFavorite?.(route, stop) ? 'star' : 'star_border'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {detailTab === 'arrival' && (
          <div>
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-3 border-b border-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-400">
                <span>Stop</span>
                <span>Minimum arrival</span>
                <span>Frequency</span>
              </div>
              {directionStops.map((stop) => (
                <div
                  key={`${route.id}-${directionTab}-arrival-${stop.order}`}
                  className="grid grid-cols-3 gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="font-semibold text-slate-800">{stop.name}</span>
                  <span className="text-slate-600">{addMinutesToTime(firstDeparture, stop.estimatedOffsetMinutes || 0)}</span>
                  <span className="text-slate-600">Every {frequencyMinutes} min</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500">
              Minimum arrival time is calculated from the first departure at {firstDeparture}.
            </div>
          </div>
        )}

        {detailTab === 'feedback' && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm font-black text-slate-950">Passenger Feedback</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Feedback for this route will appear here after passengers submit reviews for schedule,
              stop quality, and travel experience.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-500">
              <div className="rounded-lg bg-slate-50 px-2 py-3">Schedule</div>
              <div className="rounded-lg bg-slate-50 px-2 py-3">Stops</div>
              <div className="rounded-lg bg-slate-50 px-2 py-3">Service</div>
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

const PlannerResultCard = ({ result, isRecommended = false, isSelected = false, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-emerald-500 ${
      isSelected || isRecommended ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
    }`}
  >
    {isRecommended && (
      <span className="-mt-5 mb-2 inline-flex rounded bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase text-white">
        Recommended
      </span>
    )}
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
            {result.route.routeNumber}
          </span>
          <h3 className="truncate text-sm font-black text-slate-950">{result.route.name}</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {formatDuration(result.estimatedDurationMinutes)} · {result.estimatedDistanceKm} km
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black uppercase text-emerald-700">
          <span className="material-symbols-outlined text-[14px]">directions_bus</span>
          Bus
        </span>
        <div className="mt-1 text-sm font-black text-slate-950">
          {formatFare(result.estimatedFare || result.route.fare)}
        </div>
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Board</div>
        <div className="truncate font-semibold text-slate-700">{result.startStop.name}</div>
      </div>
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Get off</div>
        <div className="truncate font-semibold text-slate-700">{result.endStop.name}</div>
      </div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Trip duration</div>
        <div className="font-semibold text-slate-700">{formatDuration(result.estimatedDurationMinutes)}</div>
      </div>
      <div className="rounded bg-slate-50 px-2 py-1.5">
        <div className="font-bold uppercase text-slate-400">Distance</div>
        <div className="font-semibold text-slate-700">{result.estimatedDistanceKm} km</div>
      </div>
    </div>
  </button>
);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('lookup');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [bestFrom, setBestFrom] = useState(searchParams.get('from') || '');
  const [bestTo, setBestTo] = useState(searchParams.get('to') || '');
  const [routes, setRoutes] = useState([]);
  const [nearbyStops, setNearbyStops] = useState([]);
  const [bestRouteResult, setBestRouteResult] = useState(null);
  const [routePreference, setRoutePreference] = useState('fastest');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isFindingBest, setIsFindingBest] = useState(false);
  const [error, setError] = useState('');
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [favoriteStops, setFavoriteStops] = useState([]);
  const [favoriteMessage, setFavoriteMessage] = useState('');
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

  const suggestedRouteOptions = useMemo(() => {
    if (!bestRouteResult) {
      return [];
    }

    if (Array.isArray(bestRouteResult.suggestions)) {
      return bestRouteResult.suggestions;
    }

    return [
      ...(bestRouteResult.bestRoute ? [{ ...bestRouteResult.bestRoute, isRecommended: true }] : []),
      ...(bestRouteResult.alternatives || []).map((alternative) => ({
        ...alternative,
        isRecommended: false,
      })),
    ];
  }, [bestRouteResult]);

  const isRouteFavorite = (route) => (
    favoriteRouteIds.has(String(route.id)) || favoriteRouteIds.has(String(route.routeNumber))
  );

  const isStopFavorite = (route, stop) => favoriteStopIds.has(buildStopId(route, stop));
  const isLiveTrackingSelectedRoute = Boolean(
    selectedRoute?.id && isSameRouteId(liveRouteId, selectedRoute.id)
  );

  const mapStops = useMemo(() => {
    const seen = new Set();
    const stops = [];

    for (const route of routes) {
      for (const stop of route.stops || []) {
        const normalizedStop = normalizeStopLocation(stop);
        const key = `${normalizedStop.name}-${normalizedStop.latitude.toFixed(5)}-${normalizedStop.longitude.toFixed(5)}`;

        if (!seen.has(key)) {
          seen.add(key);
          stops.push({ ...normalizedStop, routeNumbers: [route.routeNumber] });
        } else {
          const existingStop = stops.find((item) => (
            `${item.name}-${item.latitude.toFixed(5)}-${item.longitude.toFixed(5)}` === key
          ));

          if (existingStop && !existingStop.routeNumbers.includes(route.routeNumber)) {
            existingStop.routeNumbers.push(route.routeNumber);
          }
        }
      }
    }

    return stops;
  }, [routes]);

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
        return;
      }

      try {
        const [favoriteRouteResult, favoriteStopResult] = await Promise.all([
          routeService.getFavoriteRoutes(),
          routeService.getFavoriteStops(),
        ]);

        if (isMounted) {
          setFavoriteRoutes(favoriteRouteResult || []);
          setFavoriteStops(favoriteStopResult || []);
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

  const clearError = () => {
    if (error) {
      setError('');
    }
    if (favoriteMessage) {
      setFavoriteMessage('');
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();

    if (!query.trim() && !from.trim() && !to.trim()) {
      setError('Please enter a route number, stop, origin, or destination.');
      setRoutes([]);
      return;
    }

    const nextParams = {};

    if (query.trim()) {
      nextParams.q = query.trim();
    }

    if (from.trim()) {
      nextParams.from = from.trim();
    }

    if (to.trim()) {
      nextParams.to = to.trim();
    }

    setSearchParams(nextParams);
  };

  const handleUseCurrentLocation = () => {
    setError('');

    if (!navigator.geolocation) {
      setError('Current location is not supported by this browser.');
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
          2: 'Current location is unavailable.',
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
      return;
    }

    try {
      const result = await routeService.searchRoutes({ q: favoriteRoute.routeNumber });
      const nextRoutes = result.routes || [];
      setRoutes(nextRoutes);
      setSelectedRoute(nextRoutes.find((route) => route.routeNumber === favoriteRoute.routeNumber) || nextRoutes[0] || null);
      setActiveTab('lookup');
    } catch (err) {
      setError(err.message || 'Unable to open favorite route.');
    }
  };

  const handleRemoveFavoriteRoute = async (favoriteRoute) => {
    const routeId = favoriteRoute.routeId
      || routes.find((route) => route.routeNumber === favoriteRoute.routeNumber)?.id;

    if (!routeId) {
      setError('Route not found.');
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
      setError('Stop not found.');
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

  const handleToggleLiveLocation = (route) => {
    clearError();

    if (!route?.id) {
      setLiveError('Bus not found.');
      return;
    }

    if (isSameRouteId(liveRouteId, route.id)) {
      setLiveRouteId(null);
      setLiveBusData(null);
      setLiveError('');
      return;
    }

    setSelectedRoute(route);
    setLiveRouteId(route.id);
    setLiveBusData(null);
    setLiveError('');
  };

  const handleFindBestRoute = async (event) => {
    event.preventDefault();
    setError('');
    setBestRouteResult(null);

    if (!bestFrom.trim() || !bestTo.trim()) {
      setError('Please enter both departure and destination.');
      return;
    }

    setIsFindingBest(true);

    try {
      const result = await routeService.suggestRouteOptions({
        from: bestFrom.trim(),
        to: bestTo.trim(),
        preference: routePreference,
      });

      setBestRouteResult(result);

      const nextSuggestions = Array.isArray(result.suggestions)
        ? result.suggestions
        : [
          ...(result.bestRoute ? [{ ...result.bestRoute, isRecommended: true }] : []),
          ...(result.alternatives || []),
        ];

      if (nextSuggestions.length) {
        const nextRoutes = nextSuggestions.map((item) => item.route);
        setRoutes(nextRoutes);
        setSelectedRoute(nextSuggestions[0].route);
      } else {
        setSelectedRoute(null);
      }
    } catch (err) {
      setError(err.message || 'Unable to suggest route options.');
    } finally {
      setIsFindingBest(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <Header />

      <main className="mt-[80px] flex h-[calc(100vh-80px)]">
        <aside className="z-10 flex w-[420px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl">
          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold ${
                activeTab === 'lookup'
                  ? 'border-b-2 border-emerald-600 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined">search</span>
              LOOKUP
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('directions')}
              className={`flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold ${
                activeTab === 'directions'
                  ? 'border-b-2 border-emerald-600 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined">conversion_path</span>
              DIRECTIONS
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'lookup' ? (
              <>
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-slate-950">Route Planner</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Manage your transit and discover local routes based on your precise current location.
                  </p>

                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-slate-950 px-4 py-3 text-xs font-black uppercase text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isLocating ? 'progress_activity' : 'my_location'}
                    </span>
                    {isLocating ? 'Detecting location...' : 'Use current location'}
                  </button>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Nearby stops</div>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                      Live
                    </span>
                  </div>

                  {currentLocation && (
                    <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-600">
                      <div className="font-bold text-slate-950">Current location detected</div>
                      <div>
                        {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                      </div>
                    </div>
                  )}

                  {isLocating && (
                    <div className="rounded-lg bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600">
                      Detecting your GPS location...
                    </div>
                  )}

                  {!isLocating && currentLocation && nearbyStops.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                      No nearby results found. Please try again later or check location permission.
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

                <form onSubmit={handleSearch} className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Manual search</div>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      clearError();
                    }}
                    placeholder="Search routes or stops..."
                    className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        clearError();
                      }}
                      placeholder="From"
                      className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        clearError();
                      }}
                      placeholder="To"
                      className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700"
                  >
                    <span className="material-symbols-outlined">search</span>
                    Search routes
                  </button>
                </form>

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
            ) : (
              <form onSubmit={handleFindBestRoute} className="space-y-3">
                <input
                  type="text"
                  value={bestFrom}
                  onChange={(event) => {
                    setBestFrom(event.target.value);
                    clearError();
                  }}
                  placeholder="Enter departure"
                  className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={bestTo}
                  onChange={(event) => {
                    setBestTo(event.target.value);
                    clearError();
                  }}
                  placeholder="Enter destination"
                  className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Route preference</div>
                  <div className="grid grid-cols-2 gap-2">
                    {ROUTE_PREFERENCES.map((preference) => {
                      const isActive = routePreference === preference.id;

                      return (
                        <button
                          key={preference.id}
                          type="button"
                          onClick={() => {
                            setRoutePreference(preference.id);
                            clearError();
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                            isActive
                              ? 'border-slate-950 bg-slate-950 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px]">{preference.icon}</span>
                          <span>{preference.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isFindingBest}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined">
                    {isFindingBest ? 'progress_activity' : 'route'}
                  </span>
                  {isFindingBest ? 'Calculating...' : 'Find best route'}
                </button>

                {bestRouteResult && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-emerald-900">Suggested route options</div>
                        <p className="mt-1 text-xs text-emerald-800">
                          Compare bus routes by trip duration, distance, fare, and selected preference.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-emerald-700">
                        {suggestedRouteOptions.length} found
                      </span>
                    </div>

                    {suggestedRouteOptions.length ? (
                      <div className="mt-3 space-y-3">
                        {suggestedRouteOptions.map((suggestion, index) => (
                          <PlannerResultCard
                            key={`${suggestion.route.id}-${suggestion.startStop.name}-${suggestion.endStop.name}`}
                            result={suggestion}
                            isRecommended={suggestion.isRecommended || index === 0}
                            isSelected={selectedRoute?.routeNumber === suggestion.route.routeNumber}
                            onSelect={() => setSelectedRoute(suggestion.route)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                        No route options found. Try another departure, destination, or route preference.
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
                Loading routes...
              </div>
            )}

            {(activeTab === 'lookup' || !bestRouteResult) && (
              <div className="mt-5 space-y-3">
                <div className="text-sm font-bold text-slate-700">
                  {routes.length} route{routes.length === 1 ? '' : 's'} found
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
                        onSelect={() => setSelectedRoute(route)}
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
          stops={mapStops}
          selectedRoute={selectedRoute}
          currentLocation={currentLocation}
          liveBusData={liveBusData}
          liveError={liveError}
          onUseCurrentLocation={handleUseCurrentLocation}
        />
        {selectedRoute && (
          <RouteDetailsPanel
            route={selectedRoute}
            currentLocation={currentLocation}
            liveBusData={isLiveTrackingSelectedRoute ? liveBusData : null}
            isLiveTracking={isLiveTrackingSelectedRoute}
            isLiveLoading={isLiveTrackingSelectedRoute && isLiveLoading}
            liveError={isLiveTrackingSelectedRoute ? liveError : ''}
            isFavorite={isRouteFavorite(selectedRoute)}
            isStopFavorite={isStopFavorite}
            onToggleFavorite={handleToggleFavoriteRoute}
            onToggleFavoriteStop={handleToggleFavoriteStop}
            onToggleLiveLocation={handleToggleLiveLocation}
            onClose={() => setSelectedRoute(null)}
          />
        )}
      </main>
    </div>
  );
};

export default SearchRoutesPage;
