import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import User from '../auth/User.js';
import IncidentReport from '../incidents/IncidentReport.js';
import Route from '../routes/Route.js';
import Trip from '../fleetOperations/Trip.js';
import Vehicle from '../fleetOperations/Vehicle.js';
import VehicleLocationLog from '../fleetOperations/VehicleLocationLog.js';
import TripSchedule from '../admin/TripSchedule.js';
import OperationAlert from '../fleetOperations/OperationAlert.js';

const ACTIVE_TRIP_STATUSES = ['active', 'paused', 'delayed', 'incident'];
const OPEN_INCIDENT_STATUSES = ['PENDING', 'IN_PROGRESS'];
const DELAY_RELEVANT_INCIDENT_TYPES = ['TRAFFIC_CONGESTION', 'ACCIDENT', 'VEHICLE_BREAKDOWN'];
const CRITICAL_INCIDENT_TYPES = ['ACCIDENT', 'VEHICLE_BREAKDOWN'];
const VISIBLE_VEHICLE_STATUSES = ['active', 'idle', 'available'];
const SYSTEM_INCIDENT_TYPES = ['GPS_LOST_SIGNAL', 'VEHICLE_IDLE_TOO_LONG', 'SEVERE_DELAY'];
const GPS_LOST_SIGNAL_MINUTES = 5;
const VEHICLE_IDLE_TOO_LONG_MINUTES = 10;
const SEVERE_DELAY_MINUTES = 20;

const DA_NANG_POINTS = [
  [16.0678, 108.2208],
  [16.0544, 108.2022],
  [16.0471, 108.2068],
  [16.0719, 108.2241],
  [16.0606, 108.2469],
  [16.0755, 108.1692],
  [16.0327, 108.2245],
  [16.0804, 108.2141],
];

const normalizeId = (value) => String(value || '').trim();
const isObjectId = (value) => mongoose.isValidObjectId(value);
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

const minutesAgo = (date, now = new Date()) => {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - new Date(date).getTime()) / 60000);
};

export const computeOperationalStatus = ({
  tripStatus,
  delayMinutes = 0,
  speed = 0,
  lastGpsAt,
  hasOpenIncident = false,
  now = new Date(),
}) => {
  const staleMinutes = minutesAgo(lastGpsAt, now);

  if (tripStatus === 'incident' || hasOpenIncident) return 'incident';
  if (tripStatus === 'delayed' || Number(delayMinutes) > 5) return 'delayed';
  if (staleMinutes > 2) return 'lost_signal';
  if (Number(speed) <= 2 && staleMinutes > 3) return 'idle';
  if (tripStatus === 'active' && staleMinutes <= 1) return 'active';
  if (Number(speed) <= 2) return 'idle';
  return tripStatus || 'active';
};

const calculateStartDelayMinutes = (trip) => {
  if (!trip?.actualStartTime || !trip?.plannedStartTime) return 0;
  const diff = new Date(trip.actualStartTime).getTime() - new Date(trip.plannedStartTime).getTime();
  return diff > 0 ? Math.floor(diff / 60000) : 0;
};

const calculateIdleDelayMinutes = (trip, vehicle, now = new Date()) => {
  const speed = Number(vehicle?.currentLocation?.speed || 0);
  const idleStart = trip?.idleSince || vehicle?.currentLocation?.updatedAt || trip?.lastGpsAt;
  if (trip?.status !== 'active' || speed > 2 || !idleStart) return 0;
  return Math.floor(minutesAgo(idleStart, now));
};

const severityFromMinutes = (delayMinutes) => {
  if (delayMinutes > 20) return 'severe';
  if (delayMinutes >= 11) return 'moderate';
  if (delayMinutes > 5) return 'minor';
  return '';
};

export const calculateDelayStatus = (trip, vehicle, incidents = [], now = new Date()) => {
  const openDelayIncidents = incidents.filter((incident) => (
    OPEN_INCIDENT_STATUSES.includes(incident.status)
    && DELAY_RELEVANT_INCIDENT_TYPES.includes(incident.incidentType)
  ));
  const criticalIncident = openDelayIncidents.find((incident) => CRITICAL_INCIDENT_TYPES.includes(incident.incidentType));
  const persistedDelay = Number(trip?.delayMinutes || 0);
  const startDelay = calculateStartDelayMinutes(trip);
  const idleDelay = calculateIdleDelayMinutes(trip, vehicle, now);
  const statusDelay = trip?.status === 'delayed' ? Math.max(persistedDelay, 6) : 0;
  const incidentDelay = openDelayIncidents.length ? Math.max(persistedDelay, 6) : 0;
  const delayMinutes = Math.max(persistedDelay, startDelay, idleDelay, statusDelay, incidentDelay);
  const evidence = [];

  if (persistedDelay > 5) evidence.push({ type: 'stored_delay', minutes: persistedDelay });
  if (trip?.status === 'delayed') evidence.push({ type: 'trip_status', status: trip.status });
  if (startDelay > 5) evidence.push({ type: 'late_start', minutes: startDelay });
  if (idleDelay > 5) evidence.push({ type: 'idle_vehicle', minutes: idleDelay, speed: vehicle?.currentLocation?.speed || 0 });
  openDelayIncidents.forEach((incident) => evidence.push({
    type: 'open_incident',
    incidentId: incident._id?.toString(),
    incidentType: incident.incidentType,
    severity: incident.severity,
  }));

  const isDelayed = delayMinutes > 5 || evidence.length > 0;
  let reason = trip?.delayReason || '';
  if (!reason) {
    if (criticalIncident) reason = criticalIncident.incidentType === 'ACCIDENT' ? 'accident_incident' : 'breakdown_incident';
    else if (openDelayIncidents.some((incident) => incident.incidentType === 'TRAFFIC_CONGESTION')) reason = 'traffic_congestion';
    else if (idleDelay > 5) reason = 'vehicle_idle';
    else if (startDelay > 5) reason = 'late_departure';
    else if (trip?.status === 'delayed') reason = 'status_marked_delayed';
    else if (persistedDelay > 5) reason = 'reported_delay';
  }

  let severity = severityFromMinutes(delayMinutes);
  if (severity === 'severe' && criticalIncident) severity = 'critical';

  return {
    isDelayed,
    delayMinutes,
    severity: isDelayed ? severity || 'minor' : '',
    reason,
    evidence,
  };
};

const getRouteSummary = (route) => {
  if (!route) return null;
  return {
    id: route._id?.toString(),
    routeCode: route.routeNumber || route.routeCode || route.code || '',
    routeName: route.name || route.routeName || '',
  };
};

const normalizeStop = (stop, index = 0) => {
  if (!stop) return null;
  return {
    id: stop._id?.toString() || String(index),
    name: stop.name || stop.stopName || '',
    order: stop.order ?? index + 1,
    estimatedOffsetMinutes: stop.estimatedOffsetMinutes ?? null,
    lat: stop.latitude ?? stop.lat ?? null,
    lng: stop.longitude ?? stop.lng ?? null,
  };
};

const getRouteStops = (route) => (route?.stops || [])
  .map((stop, index) => normalizeStop(stop, index))
  .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

const getCurrentStop = (route, currentStopIndex = 0) => {
  const stops = getRouteStops(route);
  if (!stops.length) return null;
  return stops[Math.min(Math.max(Number(currentStopIndex) || 0, 0), stops.length - 1)] || null;
};

const getNextStop = (route, stopId, currentStopIndex = 0) => {
  const stops = route?.stops || [];
  if (!stops.length) return null;

  if (stopId) {
    const match = stops.find((stop) => String(stop._id) === String(stopId));
    if (match) return normalizeStop(match, stops.indexOf(match));
  }

  const fallback = stops[Math.min(Number(currentStopIndex) + 1, stops.length - 1)];
  if (!fallback) return null;

  return normalizeStop(fallback, stops.indexOf(fallback));
};

const calculateProgressPercent = (trip, route, now = new Date()) => {
  const stops = getRouteStops(route);
  const currentStopIndex = Number(trip.currentStopIndex);

  if (stops.length > 1 && Number.isFinite(currentStopIndex)) {
    return clamp((currentStopIndex / (stops.length - 1)) * 100);
  }

  if (trip.progressPercent !== undefined && trip.progressPercent !== null) {
    return clamp(trip.progressPercent);
  }

  if (trip.plannedStartTime && trip.plannedEndTime) {
    const start = new Date(trip.plannedStartTime).getTime();
    const end = new Date(trip.plannedEndTime).getTime();
    const current = now.getTime();

    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return clamp(((current - start) / (end - start)) * 100);
    }
  }

  return 0;
};

const getPassengerLoad = (trip, vehicle) => {
  const passengerCount = trip.passengerCount ?? trip.occupancy?.passengerCount ?? null;
  const capacity = vehicle?.capacity || trip.capacity || null;
  let occupancyStatus = trip.occupancyStatus || null;

  if (!occupancyStatus && passengerCount !== null && capacity) {
    const ratio = Number(passengerCount) / Number(capacity);
    if (ratio >= 0.9) occupancyStatus = 'FULL';
    else if (ratio >= 0.65) occupancyStatus = 'HIGH';
    else if (ratio >= 0.35) occupancyStatus = 'MEDIUM';
    else occupancyStatus = 'LOW';
  }

  return { passengerCount, occupancyStatus, capacity };
};

const buildDto = ({ trip, vehicle, route, driver, openIncidentCount, now }) => {
  const location = vehicle?.currentLocation || {};
  const lastGpsAt = trip?.lastGpsAt || location.updatedAt;
  const operationalStatus = computeOperationalStatus({
    tripStatus: trip.status,
    delayMinutes: trip.delayMinutes,
    speed: location.speed,
    lastGpsAt,
    hasOpenIncident: openIncidentCount > 0,
    now,
  });

  return {
    id: `${vehicle._id}:${trip._id}`,
    vehicleId: vehicle._id?.toString(),
    vehicleCode: vehicle.vehicleCode,
    plateNumber: vehicle.plateNumber,
    route: getRouteSummary(route),
    routeId: route?._id?.toString() || trip.routeId?.toString(),
    tripId: trip._id?.toString(),
    tripCode: trip.tripCode || trip._id?.toString(),
    driver: driver ? {
      id: driver._id?.toString(),
      fullName: driver.fullName,
    } : null,
    currentLocation: {
      lat: location.lat,
      lng: location.lng,
      heading: location.heading,
      speed: location.speed || 0,
      updatedAt: location.updatedAt || lastGpsAt,
    },
    speed: location.speed || 0,
    heading: location.heading,
    lastGpsAt,
    currentStop: getCurrentStop(route, trip.currentStopIndex),
    nextStop: getNextStop(route, trip.nextStopId, trip.currentStopIndex),
    tripStatus: trip.status,
    operationalStatus,
    delayMinutes: trip.delayMinutes || 0,
    currentStopIndex: trip.currentStopIndex || 0,
    progressPercent: calculateProgressPercent(trip, route, now),
    openIncidentCount,
  };
};

const buildActiveTripDto = ({
  trip,
  vehicle,
  route,
  driver,
  assistant,
  schedule,
  openIncidentCount,
  now,
}) => {
  const location = vehicle?.currentLocation || {};
  const lastGpsAt = trip.lastGpsAt || location.updatedAt || schedule?.gpsSync?.syncedAt || null;
  const operationalStatus = computeOperationalStatus({
    tripStatus: trip.status,
    delayMinutes: trip.delayMinutes,
    speed: location.speed,
    lastGpsAt,
    hasOpenIncident: openIncidentCount > 0,
    now,
  });
  const load = getPassengerLoad(trip, vehicle);

  return {
    id: trip._id?.toString(),
    tripId: trip._id?.toString(),
    tripCode: trip.tripCode || schedule?.scheduleCode || trip._id?.toString(),
    routeId: route?._id?.toString() || trip.routeId?.toString(),
    route: getRouteSummary(route) || {
      id: trip.routeId?.toString(),
      routeCode: schedule?.routeCode || '',
      routeName: schedule?.routeName || '',
    },
    vehicle: vehicle ? {
      id: vehicle._id?.toString(),
      vehicleCode: vehicle.vehicleCode,
      plateNumber: vehicle.plateNumber,
      capacity: vehicle.capacity,
      status: vehicle.status,
    } : schedule?.vehicle ? {
      id: schedule.vehicle.busId?.toString(),
      vehicleCode: schedule.vehicle.busCode,
      plateNumber: schedule.vehicle.plateNumber,
      capacity: schedule.vehicle.capacity,
      status: null,
    } : null,
    driver: driver ? {
      id: driver._id?.toString(),
      fullName: driver.fullName,
      phoneNumber: driver.phoneNumber,
    } : schedule?.driver?.userId ? {
      id: schedule.driver.userId?.toString(),
      fullName: schedule.driver.fullName,
      phoneNumber: schedule.driver.phone,
    } : null,
    assistant: assistant ? {
      id: assistant._id?.toString(),
      fullName: assistant.fullName,
      phoneNumber: assistant.phoneNumber,
    } : schedule?.assistant?.userId ? {
      id: schedule.assistant.userId?.toString(),
      fullName: schedule.assistant.fullName,
      phoneNumber: schedule.assistant.phone,
    } : null,
    plannedStartTime: trip.plannedStartTime,
    plannedEndTime: trip.plannedEndTime,
    actualStartTime: trip.actualStartTime || schedule?.actualStartAt || null,
    actualEndTime: trip.actualEndTime || schedule?.actualEndAt || null,
    status: trip.status,
    tripStatus: trip.status,
    operationalStatus,
    currentStop: getCurrentStop(route, trip.currentStopIndex),
    nextStop: getNextStop(route, trip.nextStopId, trip.currentStopIndex),
    currentStopIndex: trip.currentStopIndex || 0,
    totalStops: getRouteStops(route).length,
    progressPercent: calculateProgressPercent(trip, route, now),
    delayMinutes: trip.delayMinutes || 0,
    passengerCount: load.passengerCount,
    occupancyStatus: load.occupancyStatus,
    lastGpsAt,
    currentLocation: {
      lat: location.lat ?? schedule?.startLocation?.latitude ?? null,
      lng: location.lng ?? schedule?.startLocation?.longitude ?? null,
      heading: location.heading ?? null,
      speed: location.speed || 0,
      updatedAt: location.updatedAt || lastGpsAt,
    },
    openIncidentCount,
  };
};

const matchesKeyword = (dto, keyword) => {
  if (!keyword) return true;
  const value = keyword.toLowerCase();
  return [
    dto.vehicleCode,
    dto.plateNumber,
    dto.route?.routeCode,
    dto.route?.routeName,
    dto.driver?.fullName,
    dto.assistant?.fullName,
    dto.vehicle?.vehicleCode,
    dto.vehicle?.plateNumber,
    dto.tripCode,
  ].some((field) => String(field || '').toLowerCase().includes(value));
};

const sortActiveTrips = (items, sort = 'lastGpsAt') => {
  const [field, direction = 'desc'] = String(sort || 'lastGpsAt').split(':');
  const multiplier = direction === 'asc' ? 1 : -1;
  const valueOf = (item) => {
    if (field === 'delayMinutes') return Number(item.delayMinutes || 0);
    if (field === 'startTime') return new Date(item.actualStartTime || item.plannedStartTime || 0).getTime();
    if (field === 'route') return `${item.route?.routeCode || ''} ${item.route?.routeName || ''}`.toLowerCase();
    if (field === 'lastGpsAt') return item.lastGpsAt ? new Date(item.lastGpsAt).getTime() : 0;
    return item.lastGpsAt ? new Date(item.lastGpsAt).getTime() : 0;
  };

  return [...items].sort((left, right) => {
    const leftValue = valueOf(left);
    const rightValue = valueOf(right);
    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return String(leftValue).localeCompare(String(rightValue)) * multiplier;
    }
    return (leftValue - rightValue) * multiplier;
  });
};

const getIncidentSummary = (incidents = []) => {
  const incident = incidents.find((item) => (
    OPEN_INCIDENT_STATUSES.includes(item.status)
    && DELAY_RELEVANT_INCIDENT_TYPES.includes(item.incidentType)
  ));
  if (!incident) return null;
  return {
    id: incident._id?.toString(),
    type: incident.incidentType,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    createdAt: incident.createdAt,
  };
};

const buildDelayedTripDto = ({
  trip,
  vehicle,
  route,
  driver,
  schedule,
  incidents,
  delayStatus,
  now,
}) => ({
  id: trip._id?.toString(),
  tripId: trip._id?.toString(),
  tripCode: trip.tripCode || schedule?.scheduleCode || trip._id?.toString(),
  routeId: route?._id?.toString() || trip.routeId?.toString(),
  route: getRouteSummary(route) || {
    id: trip.routeId?.toString(),
    routeCode: schedule?.routeCode || '',
    routeName: schedule?.routeName || '',
  },
  vehicle: vehicle ? {
    id: vehicle._id?.toString(),
    vehicleCode: vehicle.vehicleCode,
    plateNumber: vehicle.plateNumber,
  } : null,
  driver: driver ? {
    id: driver._id?.toString(),
    fullName: driver.fullName,
  } : null,
  plannedStartTime: trip.plannedStartTime,
  actualStartTime: trip.actualStartTime || schedule?.actualStartAt || null,
  nextStop: getNextStop(route, trip.nextStopId, trip.currentStopIndex),
  delayMinutes: delayStatus.delayMinutes,
  delaySeverity: delayStatus.severity,
  delayReason: delayStatus.reason,
  delayEvidence: delayStatus.evidence,
  delayAcknowledgedBy: trip.delayAcknowledgedBy || null,
  delayAcknowledgedAt: trip.delayAcknowledgedAt || null,
  operationNotes: trip.operationNotes || [],
  lastGpsAt: trip.lastGpsAt || vehicle?.currentLocation?.updatedAt || null,
  relatedIncident: getIncidentSummary(incidents),
  tripStatus: trip.status,
  currentLocation: {
    lat: vehicle?.currentLocation?.lat ?? null,
    lng: vehicle?.currentLocation?.lng ?? null,
    speed: vehicle?.currentLocation?.speed || 0,
    heading: vehicle?.currentLocation?.heading ?? null,
    updatedAt: vehicle?.currentLocation?.updatedAt || null,
  },
  detectedAt: now,
});

const buildSystemIncidentCandidates = ({ trip, vehicle, now }) => {
  const location = vehicle?.currentLocation || {};
  const lastGpsAt = trip.lastGpsAt || location.updatedAt;
  const staleGpsMinutes = minutesAgo(lastGpsAt, now);
  const speed = Number(location.speed || 0);
  const idleStart = trip.idleSince || (speed <= 2 ? location.updatedAt || trip.lastGpsAt : null);
  const idleMinutes = idleStart ? minutesAgo(idleStart, now) : 0;
  const delayMinutes = Number(trip.delayMinutes || 0);
  const candidates = [];

  if (staleGpsMinutes >= GPS_LOST_SIGNAL_MINUTES) {
    candidates.push({
      incidentType: 'GPS_LOST_SIGNAL',
      title: 'GPS lost signal',
      description: `No GPS update received for ${Math.floor(staleGpsMinutes)} minutes.`,
      severity: staleGpsMinutes >= 15 ? 'HIGH' : 'MEDIUM',
      location: 'Last known vehicle position',
      latitude: location.lat ?? null,
      longitude: location.lng ?? null,
      tripStatus: 'incident',
    });
  }

  if (idleMinutes >= VEHICLE_IDLE_TOO_LONG_MINUTES) {
    candidates.push({
      incidentType: 'VEHICLE_IDLE_TOO_LONG',
      title: 'Vehicle idle too long',
      description: `Vehicle speed has remained near zero for ${Math.floor(idleMinutes)} minutes.`,
      severity: idleMinutes >= 20 ? 'HIGH' : 'MEDIUM',
      location: 'Current vehicle position',
      latitude: location.lat ?? null,
      longitude: location.lng ?? null,
      tripStatus: 'incident',
    });
  }

  if (delayMinutes >= SEVERE_DELAY_MINUTES) {
    candidates.push({
      incidentType: 'SEVERE_DELAY',
      title: 'Severe trip delay',
      description: `Trip is delayed by ${delayMinutes} minutes.`,
      severity: delayMinutes >= 45 ? 'CRITICAL' : 'HIGH',
      location: 'Current trip',
      latitude: location.lat ?? null,
      longitude: location.lng ?? null,
      tripStatus: 'delayed',
    });
  }

  if (candidates.some((candidate) => candidate.tripStatus === 'incident')) {
    return candidates.map((candidate) => ({
      ...candidate,
      tripStatus: candidate.incidentType === 'SEVERE_DELAY' ? 'incident' : candidate.tripStatus,
    }));
  }

  return candidates;
};

export class FleetMonitoringService {
  static async scanSystemIncidents(actor = {}, io = null) {
    const now = new Date();
    const trips = await Trip.find({ status: { $in: ACTIVE_TRIP_STATUSES } }).lean();
    const vehicleIds = [...new Set(trips.map((trip) => normalizeId(trip.vehicleId)).filter(Boolean))];
    const tripIds = trips.map((trip) => trip._id);

    const [vehicles, existingIncidents] = await Promise.all([
      Vehicle.find({ _id: { $in: vehicleIds } }).lean(),
      IncidentReport.find({
        tripId: { $in: tripIds },
        incidentType: { $in: SYSTEM_INCIDENT_TYPES },
        status: { $in: OPEN_INCIDENT_STATUSES },
      }).lean(),
    ]);

    const vehicleMap = new Map(vehicles.map((vehicle) => [normalizeId(vehicle._id), vehicle]));
    const existingKeys = new Set(existingIncidents.map((incident) => `${normalizeId(incident.tripId)}:${incident.incidentType}`));
    const created = [];

    for (const trip of trips) {
      const vehicle = vehicleMap.get(normalizeId(trip.vehicleId));
      const candidates = buildSystemIncidentCandidates({ trip, vehicle, now });

      for (const candidate of candidates) {
        const duplicateKey = `${normalizeId(trip._id)}:${candidate.incidentType}`;
        if (existingKeys.has(duplicateKey)) continue;

        const incident = await IncidentReport.create({
          reporterId: actor.userId || null,
          reporterRole: 'SYSTEM',
          incidentType: candidate.incidentType,
          title: candidate.title,
          description: candidate.description,
          routeId: trip.routeId,
          tripId: trip._id,
          vehicleId: trip.vehicleId,
          location: candidate.location,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          severity: candidate.severity,
          status: 'PENDING',
        });

        await Trip.findByIdAndUpdate(trip._id, {
          $set: {
            status: candidate.tripStatus,
            ...(candidate.incidentType === 'SEVERE_DELAY' ? {
              delayMinutes: Math.max(Number(trip.delayMinutes || 0), SEVERE_DELAY_MINUTES),
              delayReason: 'severe_delay',
            } : {}),
          },
        });

        const alert = await OperationAlert.create({
          targetRole: 'admin',
          title: incident.title,
          message: incident.description,
          type: candidate.incidentType.toLowerCase(),
          relatedIncidentId: incident._id,
          relatedTripId: incident.tripId,
        });

        const payload = {
          incident: {
            id: incident._id?.toString(),
            tripId: incident.tripId,
            vehicleId: incident.vehicleId,
            routeId: incident.routeId,
            reporterId: incident.reporterId,
            reporterRole: 'system',
            type: candidate.incidentType.toLowerCase(),
            severity: incident.severity.toLowerCase(),
            description: incident.description,
            location: {
              lat: incident.latitude,
              lng: incident.longitude,
            },
            status: 'new',
            createdAt: incident.createdAt,
          },
          alert: {
            id: alert._id?.toString(),
            targetRole: alert.targetRole,
            type: alert.type,
          },
        };

        io?.to('fleet:operations').emit('server:incident:new', payload);
        io?.to('fleet:operations').emit('server:trip:statusUpdated', {
          tripId: trip._id?.toString(),
          vehicleId: trip.vehicleId?.toString(),
          status: candidate.tripStatus,
          delayMinutes: candidate.incidentType === 'SEVERE_DELAY' ? Math.max(Number(trip.delayMinutes || 0), SEVERE_DELAY_MINUTES) : trip.delayMinutes || 0,
          lastGpsAt: trip.lastGpsAt,
        });

        created.push(payload);
        existingKeys.add(duplicateKey);
      }
    }

    return {
      createdCount: created.length,
      incidents: created,
      scannedTrips: trips.length,
      generatedAt: now.toISOString(),
    };
  }

  static async getActiveTrips(query = {}) {
    const now = new Date();
    const tripFilter = { status: { $in: ACTIVE_TRIP_STATUSES } };

    if (query.routeId && isObjectId(query.routeId)) tripFilter.routeId = new mongoose.Types.ObjectId(query.routeId);
    if (query.driverId && isObjectId(query.driverId)) tripFilter.driverId = new mongoose.Types.ObjectId(query.driverId);
    if (query.vehicleId && isObjectId(query.vehicleId)) tripFilter.vehicleId = new mongoose.Types.ObjectId(query.vehicleId);
    if (query.status && ACTIVE_TRIP_STATUSES.includes(query.status)) tripFilter.status = query.status;

    const trips = await Trip.find(tripFilter)
      .sort({ lastGpsAt: -1, plannedStartTime: -1 })
      .lean();

    const vehicleIds = [...new Set(trips.map((trip) => normalizeId(trip.vehicleId)).filter(Boolean))];
    const routeIds = [...new Set(trips.map((trip) => normalizeId(trip.routeId)).filter(Boolean))];
    const staffIds = [...new Set(trips.flatMap((trip) => [normalizeId(trip.driverId), normalizeId(trip.assistantId)]).filter(Boolean))];
    const scheduleIds = [...new Set(trips.map((trip) => normalizeId(trip.scheduleId)).filter(Boolean))];
    const tripIds = trips.map((trip) => trip._id);

    const [vehicles, routes, staff, schedules, incidentCounts] = await Promise.all([
      Vehicle.find({ _id: { $in: vehicleIds } }).lean(),
      Route.find({ _id: { $in: routeIds } }).lean(),
      User.find({ _id: { $in: staffIds } }).select('fullName phoneNumber role').lean(),
      TripSchedule.find({ _id: { $in: scheduleIds } }).lean(),
      IncidentReport.aggregate([
        { $match: { tripId: { $in: tripIds }, status: { $in: OPEN_INCIDENT_STATUSES } } },
        { $group: { _id: '$tripId', count: { $sum: 1 } } },
      ]),
    ]);

    const vehicleMap = new Map(vehicles.map((item) => [normalizeId(item._id), item]));
    const routeMap = new Map(routes.map((item) => [normalizeId(item._id), item]));
    const staffMap = new Map(staff.map((item) => [normalizeId(item._id), item]));
    const scheduleMap = new Map(schedules.map((item) => [normalizeId(item._id), item]));
    const incidentMap = new Map(incidentCounts.map((item) => [normalizeId(item._id), item.count]));
    const keyword = String(query.keyword || '').trim();

    const activeTrips = sortActiveTrips(
      trips
        .map((trip) => buildActiveTripDto({
          trip,
          vehicle: vehicleMap.get(normalizeId(trip.vehicleId)),
          route: routeMap.get(normalizeId(trip.routeId)),
          driver: staffMap.get(normalizeId(trip.driverId)),
          assistant: staffMap.get(normalizeId(trip.assistantId)),
          schedule: scheduleMap.get(normalizeId(trip.scheduleId)),
          openIncidentCount: incidentMap.get(normalizeId(trip._id)) || 0,
          now,
        }))
        .filter((item) => (query.status && !ACTIVE_TRIP_STATUSES.includes(query.status)
          ? item.operationalStatus === query.status
          : true))
        .filter((item) => matchesKeyword(item, keyword)),
      query.sort
    );

    return {
      trips: activeTrips,
      kpis: {
        totalActiveTrips: activeTrips.length,
        onTimeTrips: activeTrips.filter((item) => ['active', 'idle'].includes(item.operationalStatus)).length,
        delayedTrips: activeTrips.filter((item) => item.operationalStatus === 'delayed').length,
        tripsWithIncidents: activeTrips.filter((item) => item.openIncidentCount > 0 || item.operationalStatus === 'incident').length,
      },
      filters: {
        routes: [...new Map(activeTrips.map((item) => [item.routeId, item.route]).filter(([, route]) => route)).values()],
        statuses: ACTIVE_TRIP_STATUSES,
        operationalStatuses: ['active', 'idle', 'delayed', 'incident', 'lost_signal'],
        drivers: [...new Map(activeTrips.map((item) => [item.driver?.id, item.driver]).filter(([id]) => id)).values()],
        vehicles: [...new Map(activeTrips.map((item) => [item.vehicle?.id, item.vehicle]).filter(([id]) => id)).values()],
      },
      generatedAt: now.toISOString(),
    };
  }

  static async getActiveTripDetail(tripId) {
    if (!isObjectId(tripId)) {
      throw new CustomError('Valid tripId is required', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const now = new Date();
    const trip = await Trip.findById(tripId).lean();
    if (!trip || !ACTIVE_TRIP_STATUSES.includes(trip.status)) {
      throw new CustomError('Active trip not found', HTTP_STATUS.NOT_FOUND);
    }

    const [vehicle, route, driver, assistant, schedule, incidents, locationLogs] = await Promise.all([
      Vehicle.findById(trip.vehicleId).lean(),
      Route.findById(trip.routeId).lean(),
      User.findById(trip.driverId).select('fullName phoneNumber role staffMetrics').lean(),
      trip.assistantId ? User.findById(trip.assistantId).select('fullName phoneNumber role staffMetrics').lean() : null,
      trip.scheduleId ? TripSchedule.findById(trip.scheduleId).lean() : null,
      IncidentReport.find({ tripId: trip._id, status: { $in: OPEN_INCIDENT_STATUSES } })
        .select('incidentType title description severity status location latitude longitude createdAt reporterRole')
        .sort({ createdAt: -1 })
        .lean(),
      VehicleLocationLog.find({ tripId: trip._id })
        .sort({ recordedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const summary = buildActiveTripDto({
      trip,
      vehicle,
      route,
      driver,
      assistant,
      schedule,
      openIncidentCount: incidents.length,
      now,
    });

    const timeline = [
      { label: 'Planned start', time: trip.plannedStartTime, status: 'planned' },
      { label: 'Actual start', time: trip.actualStartTime || schedule?.actualStartAt || null, status: 'actual' },
      { label: 'Last GPS update', time: summary.lastGpsAt, status: 'gps' },
      { label: 'Planned end', time: trip.plannedEndTime, status: 'planned' },
    ].filter((item) => item.time);

    return {
      ...summary,
      routeStops: getRouteStops(route).map((stop, index) => ({
        ...stop,
        state: index < summary.currentStopIndex ? 'passed' : index === summary.currentStopIndex ? 'current' : 'upcoming',
      })),
      timeline,
      vehicleLocation: summary.currentLocation,
      staff: {
        driver: summary.driver,
        assistant: summary.assistant,
      },
      schedule: schedule ? {
        id: schedule._id?.toString(),
        scheduleCode: schedule.scheduleCode,
        serviceDate: schedule.serviceDate,
        direction: schedule.direction,
        departureTime: schedule.departureTime,
        expectedArrivalTime: schedule.expectedArrivalTime,
        shiftLabel: schedule.shiftLabel,
        status: schedule.status,
      } : null,
      incidents: incidents.map((incident) => ({
        id: incident._id?.toString(),
        incidentType: incident.incidentType,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        location: incident.location,
        latitude: incident.latitude,
        longitude: incident.longitude,
        reporterRole: incident.reporterRole,
        createdAt: incident.createdAt,
      })),
      gpsHistory: locationLogs.map((log) => ({
        id: log._id?.toString(),
        lat: log.lat,
        lng: log.lng,
        speed: log.speed,
        heading: log.heading,
        recordedAt: log.recordedAt,
      })),
    };
  }

  static async getDelayedTrips(query = {}) {
    const now = new Date();
    const tripFilter = { status: { $nin: ['completed', 'cancelled'] } };

    if (query.routeId && isObjectId(query.routeId)) tripFilter.routeId = new mongoose.Types.ObjectId(query.routeId);
    if (query.from || query.to) {
      tripFilter.plannedStartTime = {};
      if (query.from) tripFilter.plannedStartTime.$gte = new Date(query.from);
      if (query.to) tripFilter.plannedStartTime.$lte = new Date(query.to);
    }

    const trips = await Trip.find(tripFilter)
      .sort({ plannedStartTime: -1 })
      .lean();

    const vehicleIds = [...new Set(trips.map((trip) => normalizeId(trip.vehicleId)).filter(Boolean))];
    const routeIds = [...new Set(trips.map((trip) => normalizeId(trip.routeId)).filter(Boolean))];
    const driverIds = [...new Set(trips.map((trip) => normalizeId(trip.driverId)).filter(Boolean))];
    const scheduleIds = [...new Set(trips.map((trip) => normalizeId(trip.scheduleId)).filter(Boolean))];
    const tripIds = trips.map((trip) => trip._id);

    const [vehicles, routes, drivers, schedules, incidents] = await Promise.all([
      Vehicle.find({ _id: { $in: vehicleIds } }).lean(),
      Route.find({ _id: { $in: routeIds } }).lean(),
      User.find({ _id: { $in: driverIds } }).select('fullName role').lean(),
      TripSchedule.find({ _id: { $in: scheduleIds } }).lean(),
      IncidentReport.find({ tripId: { $in: tripIds }, status: { $in: OPEN_INCIDENT_STATUSES } })
        .select('tripId incidentType title description severity status createdAt')
        .lean(),
    ]);

    const vehicleMap = new Map(vehicles.map((item) => [normalizeId(item._id), item]));
    const routeMap = new Map(routes.map((item) => [normalizeId(item._id), item]));
    const driverMap = new Map(drivers.map((item) => [normalizeId(item._id), item]));
    const scheduleMap = new Map(schedules.map((item) => [normalizeId(item._id), item]));
    const incidentMap = incidents.reduce((map, incident) => {
      const key = normalizeId(incident.tripId);
      map.set(key, [...(map.get(key) || []), incident]);
      return map;
    }, new Map());

    const delayedTrips = [];
    const persistenceUpdates = [];

    trips.forEach((trip) => {
      const vehicle = vehicleMap.get(normalizeId(trip.vehicleId));
      const tripIncidents = incidentMap.get(normalizeId(trip._id)) || [];
      const delayStatus = calculateDelayStatus(trip, vehicle, tripIncidents, now);
      if (!delayStatus.isDelayed) return;

      const dto = buildDelayedTripDto({
        trip,
        vehicle,
        route: routeMap.get(normalizeId(trip.routeId)),
        driver: driverMap.get(normalizeId(trip.driverId)),
        schedule: scheduleMap.get(normalizeId(trip.scheduleId)),
        incidents: tripIncidents,
        delayStatus,
        now,
      });

      delayedTrips.push(dto);

      if (
        trip.status !== 'delayed'
        || Number(trip.delayMinutes || 0) !== delayStatus.delayMinutes
        || trip.delayReason !== delayStatus.reason
      ) {
        persistenceUpdates.push({
          updateOne: {
            filter: { _id: trip._id },
            update: {
              $set: {
                status: 'delayed',
                delayMinutes: delayStatus.delayMinutes,
                delayReason: delayStatus.reason,
              },
            },
          },
        });
      }
    });

    if (persistenceUpdates.length) {
      await Trip.bulkWrite(persistenceUpdates);
    }

    const filtered = delayedTrips
      .filter((trip) => (query.severity ? trip.delaySeverity === query.severity : true))
      .filter((trip) => (query.reason ? trip.delayReason === query.reason : true))
      .sort((left, right) => Number(right.delayMinutes || 0) - Number(left.delayMinutes || 0));

    return {
      trips: filtered,
      kpis: {
        delayedTripsTotal: filtered.length,
        minor: filtered.filter((trip) => trip.delaySeverity === 'minor').length,
        moderate: filtered.filter((trip) => trip.delaySeverity === 'moderate').length,
        severeCritical: filtered.filter((trip) => ['severe', 'critical'].includes(trip.delaySeverity)).length,
      },
      filters: {
        routes: [...new Map(delayedTrips.map((item) => [item.routeId, item.route]).filter(([, route]) => route)).values()],
        severities: ['minor', 'moderate', 'severe', 'critical'],
        reasons: [...new Set(delayedTrips.map((trip) => trip.delayReason).filter(Boolean))],
      },
      generatedAt: now.toISOString(),
    };
  }

  static async acknowledgeDelayedTrip(tripId, payload = {}, actor = {}, io = null) {
    if (!isObjectId(tripId)) {
      throw new CustomError('Valid tripId is required', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const note = String(payload.note || '').trim();
    const reason = String(payload.reason || '').trim();
    if (!note || !reason) {
      throw new CustomError('Reason and note are required', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const trip = await Trip.findById(tripId);
    if (!trip) throw new CustomError('Trip not found', HTTP_STATUS.NOT_FOUND);

    const [vehicle, incidents] = await Promise.all([
      Vehicle.findById(trip.vehicleId).lean(),
      IncidentReport.find({ tripId: trip._id, status: { $in: OPEN_INCIDENT_STATUSES } }).lean(),
    ]);
    const delayStatus = calculateDelayStatus(trip.toObject(), vehicle, incidents);
    if (!delayStatus.isDelayed) {
      throw new CustomError('Trip is not currently delayed', HTTP_STATUS.CONFLICT);
    }

    trip.status = 'delayed';
    trip.delayMinutes = delayStatus.delayMinutes;
    trip.delayReason = reason;
    trip.delayAcknowledgedBy = actor.userId;
    trip.delayAcknowledgedAt = new Date();
    trip.operationNotes.push({
      note,
      reason,
      createdBy: actor.userId,
      createdAt: new Date(),
    });

    await trip.save();

    let alert = null;
    if (payload.notifyTargetRole) {
      alert = await OperationAlert.create({
        targetRole: String(payload.notifyTargetRole).toLowerCase(),
        title: `Trip delay acknowledged: ${trip._id}`,
        message: note,
        type: 'trip_delay',
        relatedTripId: trip._id,
      });
    }

    const [route, driver, schedule] = await Promise.all([
      Route.findById(trip.routeId).lean(),
      User.findById(trip.driverId).select('fullName role').lean(),
      trip.scheduleId ? TripSchedule.findById(trip.scheduleId).lean() : null,
    ]);
    const result = buildDelayedTripDto({
      trip: trip.toObject(),
      vehicle,
      route,
      driver,
      schedule,
      incidents,
      delayStatus: calculateDelayStatus(trip.toObject(), vehicle, incidents),
      now: new Date(),
    });

    io?.to('fleet:operations').emit('server:trip:delayed', result);
    io?.to('fleet:operations').emit('server:trip:statusUpdated', {
      tripId: result.tripId,
      vehicleId: result.vehicle?.id,
      status: 'delayed',
      delayMinutes: result.delayMinutes,
      delayReason: result.delayReason,
      delayAcknowledgedAt: result.delayAcknowledgedAt,
    });

    return {
      trip: result,
      alert: alert ? {
        id: alert._id?.toString(),
        targetRole: alert.targetRole,
        type: alert.type,
      } : null,
    };
  }

  static async getFleetLocations(query = {}) {
    const now = new Date();
    const tripFilter = { status: { $in: ACTIVE_TRIP_STATUSES } };

    if (query.routeId && isObjectId(query.routeId)) {
      tripFilter.routeId = new mongoose.Types.ObjectId(query.routeId);
    }

    const trips = await Trip.find(tripFilter)
      .sort({ lastGpsAt: -1, plannedStartTime: -1 })
      .lean();

    const vehicleIds = [...new Set(trips.map((trip) => normalizeId(trip.vehicleId)).filter(Boolean))];
    const routeIds = [...new Set(trips.map((trip) => normalizeId(trip.routeId)).filter(Boolean))];
    const driverIds = [...new Set(trips.map((trip) => normalizeId(trip.driverId)).filter(Boolean))];
    const tripIds = trips.map((trip) => trip._id);

    const [vehicles, routes, drivers, incidentCounts] = await Promise.all([
      Vehicle.find({ _id: { $in: vehicleIds } }).lean(),
      Route.find({ _id: { $in: routeIds } }).lean(),
      User.find({ _id: { $in: driverIds } }).select('fullName role').lean(),
      IncidentReport.aggregate([
        { $match: { tripId: { $in: tripIds }, status: { $in: OPEN_INCIDENT_STATUSES } } },
        { $group: { _id: '$tripId', count: { $sum: 1 } } },
      ]),
    ]);

    const vehicleMap = new Map(vehicles.map((item) => [normalizeId(item._id), item]));
    const routeMap = new Map(routes.map((item) => [normalizeId(item._id), item]));
    const driverMap = new Map(drivers.map((item) => [normalizeId(item._id), item]));
    const incidentMap = new Map(incidentCounts.map((item) => [normalizeId(item._id), item.count]));

    const fleet = trips
      .map((trip) => {
        const vehicle = vehicleMap.get(normalizeId(trip.vehicleId));
        if (!vehicle) return null;

        const hasActiveReason = (
          VISIBLE_VEHICLE_STATUSES.includes(vehicle.status)
          || ACTIVE_TRIP_STATUSES.includes(trip.status)
          || incidentMap.get(normalizeId(trip._id)) > 0
        );
        if (!hasActiveReason || !vehicle.currentLocation?.lat || !vehicle.currentLocation?.lng) {
          return null;
        }

        return buildDto({
          trip,
          vehicle,
          route: routeMap.get(normalizeId(trip.routeId)),
          driver: driverMap.get(normalizeId(trip.driverId)),
          openIncidentCount: incidentMap.get(normalizeId(trip._id)) || 0,
          now,
        });
      })
      .filter(Boolean)
      .filter((item) => (query.status ? item.operationalStatus === query.status : true))
      .filter((item) => matchesKeyword(item, String(query.keyword || '').trim()));

    return {
      fleet,
      kpis: {
        activeBuses: fleet.filter((item) => item.operationalStatus === 'active').length,
        delayedBuses: fleet.filter((item) => item.operationalStatus === 'delayed').length,
        lostSignalBuses: fleet.filter((item) => item.operationalStatus === 'lost_signal').length,
        incidentBuses: fleet.filter((item) => item.operationalStatus === 'incident').length,
      },
      filters: {
        routes: [...new Map(fleet.map((item) => [item.routeId, item.route]).filter(([, route]) => route)).values()],
        statuses: ['active', 'idle', 'delayed', 'incident', 'lost_signal'],
      },
      generatedAt: now.toISOString(),
    };
  }

  static async updateDriverGps(payload, actor = {}, io = null) {
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const speed = Number(payload.speed || 0);
    const heading = payload.heading === undefined ? null : Number(payload.heading);
    const recordedAt = payload.timestamp || payload.recordedAt ? new Date(payload.timestamp || payload.recordedAt) : new Date();

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new CustomError('Latitude must be between -90 and 90', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new CustomError('Longitude must be between -180 and 180', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading > 360)) {
      throw new CustomError('Heading must be between 0 and 360', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (!isObjectId(payload.tripId) || !isObjectId(payload.vehicleId)) {
      throw new CustomError('Valid vehicleId and tripId are required', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const trip = await Trip.findById(payload.tripId);
    if (!trip) throw new CustomError('Trip not found', HTTP_STATUS.NOT_FOUND);
    if (!ACTIVE_TRIP_STATUSES.includes(trip.status)) {
      throw new CustomError('Trip is not active for GPS updates', HTTP_STATUS.CONFLICT);
    }
    if (normalizeId(trip.vehicleId) !== normalizeId(payload.vehicleId)) {
      throw new CustomError('Vehicle is not assigned to this trip', HTTP_STATUS.FORBIDDEN);
    }
    if (actor.role === 'DRIVER' && normalizeId(trip.driverId) !== normalizeId(actor.userId)) {
      throw new CustomError('Driver is not assigned to this trip', HTTP_STATUS.FORBIDDEN);
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      payload.vehicleId,
      {
        $set: {
          status: speed <= 2 ? 'idle' : 'active',
          currentLocation: {
            lat,
            lng,
            speed,
            heading: heading ?? 0,
            updatedAt: recordedAt,
          },
        },
      },
      { new: true }
    ).lean();

    if (!vehicle) throw new CustomError('Vehicle not found', HTTP_STATUS.NOT_FOUND);

    const [route, driver, openIncidents] = await Promise.all([
      Route.findById(trip.routeId).lean(),
      User.findById(trip.driverId).select('fullName role').lean(),
      IncidentReport.find({ tripId: trip._id, status: { $in: OPEN_INCIDENT_STATUSES } }).lean(),
    ]);

    trip.lastGpsAt = recordedAt;
    trip.idleSince = speed <= 2 ? (trip.idleSince || recordedAt) : null;
    const delayStatus = calculateDelayStatus(trip.toObject(), vehicle, openIncidents, recordedAt);
    if (delayStatus.isDelayed) {
      trip.status = 'delayed';
      trip.delayMinutes = delayStatus.delayMinutes;
      trip.delayReason = delayStatus.reason;
    } else {
      trip.status = 'active';
    }
    await trip.save();

    await VehicleLocationLog.create({
      vehicleId: vehicle._id,
      tripId: trip._id,
      lat,
      lng,
      speed,
      heading: heading ?? 0,
      recordedAt,
    });

    const dto = buildDto({
      trip: trip.toObject(),
      vehicle,
      route,
      driver,
      openIncidentCount: openIncidents.length,
      now: recordedAt,
    });

    io?.to('fleet:operations').emit('server:fleet:locationUpdated', dto);
    io?.to('fleet:operations').emit('server:trip:statusUpdated', {
      tripId: dto.tripId,
      vehicleId: dto.vehicleId,
      status: dto.tripStatus,
      delayMinutes: dto.delayMinutes,
      lastGpsAt: dto.lastGpsAt,
    });

    if (delayStatus.isDelayed) {
      io?.to('fleet:operations').emit('server:trip:delayed', buildDelayedTripDto({
        trip: trip.toObject(),
        vehicle,
        route,
        driver,
        schedule: null,
        incidents: openIncidents,
        delayStatus,
        now: recordedAt,
      }));
    }

    return dto;
  }

  static async seedDemoFleet(actor = {}) {
    if (process.env.NODE_ENV === 'production') {
      throw new CustomError('Demo fleet seeding is disabled in production', HTTP_STATUS.FORBIDDEN);
    }

    const route = await Route.findOneAndUpdate(
      { routeNumber: 'DN-DEMO-01' },
      {
        $set: {
          routeNumber: 'DN-DEMO-01',
          name: 'Da Nang Demo Loop',
          origin: 'Da Nang Railway Station',
          destination: 'My Khe Beach',
          distanceKm: 12,
          estimatedDurationMinutes: 42,
          fare: 8000,
          status: 'ACTIVE',
          stops: DA_NANG_POINTS.slice(0, 5).map(([latitude, longitude], index) => ({
            name: `Demo Stop ${index + 1}`,
            order: index + 1,
            estimatedOffsetMinutes: index * 8,
            latitude,
            longitude,
          })),
          pathPoints: DA_NANG_POINTS.map(([latitude, longitude]) => ({ latitude, longitude })),
        },
        $setOnInsert: { createdBy: actor.userId },
      },
      { upsert: true, new: true }
    );

    let driver = await User.findOne({ email: 'demo.driver@busdn.local' });
    if (!driver) {
      driver = await User.create({
        fullName: 'Demo Fleet Driver',
        email: 'demo.driver@busdn.local',
        phoneNumber: '0900000001',
        password: 'Demo@123456',
        role: 'DRIVER',
        status: 'ACTIVE',
        isVerified: true,
      });
    } else {
      driver.fullName = 'Demo Fleet Driver';
      driver.role = 'DRIVER';
      driver.status = 'ACTIVE';
      driver.isVerified = true;
      await driver.save();
    }

    const now = new Date();
    const vehicles = [];

    for (let index = 0; index < DA_NANG_POINTS.length; index += 1) {
      const [lat, lng] = DA_NANG_POINTS[index];
      const vehicle = await Vehicle.findOneAndUpdate(
        { vehicleCode: `DN-DEMO-${String(index + 1).padStart(2, '0')}` },
        {
          $set: {
            plateNumber: `43A-${90000 + index}`,
            vehicleCode: `DN-DEMO-${String(index + 1).padStart(2, '0')}`,
            capacity: 42,
            status: index === 5 ? 'idle' : 'active',
            assignedRouteId: route._id,
            currentLocation: {
              lat,
              lng,
              speed: index === 5 ? 0 : 18 + index,
              heading: 35 + (index * 24),
              updatedAt: new Date(now.getTime() - (index === 6 ? 4 * 60000 : index * 12000)),
            },
          },
        },
        { upsert: true, new: true }
      );

      const trip = await Trip.findOneAndUpdate(
        { vehicleId: vehicle._id, status: { $in: ACTIVE_TRIP_STATUSES } },
        {
          $set: {
            routeId: route._id,
            vehicleId: vehicle._id,
            driverId: driver._id,
            plannedStartTime: new Date(now.getTime() - 20 * 60000),
            plannedEndTime: new Date(now.getTime() + 40 * 60000),
            actualStartTime: index === 4
              ? new Date(now.getTime() - 11 * 60000)
              : new Date(now.getTime() - 18 * 60000),
            status: index === 2 ? 'delayed' : index === 3 ? 'incident' : 'active',
            progressPercent: 20 + (index * 8),
            currentStopIndex: index % 4,
            delayMinutes: index === 2 ? 9 : index === 3 ? 24 : 0,
            delayReason: index === 2 ? 'reported_delay' : index === 3 ? 'accident_incident' : '',
            idleSince: index === 5 ? new Date(now.getTime() - 7 * 60000) : null,
            lastGpsAt: vehicle.currentLocation.updatedAt,
          },
        },
        { upsert: true, new: true }
      );

      if (index === 3) {
        await IncidentReport.findOneAndUpdate(
          { tripId: trip._id, incidentType: 'ACCIDENT', status: { $in: OPEN_INCIDENT_STATUSES } },
          {
            $set: {
              reporterId: driver._id,
              reporterRole: 'DRIVER',
              incidentType: 'ACCIDENT',
              title: 'Demo accident near Han River bridge',
              description: 'Demo incident for delayed trip monitoring.',
              routeId: route._id,
              tripId: trip._id,
              vehicleId: vehicle._id,
              location: 'Han River bridge',
              latitude: lat,
              longitude: lng,
              severity: 'HIGH',
              status: 'PENDING',
            },
          },
          { upsert: true, new: true }
        );
      }

      await VehicleLocationLog.create({
        vehicleId: vehicle._id,
        tripId: trip._id,
        lat,
        lng,
        speed: vehicle.currentLocation.speed,
        heading: vehicle.currentLocation.heading,
        recordedAt: vehicle.currentLocation.updatedAt,
      });

      vehicles.push(vehicle);
    }

    return {
      routeId: route._id,
      driverId: driver._id,
      vehiclesCreated: vehicles.length,
    };
  }
}

export default FleetMonitoringService;
