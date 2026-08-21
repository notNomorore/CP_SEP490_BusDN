import { haversineDistanceMeters } from '../../busStops/bus-stop.utils.js';
import routeRecommendationConfig from '../routeRecommendation.config.js';

export class WalkingRoutingService {
  constructor(config = routeRecommendationConfig) {
    this.config = config;
    this.cache = new Map();
  }

  async route({ from, to, allowExternal = true }) {
    const key = [
      allowExternal ? 'external' : 'fallback',
      Number(from?.latitude).toFixed(6),
      Number(from?.longitude).toFixed(6),
      Number(to?.latitude).toFixed(6),
      Number(to?.longitude).toFixed(6),
    ].join(':');

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const route = allowExternal
      ? await this.fetchOsrmWalkingRoute({ from, to }).catch(() => null)
      : null;
    const result = route || this.buildFallbackWalkingRoute({ from, to });
    this.cache.set(key, result);
    return result;
  }

  async fetchOsrmWalkingRoute({ from, to }) {
    if (!this.config.WALKING_OSRM_BASE_URL) {
      return null;
    }

    const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'false',
    });
    const url = `${this.config.WALKING_OSRM_BASE_URL.replace(/\/$/, '')}/route/v1/${this.config.WALKING_OSRM_PROFILE}/${coordinates}?${params.toString()}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.config.WALKING_OSRM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const route = payload.routes?.[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      return null;
    }

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry || null,
      source: 'OSRM_WALKING',
      isFallback: false,
    };
  }

  buildFallbackWalkingRoute({ from, to }) {
    const distanceMeters = haversineDistanceMeters(from, to);
    const durationSeconds = distanceMeters / this.config.FALLBACK_WALKING_SPEED_METERS_PER_SECOND;

    return {
      distanceMeters,
      durationSeconds,
      geometry: null,
      source: 'HAVERSINE_FALLBACK',
      isFallback: true,
    };
  }
}

export default WalkingRoutingService;
