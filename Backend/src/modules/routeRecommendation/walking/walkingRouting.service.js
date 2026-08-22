import { haversineDistanceMeters } from '../../busStops/bus-stop.utils.js';
import routeRecommendationConfig from '../routeRecommendation.config.js';

const normalizeText = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export class WalkingRoutingService {
  constructor(config = routeRecommendationConfig) {
    this.config = config;
    this.cache = new Map();
    this.unsafeStepKeywords = (config.WALKING_AVOID_STEP_KEYWORDS || []).map(normalizeText);
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
    const result = route?.isAccessible === false
      ? route
      : route || this.buildFallbackWalkingRoute({ from, to });
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
      steps: 'true',
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

    const unsafeStep = this.findUnsafeStep(route);
    if (unsafeStep) {
      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        geometry: null,
        source: 'OSRM_WALKING',
        isFallback: false,
        isAccessible: false,
        blockedReason: 'UNSAFE_WALKING_SEGMENT',
        blockedStepName: unsafeStep.name || '',
      };
    }

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry || null,
      source: 'OSRM_WALKING',
      isFallback: false,
      isAccessible: true,
    };
  }

  findUnsafeStep(route) {
    if (!this.unsafeStepKeywords.length) {
      return null;
    }

    const steps = (route.legs || []).flatMap((leg) => leg.steps || []);
    return steps.find((step) => {
      const normalizedName = normalizeText(step.name || '');
      return this.unsafeStepKeywords.some((keyword) => normalizedName.includes(keyword));
    }) || null;
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
      isAccessible: true,
    };
  }
}

export default WalkingRoutingService;
