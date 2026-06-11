import TripSchedule from '../admin/TripSchedule.js';
import FleetBus from '../admin/FleetBus.js';
import User from '../auth/User.js';
import ShiftAssignment from './ShiftAssignment.js';
import OperationIncident from './OperationIncident.js';
import OperationNotification from './OperationNotification.js';
import VehicleInspection from './VehicleInspection.js';
import IncidentReport from '../incidents/IncidentReport.js';

const TRAFFIC_CATEGORIES = [
  'HEAVY_TRAFFIC',
  'ROADWORK',
  'FLOODING',
  'EVENT_CROWD',
  'STOP_OVERLOAD',
  'TEMPORARY_BLOCK',
  'OTHER',
];

const AFFECTED_DIRECTIONS = [
  'CURRENT_DIRECTION',
  'OPPOSITE_DIRECTION',
  'BOTH_DIRECTIONS',
  'UNKNOWN',
];

const PASSENGER_CONFLICT_CATEGORIES = [
  'ARGUMENT',
  'FARE_DISPUTE',
  'SEAT_DISPUTE',
  'HARASSMENT',
  'SAFETY_RISK',
  'OTHER',
];

const PASSENGER_VIOLATION_CATEGORIES = [
  'NO_TICKET',
  'WRONG_TICKET',
  'SMOKING',
  'LITTERING',
  'UNSAFE_BEHAVIOR',
  'DISTURBANCE',
  'OTHER',
];

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

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

const parseDate = (value, fallback) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const normalizeScheduleStatus = (status) => {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'ASSIGNED';
};

const resolveSyncedShiftStatus = (scheduleStatus, existingStatus, inspectionStatus) => {
  const scheduleShiftStatus = normalizeScheduleStatus(scheduleStatus);

  if (scheduleShiftStatus === 'COMPLETED' || scheduleShiftStatus === 'CANCELLED') {
    return scheduleShiftStatus;
  }

  if (existingStatus === 'COMPLETED' || existingStatus === 'CANCELLED') {
    return existingStatus;
  }

  if (existingStatus === 'CONFIRMED' || inspectionStatus === 'READY') {
    return 'CONFIRMED';
  }

  return scheduleShiftStatus;
};

const buildTimeOnServiceDate = (serviceDate, timeValue) => {
  if (!serviceDate || !/^\d{2}:\d{2}$/.test(String(timeValue || ''))) {
    return null;
  }
  const [hours, minutes] = String(timeValue).split(':').map(Number);
  return withTime(serviceDate, hours, minutes);
};

const getScheduleVehicleId = (schedule) => schedule?.vehicle?.busId || null;
const getScheduleRouteId = (schedule) => schedule?.routeId || null;
const isValidLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
const isValidLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;
const isScheduleAssignedToActor = (schedule, userId, role) => {
  if (role === 'DRIVER') {
    return String(schedule?.driver?.userId || '') === String(userId);
  }

  if (role === 'BUS_ASSISTANT') {
    return String(schedule?.assistant?.userId || '') === String(userId);
  }

  return false;
};

const INCIDENT_TYPES = [
  'TRAFFIC_CONGESTION',
  'ACCIDENT',
  'VEHICLE_BREAKDOWN',
  'PASSENGER_VIOLATION',
  'PASSENGER_CONFLICT',
  'FOUND_ITEM',
];
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const normalizeStartGpsPayload = (payload = {}, startedAt = new Date()) => {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const accuracyMeters = Number(payload.accuracyMeters);
  const retryCount = Number(payload.retryCount || 0);
  const hasValidLocation = isValidLatitude(latitude) && isValidLongitude(longitude);

  return {
    startLocation: hasValidLocation
      ? {
        latitude,
        longitude,
        accuracyMeters: Number.isFinite(accuracyMeters) && accuracyMeters >= 0
          ? accuracyMeters
          : null,
        capturedAt: payload.capturedAt ? new Date(payload.capturedAt) : startedAt,
      }
      : {
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        capturedAt: null,
      },
    gpsSync: {
      status: hasValidLocation ? 'SYNCED' : 'FAILED',
      retryCount: Number.isFinite(retryCount) && retryCount >= 0 ? retryCount : 0,
      message: hasValidLocation
        ? 'GPS synced when driver started the trip'
        : String(payload.message || 'GPS sync failed when driver started the trip').trim(),
      syncedAt: hasValidLocation ? startedAt : null,
      lastAttemptAt: startedAt,
    },
  };
};

const buildTripScheduleAssignment = (schedule, role) => {
  if (!schedule) return null;
  const acceptance = schedule.driverAcceptance || {};
  const acceptanceStatus = ['IN_PROGRESS', 'COMPLETED'].includes(schedule.status)
    ? 'ACCEPTED'
    : acceptance.status || 'PENDING';

  return {
    _id: schedule._id,
    shiftCode: `TRIP-${schedule.scheduleCode}`,
    tripCode: schedule.scheduleCode,
    trip: schedule,
    driver: schedule.driver || null,
    busAssistant: schedule.assistant || null,
    shiftStatus: normalizeScheduleStatus(schedule.status),
    acceptanceStatus,
    rejectionReason: acceptance.rejectionReason || '',
    acceptedAt: acceptanceStatus === 'ACCEPTED' ? acceptance.respondedAt || schedule.updatedAt : null,
    actorRole: role,
    notes: schedule.notes || 'Kiem tra thong tin tuyen va phuong tien truoc khi nhan ca.',
  };
};

export class ScheduleOperationsService {
  static isDuplicateKeyError(error) {
    return error?.code === 11000 || error?.code === 11001;
  }

  static buildActorQuery(userId, role) {
    if (role === 'DRIVER') {
      return { driver: userId };
    }

    if (role === 'BUS_ASSISTANT') {
      return { busAssistant: userId };
    }

    return { _id: null };
  }

  static buildActorScheduleQuery(userId, role) {
    if (role === 'DRIVER') {
      return { 'driver.userId': userId };
    }

    if (role === 'BUS_ASSISTANT') {
      return { 'assistant.userId': userId };
    }

    return { _id: null };
  }

  static async upsertAssignmentFromSchedule(schedule, assignmentPayload, attempt = 0) {
    const { shiftCode, tripCode } = assignmentPayload;
    const matchQuery = {
      $or: [
        { trip: schedule._id },
        { shiftCode },
        { tripCode },
      ],
    };

    try {
      const existingAssignment = await ShiftAssignment.findOne(matchQuery).sort({ updatedAt: -1 });

      if (existingAssignment) {
        const inspection = await VehicleInspection.findOne({
          assignment: existingAssignment._id,
        }).select('status').lean();

        await ShiftAssignment.deleteMany({
          _id: { $ne: existingAssignment._id },
          ...matchQuery,
        });

        return ShiftAssignment.updateOne(
          { _id: existingAssignment._id },
          {
            $set: {
              ...assignmentPayload,
              shiftStatus: resolveSyncedShiftStatus(
                schedule.status,
                existingAssignment.shiftStatus,
                inspection?.status
              ),
            },
          }
        );
      }

      return ShiftAssignment.findOneAndUpdate(
        { trip: schedule._id },
        {
          $set: {
            ...assignmentPayload,
            shiftStatus: normalizeScheduleStatus(schedule.status),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (error) {
      if (this.isDuplicateKeyError(error) && attempt < 3) {
        return this.upsertAssignmentFromSchedule(schedule, assignmentPayload, attempt + 1);
      }

      throw error;
    }
  }

  static async syncAssignmentsFromTripSchedules(userId, role, from, to) {
    const schedules = await TripSchedule.find({
      ...this.buildActorScheduleQuery(userId, role),
      serviceDate: { $gte: from, $lte: to },
      status: { $ne: 'CANCELLED' },
    }).lean();

    await Promise.all(schedules.map(async (schedule) => {
      if (!schedule.driver?.userId) {
        return null;
      }

      const shiftCode = `SHIFT-${schedule.scheduleCode}`;
      const tripCode = schedule.scheduleCode;
      const assignmentPayload = {
        shiftCode,
        tripCode,
        trip: schedule._id,
        driver: schedule.driver.userId,
        busAssistant: schedule.assistant?.userId || null,
        notes: schedule.notes || 'Kiem tra thong tin tuyen va phuong tien truoc khi nhan ca.',
      };

      return this.upsertAssignmentFromSchedule(schedule, assignmentPayload);
    }));
  }

  static async removeStaleActorAssignments(userId, role, from, to) {
    const assignments = await ShiftAssignment.find(this.buildActorQuery(userId, role))
      .populate('trip');

    const staleAssignmentIds = assignments
      .filter((assignment) => {
        const scheduledStart = buildTimeOnServiceDate(assignment.trip?.serviceDate, assignment.trip?.departureTime);
        return scheduledStart
          && scheduledStart >= from
          && scheduledStart <= to
          && !isScheduleAssignedToActor(assignment.trip, userId, role);
      })
      .map((assignment) => assignment._id);

    if (staleAssignmentIds.length) {
      await ShiftAssignment.deleteMany({ _id: { $in: staleAssignmentIds } });
    }
  }

  static async syncActorAssignments(userId, role, from, to) {
    await this.syncAssignmentsFromTripSchedules(userId, role, from, to);
    await this.removeStaleActorAssignments(userId, role, from, to);
  }

  static async listAssignedTrips(userId, role, query = {}) {
    const from = startOfDay(parseDate(query.from, new Date()));
    const to = endOfDay(parseDate(query.to, addDays(from, 7)));

    const schedules = await TripSchedule.find({
      ...this.buildActorScheduleQuery(userId, role),
      serviceDate: { $gte: from, $lte: to },
      status: { $ne: 'CANCELLED' },
    }).populate('routeId');

    const assignments = schedules.map((schedule) => buildTripScheduleAssignment(schedule, role));
    await this.attachInspectionRecords(assignments);

    return assignments
      .filter((assignment) => {
        const scheduledStart = buildTimeOnServiceDate(assignment.trip?.serviceDate, assignment.trip?.departureTime);
        return scheduledStart
          && scheduledStart >= from
          && scheduledStart <= to
          && isScheduleAssignedToActor(assignment.trip, userId, role);
      })
      .sort((left, right) => (
        buildTimeOnServiceDate(left.trip.serviceDate, left.trip.departureTime)
        - buildTimeOnServiceDate(right.trip.serviceDate, right.trip.departureTime)
      ));
  }

  static async listShiftSchedule() {
    return [];
  }

  static async listOperationNotifications(userId, role, query = {}) {
    const from = startOfDay(parseDate(query.from, new Date()));
    const to = endOfDay(parseDate(query.to, addDays(from, 7)));
    const now = new Date();

    const schedules = await TripSchedule.find({
      ...this.buildActorScheduleQuery(userId, role),
      serviceDate: { $gte: from, $lte: to },
      status: { $ne: 'CANCELLED' },
    }).select('_id routeId vehicle.busId').lean();

    const tripIds = new Set(schedules.map((schedule) => String(schedule._id)));
    const routeIds = new Set(
      schedules
        .map((schedule) => schedule.routeId)
        .filter(Boolean)
        .map((routeId) => String(routeId))
    );

    const notifications = await OperationNotification.find({
      status: 'ACTIVE',
      activeFrom: { $lte: now },
      $and: [
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { targetUsers: userId },
            { targetRoles: role },
          ],
        },
      ],
    })
      .sort({ priority: 1, activeFrom: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return notifications
      .filter((notification) => {
        const isDirectUser = (notification.targetUsers || [])
          .some((targetUser) => String(targetUser) === String(userId));
        if (isDirectUser) {
          return true;
        }

        if (!(notification.targetRoles || []).includes(role)) {
          return false;
        }

        const notificationTrip = notification.trip ? String(notification.trip) : '';
        const notificationRoute = notification.route ? String(notification.route) : '';

        if (!notificationTrip && !notificationRoute) {
          return true;
        }

        return (
          (notificationTrip && tripIds.has(notificationTrip))
          || (notificationRoute && routeIds.has(notificationRoute))
        );
      })
      .slice(0, 30);
  }

  static async attachInspectionRecords(assignments = []) {
    if (!assignments.length) {
      return;
    }

    const inspections = await VehicleInspection.find({
      trip: { $in: assignments.map((assignment) => assignment.trip?._id || assignment._id) },
    });

    const inspectionByAssignment = inspections.reduce((map, inspection) => {
      map.set(String(inspection.trip), inspection);
      return map;
    }, new Map());

    assignments.forEach((assignment) => {
      assignment.inspectionRecord = inspectionByAssignment.get(String(assignment.trip?._id || assignment._id)) || null;
    });
  }

  static async getDriverAssignment(userId, assignmentId) {
    const schedule = await TripSchedule.findOne({
      _id: assignmentId,
      'driver.userId': userId,
    }).populate('routeId');

    if (!schedule) {
      const error = new Error('Assigned trip not found for this driver');
      error.statusCode = 404;
      throw error;
    }

    return buildTripScheduleAssignment(schedule, 'DRIVER');
  }

  static async getActorAssignment(userId, role, assignmentId) {
    const schedule = await TripSchedule.findOne({
      _id: assignmentId,
      ...this.buildActorScheduleQuery(userId, role),
    }).populate('routeId');

    if (!schedule) {
      const error = new Error('Assigned trip not found for this user');
      error.statusCode = 404;
      throw error;
    }

    return buildTripScheduleAssignment(schedule, role);
  }

  static assertTripAccepted(assignment) {
    if (assignment.acceptanceStatus !== 'ACCEPTED') {
      const error = new Error('Driver must accept the assigned trip before continuing');
      error.statusCode = 409;
      throw error;
    }
  }

  static async acceptAssignedTrip(userId, role, assignmentId) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can accept assigned trips');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    const trip = assignment.trip;

    if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(trip.status)) {
      const error = new Error('This trip can no longer be accepted');
      error.statusCode = 409;
      throw error;
    }

    await TripSchedule.updateOne(
      { _id: trip._id },
      {
        $set: {
          'driverAcceptance.status': 'ACCEPTED',
          'driverAcceptance.respondedAt': new Date(),
          'driverAcceptance.rejectionReason': '',
        },
      }
    );


    const updatedSchedule = await TripSchedule.findById(trip._id).populate('routeId');
    return buildTripScheduleAssignment(updatedSchedule, 'DRIVER');
  }

  static async rejectAssignedTrip(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can reject assigned trips');
      error.statusCode = 403;
      throw error;
    }

    const reason = String(payload.reason || '').trim();
    if (reason.length < 5) {
      const error = new Error('Rejection reason must be at least 5 characters');
      error.statusCode = 400;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    const trip = assignment.trip;

    if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(trip.status)) {
      const error = new Error('This trip can no longer be rejected');
      error.statusCode = 409;
      throw error;
    }

    await TripSchedule.updateOne(
      { _id: trip._id },
      {
        $set: {
          'driverAcceptance.status': 'REJECTED',
          'driverAcceptance.respondedAt': new Date(),
          'driverAcceptance.rejectionReason': reason,
        },
      }
    );

    await this.syncToAdminIncidentReport({
      sourceType: 'TRIP_REJECTION',
      sourceId: trip._id,
      reporterId: userId,
      reporterRole: role,
      incidentType: 'OTHER',
      title: `Tài xế từ chối chuyến ${trip.scheduleCode}`,
      description: [
        'Tài xế đã từ chối chuyến được phân công.',
        `Tuyến: ${this.buildRouteLabel(trip)}.`,
        `Xe: ${this.buildVehicleLabel(trip)}.`,
        `Lý do: ${reason}`,
      ].join('\n'),
      routeId: getScheduleRouteId(trip),
      tripId: trip._id,
      vehicleId: getScheduleVehicleId(trip),
      location: this.buildRouteLabel(trip),
      severity: 'MEDIUM',
    });

    const updatedSchedule = await TripSchedule.findById(trip._id).populate('routeId');
    return buildTripScheduleAssignment(updatedSchedule, 'DRIVER');
  }

  static buildInspectionCode(assignment) {
    return `INSP-${assignment.trip?.scheduleCode || assignment.tripCode}`;
  }

  static assertTripCanBeInspected(assignment) {
    const allowedScheduleStatuses = ['PLANNED', 'ASSIGNED'];
    const blockedShiftStatuses = ['COMPLETED', 'CANCELLED'];

    if (!allowedScheduleStatuses.includes(assignment.trip?.status)) {
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
    this.assertTripAccepted(assignment);
    this.assertTripCanBeInspected(assignment);
    if (!getScheduleVehicleId(assignment.trip)) {
      const error = new Error('Assigned schedule does not have a vehicle');
      error.statusCode = 400;
      throw error;
    }
    const existingInspection = await VehicleInspection.findOne({ trip: assignment.trip._id });

    if (existingInspection) {
      const error = new Error('Vehicle inspection has already been started for this trip');
      error.statusCode = 409;
      throw error;
    }

    const inspection = await VehicleInspection.findOneAndUpdate(
      { trip: assignment.trip._id },
      {
        $setOnInsert: {
          inspectionCode: this.buildInspectionCode(assignment),
          trip: assignment.trip._id,
          assignment: assignment.trip._id,
          vehicle: getScheduleVehicleId(assignment.trip),
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
    this.assertTripAccepted(assignment);
    this.assertTripCanBeInspected(assignment);
    const checklist = {
      tires: Boolean(payload.checklist?.tires),
      brakes: Boolean(payload.checklist?.brakes),
      lights: Boolean(payload.checklist?.lights),
      fuelOrBattery: Boolean(payload.checklist?.fuelOrBattery),
      safetyEquipment: Boolean(payload.checklist?.safetyEquipment),
      cleanliness: Boolean(payload.checklist?.cleanliness),
    };
    const existingInspection = await VehicleInspection.findOne({ trip: assignment.trip._id });

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
      { trip: assignment.trip._id },
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
      FleetBus.updateOne(
        { _id: getScheduleVehicleId(assignment.trip) },
        { $set: { status: 'ACTIVE' } }
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
    this.assertTripAccepted(assignment);
    this.assertTripCanBeInspected(assignment);
    const issueCategory = payload.issueCategory || 'OTHER';
    const existingInspection = await VehicleInspection.findOne({ trip: assignment.trip._id });

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
      { trip: assignment.trip._id },
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
      TripSchedule.updateOne({ _id: assignment.trip._id }, { $set: { status: 'ASSIGNED' } }),
      FleetBus.updateOne(
        { _id: getScheduleVehicleId(assignment.trip) },
        { $set: { status: 'MAINTENANCE' } }
      ),
    ]);

    await this.syncToAdminIncidentReport({
      sourceType: 'VEHICLE_INSPECTION_ISSUE',
      sourceId: inspection._id,
      reporterId: userId,
      reporterRole: role,
      incidentType: 'VEHICLE_BREAKDOWN',
      title: `Báo lỗi xe trước chuyến ${assignment.trip.scheduleCode}`,
      description: [
        'Tài xế báo lỗi xe trong bước kiểm tra trước khi xuất bến.',
        `Nhóm lỗi: ${issueCategory}.`,
        `Xe: ${this.buildVehicleLabel(assignment.trip)}.`,
        `Tuyến: ${this.buildRouteLabel(assignment.trip)}.`,
        `Mô tả: ${description}`,
      ].join('\n'),
      routeId: getScheduleRouteId(assignment.trip),
      tripId: assignment.trip._id,
      vehicleId: getScheduleVehicleId(assignment.trip),
      location: this.buildRouteLabel(assignment.trip),
      severity: issueCategory === 'BRAKE' || issueCategory === 'ENGINE' ? 'HIGH' : 'MEDIUM',
    });

    return inspection;
  }

  static async assertDriverHasNoActiveTrip(userId, currentTripId) {
    const activeAssignment = await TripSchedule.findOne({
      _id: { $ne: currentTripId },
      'driver.userId': userId,
      status: 'IN_PROGRESS',
    });

    if (activeAssignment) {
      const error = new Error('Driver already has another trip in progress');
      error.statusCode = 409;
      throw error;
    }
  }

  static async startTrip(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can start assigned trips');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    this.assertTripAccepted(assignment);
    const trip = assignment.trip;

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

    const inspection = await VehicleInspection.findOne({ trip: trip._id });

    if (inspection?.status !== 'READY') {
      const error = new Error('Vehicle must be confirmed ready before starting the trip');
      error.statusCode = 400;
      throw error;
    }

    await this.assertDriverHasNoActiveTrip(userId, trip._id);

    const startedAt = new Date();
    const gpsPayload = normalizeStartGpsPayload(payload.gps || payload, startedAt);

    await Promise.all([
      TripSchedule.updateOne(
        { _id: trip._id },
        {
          $set: {
            status: 'IN_PROGRESS',
            actualStartAt: startedAt,
            startLocation: gpsPayload.startLocation,
            gpsSync: gpsPayload.gpsSync,
          },
        }
      ),
    ]);

    const updatedSchedule = await TripSchedule.findById(trip._id).populate('routeId');
    return buildTripScheduleAssignment(updatedSchedule, 'DRIVER');
  }

  static async completeTrip(userId, role, assignmentId) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can complete assigned trips');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    this.assertTripAccepted(assignment);
    const trip = assignment.trip;

    if (trip.status === 'COMPLETED') {
      const error = new Error('Trip has already been completed');
      error.statusCode = 409;
      throw error;
    }

    if (trip.status !== 'IN_PROGRESS') {
      const error = new Error('Trip must be in progress before it can be completed');
      error.statusCode = 409;
      throw error;
    }

    const blockingBreakdown = await OperationIncident.findOne({
      trip: trip._id,
      type: 'VEHICLE_BREAKDOWN',
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      $or: [
        { canContinue: false },
        { requiresReplacementVehicle: true },
      ],
    });

    if (blockingBreakdown) {
      const error = new Error('Trip has an unresolved vehicle breakdown that blocks completion');
      error.statusCode = 409;
      throw error;
    }

    const completedAt = new Date();
    const vehicleId = getScheduleVehicleId(trip);
    const updates = [
      TripSchedule.updateOne(
        { _id: trip._id },
        {
          $set: {
            status: 'COMPLETED',
            actualEndAt: completedAt,
          },
        }
      ),
      User.updateOne(
        { _id: userId },
        {
          $inc: { 'staffMetrics.completedTrips': 1 },
          $set: { 'staffMetrics.lastActivityAt': completedAt },
          $push: {
            activityReports: {
              type: 'TRIP_COMPLETED',
              message: `Completed trip ${assignment.tripCode}`,
              createdAt: completedAt,
            },
          },
        }
      ),
    ];

    if (vehicleId) {
      updates.push(
        FleetBus.updateOne(
          { _id: vehicleId },
          { $set: { status: 'ACTIVE' } }
        )
      );
    }

    await Promise.all(updates);

    const updatedSchedule = await TripSchedule.findById(trip._id).populate('routeId');
    return buildTripScheduleAssignment(updatedSchedule, 'DRIVER');
  }

  static async syncTripGps(userId, role, assignmentId, payload = {}) {
    if (role !== 'DRIVER') {
      const error = new Error('Only drivers can sync trip GPS');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getDriverAssignment(userId, assignmentId);
    this.assertTripAccepted(assignment);
    const trip = assignment.trip;

    if (trip.status !== 'IN_PROGRESS') {
      const error = new Error('GPS can only be synced while the trip is in progress');
      error.statusCode = 409;
      throw error;
    }

    const syncedAt = new Date();
    const gpsPayload = normalizeStartGpsPayload(payload.gps || payload, syncedAt);

    await TripSchedule.updateOne(
      { _id: trip._id },
      {
        $set: {
          startLocation: gpsPayload.startLocation,
          gpsSync: gpsPayload.gpsSync,
        },
      }
    );

    const updatedSchedule = await TripSchedule.findById(trip._id).populate('routeId');
    return buildTripScheduleAssignment(updatedSchedule, 'DRIVER');
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

      if (!TRAFFIC_CATEGORIES.includes(payload.trafficCategory)) {
        const error = new Error('Traffic congestion category is invalid');
        error.statusCode = 400;
        throw error;
      }

      if (!AFFECTED_DIRECTIONS.includes(payload.affectedDirection)) {
        const error = new Error('Affected direction is invalid');
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'ACCIDENT' && severity === 'LOW') {
      const error = new Error('Accident severity must be medium or higher');
      error.statusCode = 400;
      throw error;
    }

    if (type === 'VEHICLE_BREAKDOWN' && parseBoolean(payload.canContinue) === null) {
      const error = new Error('Vehicle breakdown report must specify whether the vehicle can continue');
      error.statusCode = 400;
      throw error;
    }

    if (type === 'PASSENGER_VIOLATION') {
      if (!PASSENGER_VIOLATION_CATEGORIES.includes(payload.violationCategory)) {
        const error = new Error('Passenger violation category is invalid');
        error.statusCode = 400;
        throw error;
      }

      if (String(payload.actionTaken || '').trim().length < 3) {
        const error = new Error('Action taken is required for passenger violation reports');
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'PASSENGER_CONFLICT') {
      if (!PASSENGER_CONFLICT_CATEGORIES.includes(payload.conflictCategory)) {
        const error = new Error('Passenger conflict category is invalid');
        error.statusCode = 400;
        throw error;
      }

      if (String(payload.actionTaken || '').trim().length < 3) {
        const error = new Error('Action taken is required for passenger conflict reports');
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'FOUND_ITEM') {
      if (String(payload.itemName || '').trim().length < 2) {
        const error = new Error('Found item name is required');
        error.statusCode = 400;
        throw error;
      }

      if (String(payload.foundLocation || locationText).trim().length < 3) {
        const error = new Error('Found item location is required');
        error.statusCode = 400;
        throw error;
      }
    }

    return {
      type,
      severity,
      description,
      locationText,
      trafficCategory: type === 'TRAFFIC_CONGESTION' ? payload.trafficCategory : null,
      affectedDirection: type === 'TRAFFIC_CONGESTION' ? payload.affectedDirection : null,
    };
  }

  static buildIncidentEvidence(files = []) {
    return files.map((file) => ({
      originalName: file.originalname || '',
      filename: file.filename || '',
      url: `/uploads/operation-incidents/${file.filename}`,
      mimeType: file.mimetype || '',
      size: file.size || 0,
      uploadedAt: new Date(),
    }));
  }

  static buildRouteLabel(trip = {}) {
    return trip.routeName || trip.routeId?.routeName || trip.routeId?.name || trip.routeCode || 'Unknown route';
  }

  static buildVehicleLabel(trip = {}) {
    const vehicle = trip.vehicle || {};
    return [vehicle.plateNumber, vehicle.busCode].filter(Boolean).join(' - ') || 'Unknown vehicle';
  }

  static async syncToAdminIncidentReport(payload = {}) {
    try {
      const {
        sourceType,
        sourceId,
        reporterId,
        reporterRole = 'DRIVER',
        incidentType = 'OTHER',
        title,
        description,
        routeId = null,
        tripId = null,
        vehicleId = null,
        location = '',
        latitude = null,
        longitude = null,
        severity = 'MEDIUM',
        attachments = [],
      } = payload;

      if (!sourceType || !sourceId || !reporterId || !title || !description) {
        return null;
      }

      return IncidentReport.findOneAndUpdate(
        { sourceType, sourceId },
        {
          $setOnInsert: {
            reporterId,
            reporterRole,
            incidentType,
            title,
            description,
            routeId,
            tripId,
            vehicleId,
            location,
            latitude,
            longitude,
            severity,
            status: 'PENDING',
            attachments,
            sourceType,
            sourceId,
            sourceModule: 'SCHEDULE_OPERATIONS',
          },
        },
        { upsert: true, new: true }
      );
    } catch {
      return null;
    }
  }

  static mapOperationStatusToAdminStatus(status) {
    if (status === 'RESOLVED') return 'RESOLVED';
    if (status === 'ACKNOWLEDGED') return 'IN_PROGRESS';
    if (status === 'CANCELLED') return 'REJECTED';
    return 'PENDING';
  }

  static async reportOperationIncident(userId, role, assignmentId, payload = {}, files = []) {
    if (!['DRIVER', 'BUS_ASSISTANT'].includes(role)) {
      const error = new Error('Only drivers or bus assistants can report operation incidents');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await this.getActorAssignment(userId, role, assignmentId);
    if (role === 'DRIVER') {
      this.assertTripAccepted(assignment);
    }
    const {
      type,
      severity,
      description,
      locationText,
      trafficCategory,
      affectedDirection,
    } = this.validateIncidentPayload(payload);
    if (!getScheduleRouteId(assignment.trip) || !getScheduleVehicleId(assignment.trip)) {
      const error = new Error('Assigned schedule must have route and vehicle before reporting incidents');
      error.statusCode = 400;
      throw error;
    }

    if (assignment.trip.status !== 'IN_PROGRESS' && !(type === 'FOUND_ITEM' && assignment.trip.status === 'COMPLETED')) {
      const error = new Error('Operation incidents can only be reported while the trip is in progress');
      error.statusCode = 409;
      throw error;
    }

    const incident = await OperationIncident.create({
      incidentCode: this.buildIncidentCode(assignment, type),
      type,
      severity,
      trip: assignment.trip._id,
      route: getScheduleRouteId(assignment.trip),
      vehicle: getScheduleVehicleId(assignment.trip),
      driver: userId,
      reporterRole: role,
      locationText,
      latitude: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : null,
      longitude: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : null,
      estimatedDelayMinutes: type === 'TRAFFIC_CONGESTION'
        ? Number(payload.estimatedDelayMinutes)
        : 0,
      trafficCategory,
      affectedDirection,
      description,
      injuriesReported: type === 'ACCIDENT'
        ? Boolean(payload.injuriesReported)
        : false,
      policeNotified: type === 'ACCIDENT'
        ? Boolean(payload.policeNotified)
        : false,
      canContinue: type === 'VEHICLE_BREAKDOWN'
        ? parseBoolean(payload.canContinue)
        : null,
      requiresReplacementVehicle: type === 'VEHICLE_BREAKDOWN'
        ? Boolean(parseBoolean(payload.requiresReplacementVehicle))
        : false,
      passengerViolation: type === 'PASSENGER_VIOLATION'
        ? {
          violationCategory: payload.violationCategory,
          passengerDescription: String(payload.passengerDescription || '').trim(),
          actionTaken: String(payload.actionTaken || '').trim(),
        }
        : undefined,
      passengerConflict: type === 'PASSENGER_CONFLICT'
        ? {
          conflictCategory: payload.conflictCategory,
          partiesInvolved: String(payload.partiesInvolved || '').trim(),
          actionTaken: String(payload.actionTaken || '').trim(),
        }
        : undefined,
      foundItem: type === 'FOUND_ITEM'
        ? {
          itemName: String(payload.itemName || '').trim(),
          itemDescription: String(payload.itemDescription || description).trim(),
          foundLocation: String(payload.foundLocation || locationText).trim(),
          handedTo: String(payload.handedTo || '').trim(),
          recoveryStatus: 'REPORTED',
        }
        : undefined,
      evidenceFiles: this.buildIncidentEvidence(files),
      reportedAt: new Date(),
    });

    if (type === 'VEHICLE_BREAKDOWN') {
      await FleetBus.updateOne(
        { _id: getScheduleVehicleId(assignment.trip) },
        { $set: { status: 'MAINTENANCE' } }
      );
    }

    if (['TRAFFIC_CONGESTION', 'ACCIDENT', 'PASSENGER_VIOLATION', 'PASSENGER_CONFLICT', 'FOUND_ITEM'].includes(type)) {
      const titleLabel = {
        TRAFFIC_CONGESTION: 'Báo kẹt xe',
        ACCIDENT: 'Báo tai nạn',
        PASSENGER_VIOLATION: 'Báo hành khách vi phạm',
        PASSENGER_CONFLICT: 'Báo xung đột hành khách',
        FOUND_ITEM: 'Báo đồ tìm thấy',
      }[type];

      await this.syncToAdminIncidentReport({
        sourceType: `OPERATION_${type}`,
        sourceId: incident._id,
        reporterId: userId,
        reporterRole: role,
        incidentType: type,
        title: `${titleLabel} - ${assignment.trip.scheduleCode}`,
        description: [
          `${role === 'BUS_ASSISTANT' ? 'Phụ xe' : 'Tài xế'} gửi báo cáo trong lúc vận hành chuyến.`,
          `Tuyến: ${this.buildRouteLabel(assignment.trip)}.`,
          `Xe: ${this.buildVehicleLabel(assignment.trip)}.`,
          `Vị trí: ${locationText}.`,
          type === 'TRAFFIC_CONGESTION'
            ? `Ước tính trễ: ${Number(payload.estimatedDelayMinutes)} phút.`
            : '',
          type === 'TRAFFIC_CONGESTION' && trafficCategory
            ? `Loại kẹt xe: ${trafficCategory}.`
            : '',
          type === 'TRAFFIC_CONGESTION' && affectedDirection
            ? `Chiều ảnh hưởng: ${affectedDirection}.`
            : '',
          type === 'ACCIDENT'
            ? `Có người bị thương: ${Boolean(payload.injuriesReported) ? 'Có' : 'Không'}.`
            : '',
          type === 'ACCIDENT'
            ? `Đã báo cơ quan chức năng: ${Boolean(payload.policeNotified) ? 'Có' : 'Không'}.`
            : '',
          type === 'PASSENGER_VIOLATION'
            ? `Loại vi phạm: ${payload.violationCategory}.`
            : '',
          type === 'PASSENGER_VIOLATION'
            ? `Mô tả hành khách: ${String(payload.passengerDescription || 'Chưa ghi nhận').trim()}.`
            : '',
          type === 'PASSENGER_VIOLATION'
            ? `Hành động đã xử lý: ${String(payload.actionTaken || '').trim()}.`
            : '',
          type === 'PASSENGER_CONFLICT'
            ? `Nhóm xung đột: ${payload.conflictCategory}.`
            : '',
          type === 'PASSENGER_CONFLICT'
            ? `Các bên liên quan: ${String(payload.partiesInvolved || 'Chưa ghi nhận').trim()}.`
            : '',
          type === 'PASSENGER_CONFLICT'
            ? `Hành động đã xử lý: ${String(payload.actionTaken || '').trim()}.`
            : '',
          type === 'FOUND_ITEM'
            ? `Tên đồ vật: ${String(payload.itemName || '').trim()}.`
            : '',
          type === 'FOUND_ITEM'
            ? `Vị trí tìm thấy: ${String(payload.foundLocation || locationText).trim()}.`
            : '',
          type === 'FOUND_ITEM' && payload.handedTo
            ? `Bàn giao cho: ${String(payload.handedTo).trim()}.`
            : '',
          `Mô tả: ${description}`,
        ].filter(Boolean).join('\n'),
        routeId: getScheduleRouteId(assignment.trip),
        tripId: assignment.trip._id,
        vehicleId: getScheduleVehicleId(assignment.trip),
        location: locationText,
        latitude: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : null,
        longitude: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : null,
        severity,
        attachments: (incident.evidenceFiles || []).map((file) => file.url).filter(Boolean),
      });
    }


    return OperationIncident.findById(incident._id)
      .populate('driver', 'fullName phoneNumber role');
  }

  static async listOperationIncidents(userId, role, assignmentId) {
    const assignment = role === 'DRIVER'
      ? await this.getDriverAssignment(userId, assignmentId)
      : buildTripScheduleAssignment(await TripSchedule.findOne({
        _id: assignmentId,
        'assistant.userId': userId,
      }).populate('routeId'), 'BUS_ASSISTANT');

    if (!assignment?.trip) {
      const error = new Error('Assigned trip not found for this user');
      error.statusCode = 404;
      throw error;
    }

    return OperationIncident.find({ trip: assignment.trip._id })
      .sort({ reportedAt: -1 })
      .populate('driver', 'fullName phoneNumber role');
  }
}

export default ScheduleOperationsService;


