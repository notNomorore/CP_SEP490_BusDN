import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import routeService from '../services/routeService';
import useAuthStore from '../../auth/stores/authStore';

const INITIAL_MAP_ZOOM = 13;
const MIN_MAP_ZOOM = 11;
const MAX_MAP_ZOOM = 19;
const DEFAULT_CENTER = { latitude: 16.0614, longitude: 108.2272 };

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

const RouteLabelIcon = (routeNumber) => L.divIcon({
  className: '',
  iconAnchor: [18, -2],
  html: `<span class="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow">${routeNumber}</span>`,
});

const MapAutoFocus = ({ selectedRoute, currentLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (isValidLocation(currentLocation)) {
      map.setView(toLatLng(currentLocation), 15, { animate: true });
      return;
    }

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

    map.setView(toLatLng(DEFAULT_CENTER), INITIAL_MAP_ZOOM, { animate: true });
  }, [currentLocation, map, selectedRoute]);

  return null;
};

const MapCanvas = ({
  stops,
  selectedRoute,
  currentLocation,
  onUseCurrentLocation,
  query,
  setQuery,
  onSearch,
  clearError,
}) => {
  const routePath = selectedRoute?.pathPoints?.length
    ? selectedRoute.pathPoints
    : selectedRoute?.stops || [];
  const routePositions = routePath.filter(isValidLocation).map(toLatLng);
  const selectedRouteStop = selectedRoute?.stops?.find(isValidLocation);

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
          </>
        )}

        {stops.filter(isValidLocation).map((stop) => (
          <Marker
            key={`${stop.routeNumber}-${stop.name}`}
            position={toLatLng(stop)}
            icon={createBusIcon(selectedRoute?.routeNumber === stop.routeNumber)}
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
      </MapContainer>

      <div className="absolute left-6 top-5 z-[1000] flex w-[440px] max-w-[calc(100%-48px)] items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-lg">
        <span className="material-symbols-outlined text-slate-500">search</span>
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            clearError();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSearch(event);
            }
          }}
          placeholder="Search places or routes..."
          className="w-full border-0 p-0 text-sm focus:ring-0"
        />
      </div>

      <button
        type="button"
        onClick={onUseCurrentLocation}
        className="absolute right-5 top-5 z-[1000] flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold shadow-lg hover:bg-emerald-50"
      >
        <span className="material-symbols-outlined text-emerald-600">location_on</span>
        Nearby places
      </button>

      <div className="pointer-events-none absolute bottom-5 right-5 z-[1000] rounded-lg bg-white px-3 py-2 text-xs text-slate-500 shadow">
        Leaflet map © OpenStreetMap
      </div>
    </section>
  );
};
const RouteCard = ({ route, compact = false, isHighlighted = false, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`block w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md ${
      isHighlighted ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
    }`}
  >
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-slate-600">
        <span className="material-symbols-outlined text-[22px]">directions_bus</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
            {route.routeNumber}
          </span>
          <h3 className="truncate text-base font-bold text-slate-950">{route.name}</h3>
        </div>
        <p className="mt-1 text-sm text-slate-700">
          {route.origin} - {route.destination}
        </p>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div className="rounded-lg bg-slate-50 px-2 py-2">
        <div className="text-[11px] font-semibold uppercase text-slate-500">Time</div>
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
  </button>
);

const SearchRoutesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('lookup');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [bestFrom, setBestFrom] = useState(searchParams.get('from') || '');
  const [bestTo, setBestTo] = useState(searchParams.get('to') || '');
  const [routes, setRoutes] = useState([]);
  const [nearbyStops, setNearbyStops] = useState([]);
  const [bestRouteResult, setBestRouteResult] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isFindingBest, setIsFindingBest] = useState(false);
  const [error, setError] = useState('');

  const activeFilters = useMemo(() => ({
    q: searchParams.get('q') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  }), [searchParams]);

  const mapStops = useMemo(() => {
    const seen = new Set();
    const stops = [];

    for (const route of routes) {
      for (const stop of route.stops || []) {
        const key = `${stop.name}-${stop.latitude}-${stop.longitude}`;

        if (!seen.has(key)) {
          seen.add(key);
          stops.push({ ...stop, routeNumber: route.routeNumber });
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

  const clearError = () => {
    if (error) {
      setError('');
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
      const result = await routeService.findBestRoute({
        from: bestFrom.trim(),
        to: bestTo.trim(),
      });

      setBestRouteResult(result);

      if (result.bestRoute?.route) {
        const nextRoutes = [result.bestRoute.route, ...(result.alternatives || []).map((item) => item.route)];
        setRoutes(nextRoutes);
        setSelectedRoute(result.bestRoute.route);
      }
    } catch (err) {
      setError(err.message || 'Unable to calculate the best route.');
    } finally {
      setIsFindingBest(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/login';
  };

  const displayName = user?.fullName?.trim() || 'User';

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <header className="flex h-[54px] items-center justify-between bg-emerald-600 px-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/70">
            <span className="material-symbols-outlined">directions_bus</span>
          </div>
          <span className="text-2xl font-black">BusDN Map</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="hidden items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 md:inline-flex"
          >
            <span className="material-symbols-outlined text-[20px]">my_location</span>
            Current location
          </button>
          <div className="hidden h-6 w-px bg-white/30 md:block" />
          <span className="rounded-full bg-emerald-800 px-3 py-1 text-sm font-bold">VI</span>
          <span className="hidden text-sm font-semibold md:inline">{displayName}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/50 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex h-[calc(100vh-54px)]">
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
                <form onSubmit={handleSearch} className="space-y-3">
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

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 px-4 py-3 font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined">
                    {isLocating ? 'progress_activity' : 'my_location'}
                  </span>
                  {isLocating ? 'Finding nearby stops...' : 'Use current location'}
                </button>

                {nearbyStops.length > 0 && (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-3">
                    <div className="text-sm font-bold text-emerald-800">Nearby stops</div>
                    <div className="mt-2 space-y-2">
                      {nearbyStops.slice(0, 4).map((stop) => (
                        <div
                          key={`${stop.route.routeNumber}-${stop.name}`}
                          className="rounded-lg bg-white px-3 py-2 text-sm"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-semibold">{stop.name}</span>
                            <span className="font-bold text-emerald-700">{stop.distanceKm} km</span>
                          </div>
                          <div className="text-slate-500">{stop.route.routeNumber} - {stop.route.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  <div className="rounded-xl bg-emerald-50 p-3">
                    {bestRouteResult.bestRoute ? (
                      <>
                        <div className="text-sm font-bold text-emerald-800">Recommended route</div>
                        <RouteCard
                          route={bestRouteResult.bestRoute.route}
                          compact
                          isHighlighted
                          onSelect={() => setSelectedRoute(bestRouteResult.bestRoute.route)}
                        />
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg bg-white p-3">
                            <div className="text-xs font-semibold uppercase text-slate-500">Board at</div>
                            <div className="font-semibold">{bestRouteResult.bestRoute.startStop.name}</div>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <div className="text-xs font-semibold uppercase text-slate-500">Get off at</div>
                            <div className="font-semibold">{bestRouteResult.bestRoute.endStop.name}</div>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <div className="text-xs font-semibold uppercase text-slate-500">Time</div>
                            <div className="font-semibold">
                              {formatDuration(bestRouteResult.bestRoute.estimatedDurationMinutes)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <div className="text-xs font-semibold uppercase text-slate-500">Distance</div>
                            <div className="font-semibold">{bestRouteResult.bestRoute.estimatedDistanceKm} km</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-700">
                        No direct suitable route found for this departure and destination.
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

            {isLoading && (
              <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Loading routes...
              </div>
            )}

            <div className="mt-5 space-y-3">
              <div className="text-sm font-bold text-slate-700">
                {routes.length} route{routes.length === 1 ? '' : 's'} found
              </div>
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  compact={activeTab === 'directions'}
                  isHighlighted={selectedRoute?.id === route.id}
                  onSelect={() => setSelectedRoute(route)}
                />
              ))}
            </div>
          </div>
        </aside>

        <MapCanvas
          stops={mapStops}
          selectedRoute={selectedRoute}
          currentLocation={currentLocation}
          onUseCurrentLocation={handleUseCurrentLocation}
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          clearError={clearError}
        />
      </main>
    </div>
  );
};

export default SearchRoutesPage;
