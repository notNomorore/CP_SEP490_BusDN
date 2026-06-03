import { config } from '../../config/environment.js';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import RouteService from '../routes/RouteService.js';
import ShiftAssignment from './ShiftAssignment.js';
import OperationIncident from './OperationIncident.js';
import Trip from './Trip.js';
import Vehicle from './Vehicle.js';
import VehicleInspection from './VehicleInspection.js';

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const withTime = (date, hours, minutes) => {
  const value = startOfDay(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
};

const getDateKey = (date) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value, fallback) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const INCIDENT_TYPES = ['TRAFFIC_CONGESTION', 'ACCIDENT', 'VEHICLE_BREAKDOWN'];
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class ScheduleOperationsService {
  static buildActorQuery(userId, role) {
    if (role === 'DRIVER') {
      return { driver: userId };
    }

    if (role === 'BUS_ASSISTANT') {
      return { busAssistant: userId };
    }

    return { _id: null };
  }

  static async ensureDevelopmentAssignments(userId, role) {
    if (config.nodeEnv !== 'development') {
      return;
    }

    await RouteService.ensureSampleRoutes();

    const [primaryRoute, secondaryRoute] = await Promise.all([
      Route.findOne({ routeNumber: 'DN01' }),
      Route.findOne({ routeNumber: 'DN02' }),
    ]);

    if (!primaryRoute || !secondaryRoute) {
      return;
    }

    const today = startOfDay();
    const tomorrow = addDays(today, 1);
    const todayKey = getDateKey(today);
    const tomorrowKey = getDateKey(tomorrow);
    const roleField = role === 'BUS_ASSISTANT' ? 'busAssistant' : 'driver';
    const fallbackDriver = role === 'DRIVER'
      ? userId
      : (await User.findOne({ role: 'DRIVER', status: 'ACTIVE' }).select('_id'))?._id;

    if (!fallbackDriver) {
      return;
    }

    const vehicles = await Promise.all([
      Vehicle.findOneAndUpdate(
        { code: 'BUS-DN-01' },
        {
          $setOnInsert: {
            code: 'BUS-DN-01',
            plateNumber: '43B-012.34',
            model: 'THACO City Bus',
            capacity: 40,
            status: 'ASSIGNED',
          },
        },
        { upsert: true, new: true }
      ),
      Vehicle.findOneAndUpdate(
        { code: 'BUS-DN-02' },
        {
          $setOnInsert: {
            code: 'BUS-DN-02',
            plateNumber: '43B-056.78',
            model: 'SAMCO Bus',
            capacity: 45,
            status: 'ASSIGNED',
          },
        },
        { upsert: true, new: true }
      ),
    ]);

    const tripPayloads = [
      {
        tripCode: `TRIP-${userId}-${todayKey}-01`,
        route: primaryRoute._id,
        vehicle: vehicles[0]._id,
        scheduledStart: withTime(today, 7, 0),
        scheduledEnd: withTime(today, 8, 0),
        status: 'SCHEDULED',
      },
      {
        tripCode: `TRIP-${userId}-${tomorrowKey}-02`,
        route: secondaryRoute._id,
        vehicle: vehicles[1]._id,
        scheduledStart: withTime(tomorrow, 13, 30),
        scheduledEnd: withTime(tomorrow, 14, 45),
        status: 'SCHEDULED',
      },
    ];

    const trips = await Promise.all(tripPayloads.map((trip) => (
      Trip.findOneAndUpdate(
        { tripCode: trip.tripCode },
        { $setOnInsert: trip },
        { upsert: true, new: true }
      )
    )));

    const assignments = [
      {
        shiftCode: `SHIFT-${userId}-${todayKey}-A`,
        tripCode: trips[0].tripCode,
        trip: trips[0]._id,
        driver: fallbackDriver,
        [roleField]: userId,
        shiftStatus: 'ASSIGNED',
        notes: 'Co mat tai diem tap ket truoc gio khoi hanh 15 phut.',
      },
      {
        shiftCode: `SHIFT-${userId}-${tomorrowKey}-B`,
        tripCode: trips[1].tripCode,
        trip: trips[1]._id,
        driver: fallbackDriver,
        [roleField]: userId,
        shiftStatus: 'ASSIGNED',
        notes: 'Kiem tra thong tin tuyen va phuong tien truoc khi nhan ca.',
      },
    ];

    await Promise.all(assignments.map((assignment) => (
      ShiftAssignment.updateOne(
        { shiftCode: assignment.shiftCode },
        { $set: assignment },
        { upsert: true }
      )
    )));
  }

  static async listAssignedTrips(userId, role, query = {}) {
    await this.ensureDevelopmentAssignments(userId, role);

    const from = startOfDay(parseDate(query.from, new Date()));
    const to = endOfDay(parseDate(query.to, addDays(from, 7)));

    const trips = await Trip.find({
      scheduledStart: { $gte: from, $lte: to },
      status: { $ne: 'CANCELLED' },
    }).select('_id');

    const assignments = await ShiftAssignment.find({
      ...this.buildActorQuery(userId, role),
      trip: { $in: trips.map((trip) => trip._id) },
    })
      .populate({
        path: 'trip',
        populate: [
          { path: 'route' },
          { path: 'vehicle' },
        ],
      })
      .populate('driver', 'fullName phoneNumber role')
      .populate('busAssistant', 'fullName phoneNumber role');

    await this.attachInspectionRecords(assignments);

    return assignments.sort((left, right) => (
      new Date(left.trip.scheduledStart) - new Date(right.trip.scheduledStart)
    ));
  }

  static async listShiftSchedule(userId, role, query = {}) {
    await this.ensureDevelopmentAssignments(userId, role);

    const from = startOfDay(parseDate(query.from, new Date()));
    const to = endOfDay(parseDate(query.to, addDays(from, 13)));

    const trips = await Trip.find({
      scheduledStart: { $gte: from, $lte: to },
    }).select('_id');

    const assignments = await ShiftAssignment.find({
      ...this.buildActorQuery(userId, role),
      trip: { $in: trips.map((trip) => trip._id) },
    })
      .populate({
        path: 'trip',
        populate: [
          { path: 'route' },
          { path: 'vehicle' },
        ],
      })
      .populate('driver', 'fullName phoneNumber role')
      .populate('busAssistant', 'fullName phoneNumber role');

    await this.attachInspectionRecords(assignments);

    return assignments.sort((left, right) => (
      new Date(left.trip.scheduledStart) - new Date(right.trip.scheduledStart)
    ));
  }

  static async attachInspectionRecords(assignments = []) {
    if (!assignments.length) {
      return;
    }

    const inspections = await VehicleInspection.find({
      assignment: { $in: assignments.map((assignment) => assignment._id) },
    });

    const inspectionByAssignment = inspections.reduce((map, inspection) => {
      map.set(String(inspection.assignment), inspection);
      return map;
    }, new Map());

    assignments.forEach((assignment) => {
      assignment.inspectionRecord = inspectionByAssignment.get(String(assignment._id)) || null;
    });
  }

  static async getDriverAssignment(userId, assignmentId) {
    const assignment = await ShiftAssignment.findOne({
      _id: assignmentId,
      driver: userId,
    }).populate({
      path: 'trip',
      populate: [
        { path: 'route' },
        { path: 'vehicle' },
      ],
    });

    if (!assignment) {
      const error = new Error('Assigned trip not found for this driver');
      error.statusCode = 404;
      throw error;
    }

    return assignment;
  }

  static buildInspectionCode(assignment) {
    return `INSP-${assignment.shiftCode}`;
  }

  static assertTripCanBeInspected(assignment) {
    const blockedTripStatuses = ['READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const blockedShiftStatuses = ['COMPLETED', 'CANCELLED'];

    if (blockedTripStatuses.includes(assignment.trip?.status)) {
      const error = new Error('Vehicle inspection is not allowed for this trip status');
      error.statusCode = 409;
      throw error;
    }

    if (blockedShiftStatuses.includes(assignment.shiftStatus)) {
      const error = new Error('Vehicle inspection is not allowed for this shift status');
      error.statusCode = 409;
      throw error;
    }
  }

  static async startVehicleInspection(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can start vehicle inspections');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    this.assertTripCanBeInspected(assignment);
    const existingInspection = await VehicleInspection.findOne({ assignment: assignment._id });

    if (['READY', 'ISSUE_REPORTED'].includes(existingInspection?.status)) {
      const error = new Error('Processed vehicle inspection cannot be started again');
      error.statusCode = 409;
      throw error;
    }

    const inspection = await VehicleInspection.findOneAndUpdate(
      { assignment: assignment._id },
      {
        $setOnInsert: {
          inspectionCode: this.buildInspectionCode(assignment),
          trip: assignment.trip._id,
          assignment: assignment._id,
          vehicle: assignment.trip.vehicle._id || assignment.trip.vehicle,
          driver: userId,
          startedAt: new Date(),
        },
        $set: {
          checklist: {
            tires: Boolean(payload.checklist?.tires),
            brakes: Boolean(payload.checklist?.brakes),
            lights: Boolean(payload.checklist?.lights),
            fuelOrBattery: Boolean(payload.checklist?.fuelOrBattery),
            safetyEquipment: Boolean(payload.checklist?.safetyEquipment),
            cleanliness: Boolean(payload.checklist?.cleanliness),
          },
          status: 'IN_PROGRESS',
        },
      },
      { upsert: true, new: true }
    );

    return inspection;
  }

  static async confirmVehicleReady(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can confirm vehicle readiness');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    this.assertTripCanBeInspected(assignment);
    const checklist = {
      tires: Boolean(payload.checklist?.tires),
      brakes: Boolean(payload.checklist?.brakes),
      lights: Boolean(payload.checklist?.lights),
      fuelOrBattery: Boolean(payload.checklist?.fuelOrBattery),
      safetyEquipment: Boolean(payload.checklist?.safetyEquipment),
      cleanliness: Boolean(payload.checklist?.cleanliness),
    };
    const existingInspection = await VehicleInspection.findOne({ assignment: assignment._id });

    if (!existingInspection) {
      const error = new Error('Vehicle inspection must be started before confirming readiness');
      error.statusCode = 400;
      throw error;
    }

    if (existingInspection.status === 'ISSUE_REPORTED') {
      const error = new Error('Vehicle with reported issues cannot be confirmed ready');
      error.statusCode = 409;
      throw error;
    }

    if (!Object.values(checklist).every(Boolean)) {
      const error = new Error('All inspection checklist items must be checked before confirming ready');
      error.statusCode = 400;
      throw error;
    }

    const inspection = await VehicleInspection.findOneAndUpdate(
      { assignment: assignment._id },
      {
        $set: {
          checklist,
          status: 'READY',
          issueCategory: null,
          issueDescription: '',
          confirmedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await Promise.all([
      Trip.updateOne({ _id: assignment.trip._id }, { $set: { status: 'READY' } }),
      ShiftAssignment.updateOne({ _id: assignment._id }, { $set: { shiftStatus: 'CONFIRMED' } }),
      Vehicle.updateOne(
        { _id: assignment.trip.vehicle._id || assignment.trip.vehicle },
        { $set: { status: 'ASSIGNED' } }
      ),
    ]);

    return inspection;
  }

  static async reportVehicleIssue(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can report vehicle issues');
      error.statusCode = 403;
      throw error;
    }

    const description = String(payload.issueDescription || '').trim();

    if (description.length < 5) {
      const error = new Error('Issue description must be at least 5 characters');
      error.statusCode = 400;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    this.assertTripCanBeInspected(assignment);
    const issueCategory = payload.issueCategory || 'OTHER';
    const existingInspection = await VehicleInspection.findOne({ assignment: assignment._id });

    if (!existingInspection) {
      const error = new Error('Vehicle inspection must be started before reporting an issue');
      error.statusCode = 400;
      throw error;
    }

    if (existingInspection.status === 'READY') {
      const error = new Error('Ready vehicle inspection cannot be changed to issue reported');
      error.statusCode = 409;
      throw error;
    }

    if (existingInspection.status === 'ISSUE_REPORTED') {
      const error = new Error('Vehicle issue has already been reported for this trip');
      error.statusCode = 409;
      throw error;
    }

    const inspection = await VehicleInspection.findOneAndUpdate(
      { assignment: assignment._id },
      {
        $set: {
          status: 'ISSUE_REPORTED',
          issueCategory,
          issueDescription: description,
          reportedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await Promise.all([
      Trip.updateOne({ _id: assignment.trip._id }, { $set: { status: 'SCHEDULED' } }),
      Vehicle.updateOne(
        { _id: assignment.trip.vehicle._id || assignment.trip.vehicle },
        { $set: { status: 'MAINTENANCE' } }
      ),
    ]);

    return inspection;
  }

  static async assertDriverHasNoActiveTrip(userId, currentTripId) {
    const activeAssignments = await ShiftAssignment.find({ driver: userId })
      .populate('trip');

    const activeAssignment = activeAssignments.find((assignment) => (
      assignment.trip
      && String(assignment.trip._id) !== String(currentTripId)
      && assignment.trip.status === 'IN_PROGRESS'
    ));

    if (activeAssignment) {
      const error = new Error('Driver already has another trip in progress');
      error.statusCode = 409;
      throw error;
    }
  }

  static async startTrip(userId, role, assignmentId) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can start assigned trips');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    const trip = assignment.trip;

    if (assignment.shiftStatus === 'CANCELLED' || assignment.shiftStatus === 'COMPLETED') {
      const error = new Error('Cannot start a cancelled or completed shift');
      error.statusCode = 409;
      throw error;
    }

    if (trip.status === 'IN_PROGRESS') {
      const error = new Error('Trip has already started');
      error.statusCode = 409;
      throw error;
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      const error = new Error('Cannot start a completed or cancelled trip');
      error.statusCode = 409;
      throw error;
    }

    const inspection = await VehicleInspection.findOne({ assignment: assignment._id });

    if (inspection?.status !== 'READY' || trip.status !== 'READY') {
      const error = new Error('Vehicle must be confirmed ready before starting the trip');
      error.statusCode = 400;
      throw error;
    }

    await this.assertDriverHasNoActiveTrip(userId, trip._id);

    await Promise.all([
      Trip.updateOne(
        { _id: trip._id },
        {
          $set: {
            status: 'IN_PROGRESS',
            actualStartAt: new Date(),
          },
        }
      ),
      Vehicle.updateOne(
        { _id: trip.vehicle._id || trip.vehicle },
        { $set: { status: 'IN_SERVICE' } }
      ),
    ]);

    return ShiftAssignment.findById(assignment._id)
      .populate({
        path: 'trip',
        populate: [
          { path: 'route' },
          { path: 'vehicle' },
        ],
      })
      .populate('driver', 'fullName phoneNumber role')
      .populate('busAssistant', 'fullName phoneNumber role');
  }

  static buildIncidentCode(assignment, type) {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `INC-${type}-${assignment.shiftCode}-${timestamp}`;
  }

  static validateIncidentPayload(payload = {}) {
    const type = String(payload.type || '').trim();
    const severity = String(payload.severity || '').trim();
    const description = String(payload.description || '').trim();
    const locationText = String(payload.locationText || '').trim();

    if (!INCIDENT_TYPES.includes(type)) {
      const error = new Error('Incident type is invalid');
      error.statusCode = 400;
      throw error;
    }

    if (!INCIDENT_SEVERITIES.includes(severity)) {
      const error = new Error('Incident severity is invalid');
      error.statusCode = 400;
      throw error;
    }

    if (description.length < 10) {
      const error = new Error('Incident description must be at least 10 characters');
      error.statusCode = 400;
      throw error;
    }

    if (locationText.length < 3) {
      const error = new Error('Incident location is required');
      error.statusCode = 400;
      throw error;
    }

    if (type === 'TRAFFIC_CONGESTION') {
      const estimatedDelayMinutes = Number(payload.estimatedDelayMinutes || 0);
      if (!Number.isFinite(estimatedDelayMinutes) || estimatedDelayMinutes < 1) {
        const error = new Error('Estimated delay must be at least 1 minute for traffic congestion');
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'ACCIDENT' && severity === 'LOW') {
      const error = new Error('Accident severity must be medium or higher');
      error.statusCode = 400;
      throw error;
    }

    if (type === 'VEHICLE_BREAKDOWN' && typeof payload.canContinue !== 'boolean') {
      const error = new Error('Vehicle breakdown report must specify whether the vehicle can continue');
      error.statusCode = 400;
      throw error;
    }

    return {
      type,
      severity,
      description,
      locationText,
    };
  }

  static async reportOperationIncident(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can report operation incidents');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    const { type, severity, description, locationText } = this.validateIncidentPayload(payload);

    if (assignment.trip.status !== 'IN_PROGRESS') {
      const error = new Error('Operation incidents can only be reported while the trip is in progress');
      error.statusCode = 409;
      throw error;
    }

    const incident = await OperationIncident.create({
      incidentCode: this.buildIncidentCode(assignment, type),
      type,
      severity,
      trip: assignment.trip._id,
      assignment: assignment._id,
      route: assignment.trip.route._id || assignment.trip.route,
      vehicle: assignment.trip.vehicle._id || assignment.trip.vehicle,
      driver: userId,
      locationText,
      latitude: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : null,
      longitude: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : null,
      estimatedDelayMinutes: type === 'TRAFFIC_CONGESTION'
        ? Number(payload.estimatedDelayMinutes)
        : 0,
      description,
      injuriesReported: type === 'ACCIDENT'
        ? Boolean(payload.injuriesReported)
        : false,
      policeNotified: type === 'ACCIDENT'
        ? Boolean(payload.policeNotified)
        : false,
      canContinue: type === 'VEHICLE_BREAKDOWN'
        ? Boolean(payload.canContinue)
        : null,
      requiresReplacementVehicle: type === 'VEHICLE_BREAKDOWN'
        ? Boolean(payload.requiresReplacementVehicle)
        : false,
      reportedAt: new Date(),
    });

    if (type === 'VEHICLE_BREAKDOWN') {
      await Vehicle.updateOne(
        { _id: assignment.trip.vehicle._id || assignment.trip.vehicle },
        { $set: { status: 'MAINTENANCE' } }
      );
    }

    return OperationIncident.findById(incident._id)
      .populate('driver', 'fullName phoneNumber role');
  }

  static async listOperationIncidents(userId, role, assignmentId) {
    const assignment = role === 'DRIVER'
      ? await this.getDriverAssignment(userId, assignmentId)
      : await ShiftAssignment.findOne({
        _id: assignmentId,
        busAssistant: userId,
      });

    if (!assignment) {
      const error = new Error('Assigned trip not found for this user');
      error.statusCode = 404;
      throw error;
    }

    return OperationIncident.find({ assignment: assignment._id })
      .sort({ reportedAt: -1 })
      .populate('driver', 'fullName phoneNumber role');
  }
}

export default ScheduleOperationsService;
