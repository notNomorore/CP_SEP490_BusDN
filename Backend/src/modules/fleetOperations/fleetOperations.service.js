import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import IncidentReport from '../incidents/IncidentReport.js';
import OperationAlert from './OperationAlert.js';
import Trip from './Trip.js';
import Vehicle from './Vehicle.js';
import VehicleLocationLog from './VehicleLocationLog.js';
import {
  LEGACY_INCIDENT_SEVERITY_MAP,
  LEGACY_INCIDENT_STATUS_MAP,
  LEGACY_INCIDENT_TYPE_MAP,
  LEGACY_REPORTER_ROLE_MAP,
  SOCKET_EVENTS,
} from './fleetOperations.constants.js';

const toObjectId = (value, fieldName) => {
  if (!value) {
    return null;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new CustomError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST);
  }

  return new mongoose.Types.ObjectId(value);
};

const toPositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const withId = (document) => {
  if (!document) {
    return null;
  }

  return {
    ...document,
    id: document._id?.toString(),
  };
};

const emitFleetEvent = (io, eventName, payload) => {
  if (!io) {
    return;
  }

  io.to('fleet:operations').emit(eventName, payload);
};

const getDelayMinutes = (trip, now) => {
  if (!trip?.plannedEndTime) {
    return 0;
  }

  const plannedEnd = new Date(trip.plannedEndTime).getTime();
  const diff = now.getTime() - plannedEnd;
  return diff > 0 ? Math.floor(diff / 60000) : 0;
};

const ROLE_TO_REPORTER_ROLE = {
  DRIVER: 'driver',
  BUS_ASSISTANT: 'assistant',
  ADMIN: 'admin',
  SYSTEM: 'system',
};

const INCIDENT_TYPES_BY_REPORTER = {
  driver: ['traffic_congestion', 'accident', 'vehicle_breakdown'],
  assistant: ['passenger_violation', 'passenger_conflict', 'found_item'],
  admin: [
    'traffic_congestion',
    'accident',
    'vehicle_breakdown',
    'passenger_violation',
    'passenger_conflict',
    'found_item',
    'gps_lost_signal',
    'vehicle_idle_too_long',
    'severe_delay',
    'other',
  ],
  system: ['gps_lost_signal', 'vehicle_idle_too_long', 'severe_delay'],
};

const resolveReporterRole = (payload, actor) => {
  const actorReporterRole = ROLE_TO_REPORTER_ROLE[String(actor?.role || '').toUpperCase()];
  return actorReporterRole || payload.reporterRole || 'driver';
};

export class FleetOperationsService {
  static async listVehicles(query = {}) {
    const page = toPositiveInteger(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = toPositiveInteger(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.assignedRouteId) {
      filter.assignedRouteId = toObjectId(query.assignedRouteId, 'assignedRouteId');
    }

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments(filter),
    ]);

    return {
      vehicles: vehicles.map(withId),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async createVehicle(payload) {
    const vehicle = await Vehicle.create(payload);
    return withId(vehicle.toObject());
  }

  static async listTrips(query = {}) {
    const page = toPositiveInteger(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = toPositiveInteger(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = {};

    ['status', 'routeId', 'vehicleId', 'driverId'].forEach((field) => {
      if (query[field]) {
        filter[field] = field === 'status' ? query[field] : toObjectId(query[field], field);
      }
    });

    const [trips, total] = await Promise.all([
      Trip.find(filter)
        .sort({ plannedStartTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Trip.countDocuments(filter),
    ]);

    return {
      trips: trips.map(withId),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async createTrip(payload) {
    const trip = await Trip.create(payload);
    return withId(trip.toObject());
  }

  static async updateGps(payload, io = null) {
    const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : new Date();
    const vehicleId = toObjectId(payload.vehicleId, 'vehicleId');
    const tripId = toObjectId(payload.tripId, 'tripId');

    const existingVehicle = await Vehicle.findById(vehicleId).lean();
    if (!existingVehicle) {
      throw new CustomError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
    }

    let existingTrip = null;
    if (tripId) {
      existingTrip = await Trip.findById(tripId);
      if (!existingTrip) {
        throw new CustomError('Trip not found', HTTP_STATUS.NOT_FOUND);
      }
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        $set: {
          status: 'active',
          currentLocation: {
            lat: payload.lat,
            lng: payload.lng,
            heading: payload.heading || 0,
            speed: payload.speed || 0,
            updatedAt: recordedAt,
          },
        },
      },
      { new: true }
    ).lean();

    let trip = null;
    let delayed = false;

    if (existingTrip) {
      const delayMinutes = getDelayMinutes(existingTrip, recordedAt);
      delayed = delayMinutes > existingTrip.delayMinutes;
      existingTrip.lastGpsAt = recordedAt;
      existingTrip.status = delayMinutes > 0 ? 'delayed' : 'active';
      existingTrip.delayMinutes = Math.max(existingTrip.delayMinutes || 0, delayMinutes);
      trip = await existingTrip.save();
    }

    const log = await VehicleLocationLog.create({
      vehicleId,
      tripId,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed || 0,
      heading: payload.heading || 0,
      recordedAt,
    });

    const locationPayload = {
      vehicle: withId(vehicle),
      trip: trip ? withId(trip.toObject()) : null,
      locationLog: withId(log.toObject()),
    };

    emitFleetEvent(io, SOCKET_EVENTS.FLEET_LOCATION_UPDATED, locationPayload);

    if (trip) {
      emitFleetEvent(io, SOCKET_EVENTS.TRIP_STATUS_UPDATED, withId(trip.toObject()));
      if (delayed) {
        emitFleetEvent(io, SOCKET_EVENTS.TRIP_DELAYED, withId(trip.toObject()));
      }
    }

    return locationPayload;
  }

  static async createIncident(payload, actor = {}, io = null) {
    const reporterId = toObjectId(payload.reporterId || actor.userId, 'reporterId');
    const type = payload.type;
    const severity = payload.severity || 'medium';
    const reporterRole = resolveReporterRole(payload, actor);

    if (!INCIDENT_TYPES_BY_REPORTER[reporterRole]?.includes(type)) {
      throw new CustomError(`${reporterRole} cannot report this incident type`, HTTP_STATUS.FORBIDDEN);
    }

    const incident = await IncidentReport.create({
      reporterId,
      reporterRole: LEGACY_REPORTER_ROLE_MAP[reporterRole] || 'DRIVER',
      incidentType: LEGACY_INCIDENT_TYPE_MAP[type] || 'OTHER',
      title: payload.title || `Operational incident: ${type}`,
      description: payload.description,
      routeId: toObjectId(payload.routeId, 'routeId'),
      tripId: toObjectId(payload.tripId, 'tripId'),
      vehicleId: toObjectId(payload.vehicleId, 'vehicleId'),
      location: payload.locationText || '',
      latitude: payload.location?.lat ?? null,
      longitude: payload.location?.lng ?? null,
      severity: LEGACY_INCIDENT_SEVERITY_MAP[severity] || 'MEDIUM',
      status: 'PENDING',
    });

    if (payload.tripId) {
      await Trip.findByIdAndUpdate(payload.tripId, {
        $set: {
          status: 'incident',
        },
      });
    }

    const alert = await OperationAlert.create({
      targetRole: 'admin',
      title: incident.title,
      message: incident.description,
      type,
      relatedIncidentId: incident._id,
      relatedTripId: incident.tripId,
    });

    const result = {
      incident: this.toFleetIncident(incident.toObject()),
      alert: withId(alert.toObject()),
    };

    emitFleetEvent(io, SOCKET_EVENTS.INCIDENT_NEW, result);
    return result;
  }

  static async updateIncidentStatus(id, payload, actor = {}, io = null) {
    const incident = await IncidentReport.findById(id);
    if (!incident) {
      throw new CustomError('Incident report not found', HTTP_STATUS.NOT_FOUND);
    }

    const mappedStatus = LEGACY_INCIDENT_STATUS_MAP[payload.status];
    if (!mappedStatus) {
      throw new CustomError('Invalid incident status', HTTP_STATUS.BAD_REQUEST);
    }

    incident.status = mappedStatus;
    incident.adminNote = String(payload.adminNote || incident.adminNote || '').trim();

    if (mappedStatus === 'RESOLVED' || mappedStatus === 'REJECTED') {
      incident.resolvedBy = actor.userId || incident.resolvedBy;
      incident.resolvedAt = new Date();
    } else {
      incident.resolvedAt = null;
    }

    await incident.save();

    const result = this.toFleetIncident(incident.toObject());
    emitFleetEvent(io, SOCKET_EVENTS.INCIDENT_UPDATED, result);
    return result;
  }

  static toFleetIncident(incident) {
    const reverse = (map, value, fallback) => (
      Object.entries(map).find(([, mapped]) => mapped === value)?.[0] || fallback
    );

    return {
      id: incident._id?.toString(),
      tripId: incident.tripId,
      vehicleId: incident.vehicleId,
      routeId: incident.routeId,
      reporterId: incident.reporterId,
      reporterRole: reverse(LEGACY_REPORTER_ROLE_MAP, incident.reporterRole, 'driver'),
      type: reverse(LEGACY_INCIDENT_TYPE_MAP, incident.incidentType, 'other'),
      severity: reverse(LEGACY_INCIDENT_SEVERITY_MAP, incident.severity, 'medium'),
      description: incident.description,
      location: {
        lat: incident.latitude,
        lng: incident.longitude,
      },
      status: reverse(LEGACY_INCIDENT_STATUS_MAP, incident.status, 'new'),
      adminNote: incident.adminNote,
      createdAt: incident.createdAt,
      resolvedAt: incident.resolvedAt,
    };
  }
}

export default FleetOperationsService;
