import mongoose from 'mongoose';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import Route from '../routes/Route.js';
import Trip from '../fleetOperations/Trip.js';
import Vehicle from '../fleetOperations/Vehicle.js';
import VehicleLocationLog from '../fleetOperations/VehicleLocationLog.js';
import IncidentReport from '../incidents/IncidentReport.js';
import { createBroadcastNotification } from '../systemNotifications/systemNotification.service.js';

const ACTIVE_TRIP_STATUSES = ['active', 'delayed', 'paused', 'incident'];
const OPEN_INCIDENT_STATUSES = ['PENDING', 'IN_PROGRESS'];
const CRITICAL_INCIDENT_TYPES = ['ACCIDENT', 'VEHICLE_BREAKDOWN'];
const SLOW_SPEED_KMH = 10;
const DELAY_THRESHOLD_MINUTES = 5;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const GPS_WINDOW_MS = 10 * 60 * 1000;
const SLOW_DURATION_MS = 5 * 60 * 1000;
const CONGESTION_EVENT = 'server:analytics:congestionUpdated';
const CONGESTION_NOTIFICATION_EVENT = 'server:notification:congestionBroadcast';
const FLEET_ROOM = 'fleet:operations';

let lastCongestionSnapshot = '';

const toId = (value) => (value ? String(value._id || value) : null);

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const average = (values) => {
  const numericValues = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!numericValues.length) return 0;
  return numericValues.reduce((total, value) => total + value, 0) / numericValues.length;
};

const round = (value, digits = 2) => Number(toNumber(value).toFixed(digits));
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const buildDateRange = ({ from, to } = {}) => {
  const now = new Date();
  const fromDate = toDate(from) || new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const toDateValue = toDate(to) || now;
  return { fromDate, toDate: toDateValue };
};

const routeFilter = (routeId) => (
  routeId && mongoose.isValidObjectId(routeId)
    ? { routeId: new mongoose.Types.ObjectId(routeId) }
    : {}
);

const normalizeRoute = (route) => ({
  id: toId(route._id),
  routeNumber: route.routeNumber || route.code || '',
  routeName: route.name || route.routeName || route.routeNumber || toId(route._id),
  origin: route.origin || route.startPoint || '',
  destination: route.destination || route.endPoint || '',
  estimatedDurationMinutes: toNumber(route.estimatedDurationMinutes || route.durationMinutes),
  distanceKm: toNumber(route.distanceKm || route.distance),
  stops: route.stops || [],
  pathPoints: route.pathPoints || [],
});

const normalizeVehicle = (vehicle) => ({
  id: toId(vehicle._id),
  vehicleCode: vehicle.vehicleCode || vehicle.code || '',
  plateNumber: vehicle.plateNumber || vehicle.licensePlate || '',
  status: vehicle.status || '',
  currentLocation: vehicle.currentLocation || null,
});

const normalizeIncident = (incident) => ({
  id: toId(incident._id),
  routeId: toId(incident.routeId),
  tripId: toId(incident.tripId),
  vehicleId: toId(incident.vehicleId),
  incidentType: incident.incidentType,
  title: incident.title,
  description: incident.description,
  severity: String(incident.severity || '').toLowerCase(),
  status: incident.status,
  location: incident.location || '',
  latitude: incident.latitude ?? null,
  longitude: incident.longitude ?? null,
  createdAt: incident.createdAt,
  updatedAt: incident.updatedAt,
});

const normalizeTrip = (trip, routeMap, vehicleMap) => {
  const routeId = toId(trip.routeId);
  const vehicleId = toId(trip.vehicleId);
  const route = routeMap.get(routeId) || {};
  const plannedStart = toDate(trip.plannedStartTime || trip.scheduledStart || trip.scheduledDepartureTime);
  const plannedEnd = toDate(trip.plannedEndTime || trip.scheduledEnd || trip.scheduledArrivalTime);
  const actualStart = toDate(trip.actualStartTime || trip.actualStart || trip.actualDepartureTime);
  const actualEnd = toDate(trip.actualEndTime || trip.actualEnd || trip.actualArrivalTime);
  const plannedTravelMinutes = toNumber(
    trip.plannedTravelTimeMinutes
    || trip.scheduledTravelTimeMinutes
    || route.estimatedDurationMinutes
    || (plannedStart && plannedEnd ? (plannedEnd - plannedStart) / 60000 : 0)
  );
  const stopOffsetMinutes = route.stops?.[toNumber(trip.currentStopIndex)]?.estimatedOffsetMinutes;
  const plannedSegmentTravelMinutes = toNumber(stopOffsetMinutes, plannedTravelMinutes);
  const actualTravelMinutes = actualStart
    ? (actualEnd || new Date()).getTime() - actualStart.getTime()
    : 0;

  return {
    id: toId(trip._id),
    routeId,
    vehicleId,
    driverId: toId(trip.driverId),
    status: trip.status,
    plannedStartTime: plannedStart,
    plannedEndTime: plannedEnd,
    actualStartTime: actualStart,
    actualEndTime: actualEnd,
    delayMinutes: toNumber(trip.delayMinutes),
    delayReason: trip.delayReason || '',
    progressPercent: toNumber(trip.progressPercent),
    currentStopIndex: toNumber(trip.currentStopIndex),
    nextStopId: toId(trip.nextStopId),
    idleSince: toDate(trip.idleSince),
    lastGpsAt: toDate(trip.lastGpsAt),
    plannedTravelMinutes,
    plannedSegmentTravelMinutes,
    actualTravelMinutes: actualTravelMinutes > 0 ? actualTravelMinutes / 60000 : 0,
    route,
    vehicle: vehicleMap.get(vehicleId) || null,
  };
};

const severityFromDelay = (averageDelayMinutes) => {
  if (averageDelayMinutes > 20) return 'high';
  if (averageDelayMinutes >= 11) return 'medium';
  return 'low';
};

const calculateSeverity = ({ averageDelayMinutes, hasCriticalIncident }) => {
  const base = severityFromDelay(averageDelayMinutes);
  if (base === 'high' && hasCriticalIncident) return 'critical';
  return base;
};

const reasonLabels = {
  delayed_trips: 'At least 2 active trips have delays over 5 minutes',
  slow_speed: 'Average active vehicle speed stayed below 10 km/h for more than 5 minutes',
  congestion_incident: 'Open traffic congestion incident exists on the route',
  travel_time_overrun: 'Actual travel time exceeds planned travel time by more than 20%',
  multiple_idle_vehicles: 'Multiple active vehicles have been idle for more than 5 minutes',
  critical_incident: 'Critical accident or vehicle breakdown incident is open',
};

const buildLocationSummary = (logs) => {
  const validLogs = logs.filter((log) => Number.isFinite(log.lat) && Number.isFinite(log.lng));
  if (!validLogs.length) return null;

  const latitudes = validLogs.map((log) => log.lat);
  const longitudes = validLogs.map((log) => log.lng);
  const centroid = {
    lat: round(average(latitudes), 6),
    lng: round(average(longitudes), 6),
  };

  return {
    centroid,
    bounds: {
      north: round(Math.max(...latitudes), 6),
      south: round(Math.min(...latitudes), 6),
      east: round(Math.max(...longitudes), 6),
      west: round(Math.min(...longitudes), 6),
    },
    slowPointCount: validLogs.length,
    points: validLogs.slice(-20).map((log) => ({
      lat: log.lat,
      lng: log.lng,
      speed: log.speed,
      recordedAt: log.recordedAt,
    })),
  };
};

const routeMatchesArea = (route, incidents, area) => {
  const keyword = normalizeText(area);
  if (!keyword) return true;

  const routeText = [
    route.routeNumber,
    route.routeName,
    route.origin,
    route.destination,
    ...(route.stops || []).map((stop) => `${stop.name || ''} ${stop.location || ''}`),
  ].join(' ');
  const incidentText = incidents
    .filter((incident) => incident.routeId === route.id)
    .map((incident) => incident.location)
    .join(' ');

  return normalizeText(`${routeText} ${incidentText}`).includes(keyword);
};

const loadData = async ({ routeId, from, to } = {}) => {
  const { fromDate, toDate: toDateValue } = buildDateRange({ from, to });
  const activeTripQuery = {
    status: { $in: ACTIVE_TRIP_STATUSES },
    ...routeFilter(routeId),
  };
  const incidentQuery = {
    status: { $in: OPEN_INCIDENT_STATUSES },
    ...(routeId ? routeFilter(routeId) : {}),
  };

  const [routes, trips, incidents] = await Promise.all([
    Route.find(routeId ? { _id: routeId } : {}).lean(),
    Trip.find(activeTripQuery).lean(),
    IncidentReport.find(incidentQuery).sort({ createdAt: -1 }).lean(),
  ]);

  const routeIds = [...new Set([
    ...routes.map((route) => toId(route._id)),
    ...trips.map((trip) => toId(trip.routeId)),
    ...incidents.map((incident) => toId(incident.routeId)),
  ].filter(Boolean))];

  const missingRouteIds = routeIds.filter((id) => !routes.some((route) => toId(route._id) === id));
  const missingRoutes = missingRouteIds.length
    ? await Route.find({ _id: { $in: missingRouteIds } }).lean()
    : [];
  const allRoutes = [...routes, ...missingRoutes].map(normalizeRoute);
  const routeMap = new Map(allRoutes.map((route) => [route.id, route]));

  const vehicleIds = [...new Set(trips.map((trip) => toId(trip.vehicleId)).filter(Boolean))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find({ _id: { $in: vehicleIds } }).lean()
    : [];
  const vehicleMap = new Map(vehicles.map((vehicle) => [toId(vehicle._id), normalizeVehicle(vehicle)]));

  const tripIds = trips.map((trip) => trip._id);
  const locationLogs = tripIds.length
    ? await VehicleLocationLog.find({
      tripId: { $in: tripIds },
      recordedAt: { $gte: new Date(Math.max(fromDate.getTime(), Date.now() - GPS_WINDOW_MS)), $lte: toDateValue },
    }).sort({ recordedAt: 1 }).lean()
    : [];

  return {
    fromDate,
    toDate: toDateValue,
    routes: allRoutes,
    routeMap,
    trips: trips.map((trip) => normalizeTrip(trip, routeMap, vehicleMap)),
    incidents: incidents.map(normalizeIncident),
    locationLogs: locationLogs.map((log) => ({
      id: toId(log._id),
      tripId: toId(log.tripId),
      vehicleId: toId(log.vehicleId),
      lat: toNumber(log.lat, null),
      lng: toNumber(log.lng, null),
      speed: toNumber(log.speed),
      recordedAt: log.recordedAt,
    })),
  };
};

const detectForRoute = ({ route, trips, incidents, locationLogs }) => {
  const routeTrips = trips.filter((trip) => trip.routeId === route.id);
  const routeIncidents = incidents.filter((incident) => toId(incident.routeId) === route.id);
  const tripIds = new Set(routeTrips.map((trip) => trip.id));
  const routeLogs = locationLogs.filter((log) => tripIds.has(log.tripId));
  const delayedTrips = routeTrips.filter((trip) => trip.delayMinutes > DELAY_THRESHOLD_MINUTES);
  const idleTrips = routeTrips.filter((trip) => (
    trip.idleSince && Date.now() - trip.idleSince.getTime() > IDLE_THRESHOLD_MS
  ));
  const slowLogs = routeLogs.filter((log) => log.speed < SLOW_SPEED_KMH);
  const slowDurationMs = slowLogs.length > 1
    ? new Date(slowLogs[slowLogs.length - 1].recordedAt).getTime() - new Date(slowLogs[0].recordedAt).getTime()
    : 0;
  const trafficIncidents = routeIncidents.filter((incident) => incident.incidentType === 'TRAFFIC_CONGESTION');
  const criticalIncidents = routeIncidents.filter((incident) => (
    incident.severity === 'critical' || CRITICAL_INCIDENT_TYPES.includes(incident.incidentType)
  ));
  const travelTimeOverrunTrips = routeTrips.filter((trip) => (
    (trip.plannedSegmentTravelMinutes > 0 && trip.actualTravelMinutes > trip.plannedSegmentTravelMinutes * 1.2)
    || (trip.plannedTravelMinutes > 0 && trip.actualTravelMinutes > trip.plannedTravelMinutes * 1.2)
  ));

  const reasons = [];
  if (delayedTrips.length >= 2) reasons.push('delayed_trips');
  if (average(routeLogs.map((log) => log.speed)) < SLOW_SPEED_KMH && slowDurationMs > SLOW_DURATION_MS) reasons.push('slow_speed');
  if (trafficIncidents.length) reasons.push('congestion_incident');
  if (travelTimeOverrunTrips.length) reasons.push('travel_time_overrun');
  if (idleTrips.length >= 2) reasons.push('multiple_idle_vehicles');
  if (criticalIncidents.length) reasons.push('critical_incident');

  if (!reasons.length) return null;

  const averageDelayMinutes = round(average(routeTrips.map((trip) => trip.delayMinutes)));
  const severity = calculateSeverity({
    averageDelayMinutes,
    hasCriticalIncident: criticalIncidents.length > 0,
  });
  const activeVehicleIds = new Set(routeTrips.map((trip) => trip.vehicleId).filter(Boolean));
  const updatedAtCandidates = [
    ...routeTrips.map((trip) => trip.lastGpsAt || trip.actualStartTime || trip.plannedStartTime),
    ...routeIncidents.map((incident) => incident.updatedAt || incident.createdAt),
    ...routeLogs.map((log) => log.recordedAt),
  ].filter(Boolean).map((date) => new Date(date).getTime());

  return {
    routeId: route.id,
    routeNumber: route.routeNumber,
    routeName: route.routeName,
    origin: route.origin,
    destination: route.destination,
    affectedTripCount: routeTrips.length,
    activeVehicleCount: activeVehicleIds.size,
    averageDelayMinutes,
    averageSpeed: round(average(routeLogs.map((log) => log.speed))),
    congestionSeverity: severity,
    congestionReason: reasons.map((reason) => reasonLabels[reason]),
    congestionReasonCodes: reasons,
    relatedIncidents: routeIncidents,
    affectedArea: buildLocationSummary(slowLogs),
    affectedTrips: routeTrips,
    affectedVehicles: [...activeVehicleIds].map((vehicleId) => routeTrips.find((trip) => trip.vehicleId === vehicleId)?.vehicle).filter(Boolean),
    updatedAt: updatedAtCandidates.length ? new Date(Math.max(...updatedAtCandidates)).toISOString() : new Date().toISOString(),
  };
};

const emitIfChanged = (io, congestedRoutes) => {
  if (!io) return;

  const snapshot = JSON.stringify(congestedRoutes.map((route) => ({
    routeId: route.routeId,
    severity: route.congestionSeverity,
    reasons: route.congestionReasonCodes,
    affectedTripCount: route.affectedTripCount,
  })).sort((left, right) => left.routeId.localeCompare(right.routeId)));

  if (snapshot === lastCongestionSnapshot) return;

  lastCongestionSnapshot = snapshot;
  io.to(FLEET_ROOM).emit(CONGESTION_EVENT, {
    congestedRoutes,
    updatedAt: new Date().toISOString(),
  });
  io.emit(CONGESTION_EVENT, {
    congestedRoutes,
    updatedAt: new Date().toISOString(),
  });
};

export class CongestedRoutesService {
  static async detectCongestedRoutes({ routeId, severity, area, from, to, io } = {}) {
    const data = await loadData({ routeId, from, to });
    const routeMap = new Map(data.routes.map((route) => [route.id, route]));

    data.trips.forEach((trip) => {
      if (trip.routeId && !routeMap.has(trip.routeId)) {
        routeMap.set(trip.routeId, trip.route || { id: trip.routeId, routeName: trip.routeId });
      }
    });

    const detectedRoutes = [...routeMap.values()]
      .filter((route) => routeMatchesArea(route, data.incidents, area))
      .map((route) => detectForRoute({
        route,
        trips: data.trips,
        incidents: data.incidents,
        locationLogs: data.locationLogs,
      }))
      .filter(Boolean)
      .filter((route) => !severity || route.congestionSeverity === String(severity).toLowerCase())
      .sort((left, right) => {
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityRank[right.congestionSeverity] - severityRank[left.congestionSeverity]
          || right.averageDelayMinutes - left.averageDelayMinutes;
      });

    emitIfChanged(io, detectedRoutes);

    return {
      congestedRoutes: detectedRoutes.map(({ affectedTrips, affectedVehicles, ...route }) => route),
      kpis: {
        congestedRoutes: detectedRoutes.length,
        affectedTrips: detectedRoutes.reduce((total, route) => total + route.affectedTripCount, 0),
        highCriticalCongestion: detectedRoutes.filter((route) => ['high', 'critical'].includes(route.congestionSeverity)).length,
        averageDelay: round(average(detectedRoutes.map((route) => route.averageDelayMinutes))),
      },
      filters: {
        routes: data.routes.map((route) => ({
          id: route.id,
          routeNumber: route.routeNumber,
          routeName: route.routeName,
        })),
        severities: ['low', 'medium', 'high', 'critical'],
        area: area || '',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  static async getCongestedRouteDetail(routeId, query = {}) {
    const data = await loadData({ ...query, routeId });
    const route = data.routeMap.get(String(routeId));

    if (!route) {
      throw new CustomError('Route not found', HTTP_STATUS.NOT_FOUND);
    }

    const detected = detectForRoute({
      route,
      trips: data.trips,
      incidents: data.incidents,
      locationLogs: data.locationLogs,
    });

    if (!detected) {
      return {
        route,
        isCongested: false,
        affectedTrips: data.trips.filter((trip) => trip.routeId === String(routeId)),
        relatedIncidents: data.incidents.filter((incident) => toId(incident.routeId) === String(routeId)),
        affectedVehicles: [],
        affectedArea: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      ...detected,
      route,
      isCongested: true,
    };
  }

  static async broadcastCongestionNotification(routeId, query = {}, actor = null, io = null) {
    const detail = await this.getCongestedRouteDetail(routeId, query);

    if (!detail.isCongested) {
      throw new CustomError('Route is not currently congested', HTTP_STATUS.BAD_REQUEST);
    }

    const notificationPayload = {
      title: `Congestion alert: ${detail.routeNumber || detail.routeName}`,
      message: `Route ${detail.routeNumber || detail.routeName} is experiencing ${detail.congestionSeverity} congestion. Expect delays and follow staff guidance.`,
      type: detail.congestionSeverity === 'critical' ? 'emergency' : 'delay_alert',
      priority: detail.congestionSeverity === 'critical' ? 'urgent' : 'high',
      targetAudience: 'route_passengers',
      routeId: detail.routeId,
    };
    const notification = await createBroadcastNotification(
      notificationPayload,
      actor?.userId,
      io
    );

    const payload = {
      routeId: detail.routeId,
      routeNumber: detail.routeNumber,
      routeName: detail.routeName,
      severity: detail.congestionSeverity,
      message: notificationPayload.message,
      notificationId: toId(notification._id),
      affectedTripIds: (detail.affectedTrips || []).map((trip) => trip.id),
      affectedVehicleIds: (detail.affectedVehicles || []).map((vehicle) => vehicle.id),
      relatedIncidentIds: (detail.relatedIncidents || []).map((incident) => incident.id),
      sentBy: actor?.userId || null,
      sentAt: new Date().toISOString(),
    };

    io?.to(FLEET_ROOM).emit(CONGESTION_NOTIFICATION_EVENT, payload);
    io?.emit(CONGESTION_NOTIFICATION_EVENT, payload);

    return {
      delivered: Boolean(io),
      channel: CONGESTION_NOTIFICATION_EVENT,
      target: 'affected_route_passengers_and_staff',
      notificationId: toId(notification._id),
      deliverySummary: notification.deliverySummary || null,
      payload,
    };
  }
}

export default CongestedRoutesService;
