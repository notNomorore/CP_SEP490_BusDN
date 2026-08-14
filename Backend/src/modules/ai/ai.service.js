import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import RouteService from '../routes/RouteService.js';

const escapeRegexText = (value) => String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toStringOrEmpty = (value) => (value === undefined || value === null ? '' : String(value));

const sanitizeCoordinate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizeStop = (stop = {}) => ({
  stopId: stop.stopId ? String(stop.stopId) : undefined,
  name: stop.name || stop.stopName || '',
  order: stop.order ?? stop.stopOrder ?? null,
  estimatedOffsetMinutes: stop.estimatedOffsetMinutes ?? stop.arrivalOffsetMinutes ?? null,
  latitude: sanitizeCoordinate(stop.latitude ?? stop.lat),
  longitude: sanitizeCoordinate(stop.longitude ?? stop.lng),
});

const sanitizeStops = (stops = []) => (
  Array.isArray(stops) ? stops.map(sanitizeStop) : []
);

const sanitizeRoute = (route = {}) => {
  const routeId = route.id || route._id || route.routeId || route.routeNumber;

  return {
    routeId: routeId ? String(routeId) : '',
    routeNumber: route.routeNumber || route.routeCode || '',
    routeName: route.name || route.routeName || '',
    origin: route.origin || '',
    destination: route.destination || '',
    stops: sanitizeStops(route.stops),
    directions: route.directions ? {
      OUTBOUND: {
        label: route.directions.OUTBOUND?.label || 'Outbound',
        stops: sanitizeStops(route.directions.OUTBOUND?.stops),
      },
      INBOUND: {
        label: route.directions.INBOUND?.label || 'Inbound',
        stops: sanitizeStops(route.directions.INBOUND?.stops),
      },
    } : undefined,
    distanceKm: Number(route.distanceKm || 0),
    estimatedDurationMinutes: Number(route.estimatedDurationMinutes || 0),
    fare: Number(route.fare || 0),
    operatingHours: route.operatingHours ? {
      firstDeparture: route.operatingHours.firstDeparture || '',
      lastDeparture: route.operatingHours.lastDeparture || '',
      frequencyMinutes: Number(route.operatingHours.frequencyMinutes || 0),
    } : undefined,
    pathPoints: Array.isArray(route.pathPoints)
      ? route.pathPoints.map((point) => ({
        latitude: sanitizeCoordinate(point.latitude ?? point.lat),
        longitude: sanitizeCoordinate(point.longitude ?? point.lng),
      })).filter((point) => point.latitude !== null && point.longitude !== null)
      : [],
    status: route.status || '',
  };
};

const sanitizeRouteSummary = (route = {}) => ({
  routeId: route.id || route._id || route.routeId || route.routeNumber
    ? String(route.id || route._id || route.routeId || route.routeNumber)
    : '',
  routeNumber: route.routeNumber || route.routeCode || '',
  routeName: route.name || route.routeName || '',
  origin: route.origin || '',
  destination: route.destination || '',
  distanceKm: Number(route.distanceKm || 0),
  estimatedDurationMinutes: Number(route.estimatedDurationMinutes || 0),
  fare: Number(route.fare || 0),
});

const sanitizeNearbyStop = (stop = {}) => ({
  name: stop.name || stop.stopName || '',
  order: stop.order ?? stop.stopOrder ?? null,
  latitude: sanitizeCoordinate(stop.latitude ?? stop.lat),
  longitude: sanitizeCoordinate(stop.longitude ?? stop.lng),
  distanceKm: Number(stop.distanceKm || 0),
  route: sanitizeRouteSummary(stop.route),
});

const sanitizeRouteOption = (option = {}) => ({
  route: sanitizeRoute(option.route),
  startStop: option.startStop ? sanitizeStop(option.startStop) : null,
  endStop: option.endStop ? sanitizeStop(option.endStop) : null,
  estimatedDurationMinutes: Number(option.estimatedDurationMinutes || 0),
  estimatedDistanceKm: Number(option.estimatedDistanceKm || 0),
  estimatedFare: Number(option.estimatedFare || 0),
  isRecommended: Boolean(option.isRecommended),
});

const sanitizeStopEta = (eta = {}) => ({
  stopId: eta.stopId ? String(eta.stopId) : undefined,
  stopName: eta.stopName || '',
  stopOrder: eta.stopOrder ?? null,
  etaMinutes: eta.etaMinutes ?? null,
  estimatedArrivalTime: eta.estimatedArrivalTime || '',
  status: eta.status || '',
});

const sanitizeTripProgressStop = (stop = {}) => ({
  stopId: stop.stopId ? String(stop.stopId) : undefined,
  stopName: stop.stopName || '',
  stopOrder: stop.stopOrder ?? null,
});

const sanitizeTripProgress = (progress = {}) => ({
  progressPercent: Number(progress.progressPercent || 0),
  currentStop: progress.currentStop || '',
  currentStopIndex: progress.currentStopIndex ?? null,
  nextStop: progress.nextStop || '',
  totalStops: progress.totalStops ?? null,
  estimatedRemainingTime: progress.estimatedRemainingTime || '',
  completedStops: Array.isArray(progress.completedStops)
    ? progress.completedStops.map(sanitizeTripProgressStop)
    : [],
  remainingStops: Array.isArray(progress.remainingStops)
    ? progress.remainingStops.map(sanitizeTripProgressStop)
    : [],
  tripStatus: progress.tripStatus || '',
});

const sanitizeLocation = (location = {}) => {
  const latitude = sanitizeCoordinate(location.latitude ?? location.lat);
  const longitude = sanitizeCoordinate(location.longitude ?? location.lng);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    heading: location.heading ?? null,
  };
};

const sanitizePublicBus = (bus = {}, index = 0) => ({
  publicBusId: `${bus.routeNumber || 'route'}-bus-${index + 1}`,
  routeNumber: bus.routeNumber || '',
  currentLocation: sanitizeLocation(bus.currentLocation),
  nextStop: bus.nextStop || '',
  estimatedArrivalTime: bus.estimatedArrivalTime || '',
  operationalStatus: bus.status || '',
  delay: bus.delay ? {
    delayDurationMinutes: Number(bus.delay.delayDurationMinutes || 0),
    delayReason: bus.delay.delayReason || '',
    updatedEta: bus.delay.updatedEta || '',
  } : null,
  lastUpdated: bus.lastUpdated || null,
});

const sanitizeRouteChange = (routeChange) => {
  if (!routeChange) {
    return null;
  }

  return {
    changeId: routeChange.changeId || '',
    routeId: routeChange.routeId || '',
    routeNumber: routeChange.routeNumber || '',
    reasonForChange: routeChange.reasonForChange || '',
    changedStops: Array.isArray(routeChange.changedStops)
      ? routeChange.changedStops.map((stop) => ({
        stopName: stop.stopName || '',
        changeType: stop.changeType || '',
      }))
      : [],
    updatedRoutePath: routeChange.updatedRoutePath || '',
    alternativeSuggestion: routeChange.alternativeSuggestion || '',
    status: routeChange.status || '',
    detectedAt: routeChange.detectedAt || null,
  };
};

const toRouteNotFound = (error) => {
  if (error.message === 'Bus not found') {
    return new CustomError('Route not found', HTTP_STATUS.NOT_FOUND);
  }
  return error;
};

export class AiService {
  static async searchRoutes(query = {}) {
    const params = {
      q: escapeRegexText(query.q),
      from: escapeRegexText(query.from),
      to: escapeRegexText(query.to),
    };
    const routes = await RouteService.searchRoutes(params);

    return {
      routes: routes.map(sanitizeRoute),
      count: routes.length,
      filters: {
        q: toStringOrEmpty(query.q).trim(),
        from: toStringOrEmpty(query.from).trim(),
        to: toStringOrEmpty(query.to).trim(),
      },
    };
  }

  static async suggestRoutes(query = {}) {
    const result = await RouteService.suggestRouteOptions({
      from: escapeRegexText(query.from),
      to: escapeRegexText(query.to),
      preference: query.preference || 'fastest',
    });
    const suggestions = (result.suggestions || []).map(sanitizeRouteOption);

    return {
      departureLocation: toStringOrEmpty(query.from).trim(),
      destinationLocation: toStringOrEmpty(query.to).trim(),
      transportationType: 'bus',
      suggestions,
      count: suggestions.length,
      totalMatches: result.totalMatches || result.count || 0,
      bestRoute: result.bestRoute ? sanitizeRouteOption({ ...result.bestRoute, isRecommended: true }) : null,
      alternatives: (result.alternatives || []).map((item) => sanitizeRouteOption({
        ...item,
        isRecommended: false,
      })),
      criteria: result.criteria ? {
        from: toStringOrEmpty(query.from).trim(),
        to: toStringOrEmpty(query.to).trim(),
        preference: result.criteria.preference,
        optimizedBy: result.criteria.optimizedBy,
      } : null,
    };
  }

  static async findNearbyRoutes(query = {}) {
    const result = await RouteService.findNearbyRoutes({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm || 5,
    });

    return {
      userLocation: result.userLocation,
      radiusKm: result.radiusKm,
      nearbyStops: (result.nearbyStops || []).map(sanitizeNearbyStop),
      routes: (result.routes || []).map(sanitizeRoute),
      count: result.routes?.length || 0,
    };
  }

  static async getLiveRoute(routeId) {
    try {
      const result = await RouteService.getLiveBusLocations(routeId);

      return {
        route: sanitizeRouteSummary(result.route),
        buses: (result.buses || []).map(sanitizePublicBus),
        routeChange: sanitizeRouteChange(result.routeChange),
        count: result.buses?.length || 0,
        refreshedAt: result.refreshedAt,
      };
    } catch (error) {
      throw toRouteNotFound(error);
    }
  }

  static async getRouteEta(routeId) {
    try {
      const result = await RouteService.getEstimatedArrivalTimes(routeId);
      const tripProgress = (result.tripProgress || [])
        .filter(Boolean)
        .map(sanitizeTripProgress);

      return {
        route: sanitizeRouteSummary(result.route),
        stopEtaSummary: (result.stopEtaSummary || []).map(sanitizeStopEta),
        tripProgress,
        refreshedAt: result.refreshedAt,
      };
    } catch (error) {
      throw toRouteNotFound(error);
    }
  }
}

export default AiService;
