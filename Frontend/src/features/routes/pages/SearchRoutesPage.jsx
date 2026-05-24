import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../../shared/components/navigation/Header';
import Footer from '../../../shared/components/common/Footer';
import routeService from '../services/routeService';

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

const SearchRoutesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [routes, setRoutes] = useState([]);
  const [nearbyStops, setNearbyStops] = useState([]);
  const [locationSummary, setLocationSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState('');

  const activeFilters = useMemo(() => ({
    q: searchParams.get('q') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  }), [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoutes = async () => {
      setIsLoading(true);
      setError('');

      try {
        const result = await routeService.searchRoutes(activeFilters);

        if (isMounted) {
          setRoutes(result.routes || []);
          setNearbyStops([]);
          setLocationSummary(null);
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

  const handleSubmit = (event) => {
    event.preventDefault();

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
          const result = await routeService.searchNearbyRoutes({
            latitude,
            longitude,
            radiusKm: 8,
          });

          setRoutes(result.routes || []);
          setNearbyStops(result.nearbyStops || []);
          setLocationSummary({
            latitude,
            longitude,
            radiusKm: result.radiusKm || 8,
          });
        } catch (err) {
          setError(err.message || 'Unable to find nearby routes.');
          setRoutes([]);
          setNearbyStops([]);
          setLocationSummary(null);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-28">
        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="mb-8">
            <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-on-tertiary-fixed-variant">
              Routes
            </span>
            <h1 className="mt-4 text-4xl font-headline font-black text-primary">
              Search bus routes
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg text-on-surface-variant">
              Search by route number, stop name, origin, or destination.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm md:grid-cols-[1.2fr_1fr_1fr_auto]"
          >
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">Route, stop, or destination</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="DN01, Hoi An, Dragon Bridge"
                className="w-full rounded-xl border-outline-variant/70 bg-surface-container-low px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">From</span>
              <input
                type="text"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                placeholder="Da Nang"
                className="w-full rounded-xl border-outline-variant/70 bg-surface-container-low px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">To</span>
              <input
                type="text"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="Hue"
                className="w-full rounded-xl border-outline-variant/70 bg-surface-container-low px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-on-primary hover:bg-primary-container md:w-auto"
              >
                <span className="material-symbols-outlined">search</span>
                Search
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-primary">Search by current location</div>
              <p className="mt-1 text-sm text-on-surface-variant">
                Use your GPS location to find nearby bus stops and suggested routes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary px-5 font-bold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined">
                {isLocating ? 'progress_activity' : 'my_location'}
              </span>
              {isLocating ? 'Finding...' : 'Use current location'}
            </button>
          </div>

          <div className="mt-8">
            {isLoading && (
              <div className="rounded-xl border border-outline-variant/60 bg-white px-5 py-4 text-on-surface-variant">
                Loading routes...
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-error/20 bg-error-container px-5 py-4 text-on-error-container">
                {error}
              </div>
            )}

            {!isLoading && !error && routes.length === 0 && (
              <div className="rounded-xl border border-outline-variant/60 bg-white px-5 py-8 text-center text-on-surface-variant">
                No matching routes found.
              </div>
            )}

            {!isLoading && !error && routes.length > 0 && (
              <div className="space-y-4">
                {locationSummary && (
                  <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-bold text-primary">Nearby route suggestions</div>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          Showing stops within {locationSummary.radiusKm} km of your current location.
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-on-tertiary-fixed-variant">
                        {nearbyStops.length} nearby stop{nearbyStops.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    {nearbyStops.length > 0 && (
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {nearbyStops.map((stop) => (
                          <div
                            key={`${stop.route.routeNumber}-${stop.order}-${stop.name}`}
                            className="rounded-xl bg-white/80 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-on-surface">{stop.name}</span>
                              <span className="text-sm font-bold text-primary">{stop.distanceKm} km</span>
                            </div>
                            <div className="mt-1 text-sm text-on-surface-variant">
                              {stop.route.routeNumber} - {stop.route.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-sm font-semibold text-on-surface-variant">
                  {routes.length} matching route{routes.length === 1 ? '' : 's'}
                </div>

                {routes.map((route) => (
                  <article
                    key={route.id}
                    className="rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-on-primary">
                            {route.routeNumber}
                          </span>
                          <h2 className="text-2xl font-headline font-black text-primary">
                            {route.name}
                          </h2>
                        </div>
                        <p className="mt-2 text-on-surface-variant">
                          {route.origin} to {route.destination}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center md:min-w-[340px]">
                        <div className="rounded-xl bg-surface-container-low px-3 py-3">
                          <div className="text-xs font-semibold uppercase text-outline">Fare</div>
                          <div className="mt-1 font-bold text-primary">{formatFare(route.fare)}</div>
                        </div>
                        <div className="rounded-xl bg-surface-container-low px-3 py-3">
                          <div className="text-xs font-semibold uppercase text-outline">Time</div>
                          <div className="mt-1 font-bold text-primary">
                            {formatDuration(route.estimatedDurationMinutes)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-surface-container-low px-3 py-3">
                          <div className="text-xs font-semibold uppercase text-outline">Distance</div>
                          <div className="mt-1 font-bold text-primary">{route.distanceKm} km</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <div>
                        <div className="mb-2 text-sm font-semibold text-on-surface">Stops</div>
                        <div className="flex flex-wrap gap-2">
                          {route.stops.map((stop) => (
                            <span
                              key={`${route.id}-${stop.order}`}
                              className="rounded-full border border-outline-variant/70 px-3 py-1 text-sm text-on-surface-variant"
                            >
                              {stop.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-sm text-on-surface-variant">
                        {route.operatingHours.firstDeparture} - {route.operatingHours.lastDeparture}
                        {' '}every {route.operatingHours.frequencyMinutes} min
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SearchRoutesPage;
