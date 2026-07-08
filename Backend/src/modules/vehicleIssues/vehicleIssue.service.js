import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import Vehicle from '../fleetOperations/Vehicle.js';
import PassengerTicket from '../tickets/Ticket.js';
import { createBroadcastNotification } from '../systemNotifications/systemNotification.service.js';
import VehicleReassignmentService from '../vehicleReassignments/vehicleReassignment.service.js';
import VehicleIssue from './VehicleIssue.js';
import MaintenanceTask from './MaintenanceTask.js';

const DECISION_STATUS_MAP = {
  mark_reviewed: 'reviewed',
  no_action_needed: 'no_action_needed',
  create_maintenance_task: 'maintenance_required',
  mark_vehicle_under_maintenance: 'maintenance_required',
  assign_replacement_vehicle: 'maintenance_required',
  resolved: 'resolved',
  dismissed: 'dismissed',
};

const ALLOWED_TRANSITIONS = {
  new: ['reviewed', 'maintenance_required', 'no_action_needed', 'resolved', 'dismissed'],
  reviewed: ['maintenance_required', 'no_action_needed', 'resolved', 'dismissed'],
  maintenance_required: ['resolved', 'dismissed'],
  no_action_needed: ['reviewed', 'resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

const toPositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const normalizeIssueType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  const legacyMap = {
    ENGINE: 'engine',
    BRAKE: 'brake',
    BRAKES: 'brake',
    TIRE: 'tire',
    FLAT_TIRE: 'tire',
    ENGINE_FAILURE: 'engine',
    BRAKE_FAILURE: 'brake',
    ACCIDENT: 'accident',
    TIRES: 'tire',
    DOOR: 'door',
    AIR_CONDITIONER: 'air_conditioner',
    AC: 'air_conditioner',
    GPS: 'gps_device',
    GPS_DEVICE: 'gps_device',
    TICKET_SCANNER: 'ticket_scanner',
    CLEANLINESS: 'cleanliness',
    SAFETY_EQUIPMENT: 'safety_equipment',
    OTHER: 'other',
  };
  return legacyMap[String(value || '').trim().toUpperCase()] || normalized || 'other';
};

const normalizeBreakdownType = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const map = {
    ENGINE: 'ENGINE_FAILURE',
    ENGINE_FAILURE: 'ENGINE_FAILURE',
    BRAKE: 'BRAKE_FAILURE',
    BRAKES: 'BRAKE_FAILURE',
    BRAKE_FAILURE: 'BRAKE_FAILURE',
    TIRE: 'FLAT_TIRE',
    FLAT_TIRE: 'FLAT_TIRE',
    ACCIDENT: 'ACCIDENT',
    OTHER: 'OTHER',
  };
  return map[normalized] || 'OTHER';
};

const issueTypeFromBreakdownType = (breakdownType) => ({
  ENGINE_FAILURE: 'engine',
  BRAKE_FAILURE: 'brake',
  FLAT_TIRE: 'tire',
  ACCIDENT: 'accident',
  OTHER: 'other',
}[breakdownType] || 'other');

const severityFromBreakdownType = (breakdownType) => (
  ['BRAKE_FAILURE', 'ACCIDENT'].includes(breakdownType) ? 'critical' : 'high'
);

const normalizeSeverity = (value) => {
  const severity = String(value || '').trim().toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium';
};

const buildFilter = (query = {}) => {
  const filter = {};

  ['status', 'severity', 'issueType'].forEach((field) => {
    if (query[field]) {
      filter[field] = query[field];
    }
  });

  if (query.vehicleId) {
    filter.vehicleId = new mongoose.Types.ObjectId(query.vehicleId);
  }

  if (query.emergency === 'true' || query.emergency === '1') {
    filter['emergencyBreakdown.isEmergency'] = true;
  }
  if (query.emergency === 'false' || query.emergency === '0') {
    filter.$or = [
      { 'emergencyBreakdown.isEmergency': { $ne: true } },
      { emergencyBreakdown: { $exists: false } },
    ];
  }

  if (query.emergencyStatus) {
    filter['emergencyBreakdown.incidentStatus'] = query.emergencyStatus;
  }

  if (query.startDate || query.endDate) {
    filter.reportedAt = {};
    if (query.startDate) {
      filter.reportedAt.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      filter.reportedAt.$lte = endOfDay(query.endDate);
    }
  }

  return filter;
};

const safeUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
  };
};

const safeVehicle = (vehicle) => {
  if (!vehicle) return null;
  return {
    _id: vehicle._id,
    busCode: vehicle.busCode || vehicle.vehicleCode || '',
    plateNumber: vehicle.plateNumber || '',
    busType: vehicle.busType || '',
    capacity: vehicle.capacity || 0,
    status: vehicle.status || '',
  };
};

const safeTrip = (trip) => {
  if (!trip) return null;
  return {
    _id: trip._id,
    scheduleCode: trip.scheduleCode,
    serviceDate: trip.serviceDate,
    routeCode: trip.routeCode,
    routeName: trip.routeName,
    departureTime: trip.departureTime,
    expectedArrivalTime: trip.expectedArrivalTime,
    status: trip.status,
    vehicle: trip.vehicle,
    driver: trip.driver,
    assistant: trip.assistant,
  };
};

const formatIssue = (issue) => ({
  ...issue,
  vehicle: safeVehicle(issue.vehicleId),
  vehicleId: issue.vehicleId?._id || issue.vehicleId,
  trip: safeTrip(issue.tripId),
  tripId: issue.tripId?._id || issue.tripId,
  reportedBy: safeUser(issue.reportedBy),
  reviewedBy: safeUser(issue.reviewedBy),
  emergencyBreakdown: issue.emergencyBreakdown
    ? {
      ...issue.emergencyBreakdown,
      standbyVehicle: safeVehicle(issue.emergencyBreakdown.standbyVehicleId),
      standbyVehicleId: issue.emergencyBreakdown.standbyVehicleId?._id || issue.emergencyBreakdown.standbyVehicleId || null,
      assignedDriver: safeUser(issue.emergencyBreakdown.assignedDriverId),
      assignedDriverId: issue.emergencyBreakdown.assignedDriverId?._id || issue.emergencyBreakdown.assignedDriverId || null,
    }
    : null,
  reviewHistory: (issue.reviewHistory || []).map((entry) => ({
    ...entry,
    reviewedBy: safeUser(entry.reviewedBy),
  })),
});

const logAudit = async ({ action, actorId, issueId, metadata = {} }) => {
  try {
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) return;
    await AuditLog.create({
      action,
      actorId,
      entityType: 'VehicleIssue',
      entityId: issueId,
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Optional audit logging must not block vehicle issue review.
  }
};

export class VehicleIssueService {
  static async createEmergencyBreakdownFromOperationIncident({
    assignment,
    userId,
    payload = {},
    operationIncident = null,
    io = null,
  }) {
    const vehicleId = assignment?.trip?.vehicle?.busId;
    const tripId = assignment?.trip?._id;
    if (!vehicleId || !tripId) return null;

    const breakdownType = normalizeBreakdownType(payload.breakdownType || payload.issueType || payload.issueCategory);
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const locationText = String(payload.locationText || payload.location || '').trim()
      || assignment.trip.routeName
      || assignment.trip.scheduleCode
      || '';

    const issue = await VehicleIssue.create({
      vehicleId,
      tripId,
      reportedBy: userId,
      reportedAt: operationIncident?.reportedAt || new Date(),
      issueType: issueTypeFromBreakdownType(breakdownType),
      severity: severityFromBreakdownType(breakdownType),
      description: String(payload.description || '').trim(),
      photos: (operationIncident?.evidenceFiles || []).map((file) => file.url).filter(Boolean),
      location: {
        text: locationText,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
      },
      status: 'new',
      emergencyBreakdown: {
        isEmergency: true,
        breakdownType,
        incidentStatus: 'REPORTED',
        sourceIncidentId: operationIncident?._id || null,
      },
    });

    await this.markVehicleUnderMaintenance(vehicleId);

    try {
      await createBroadcastNotification({
        title: 'Emergency vehicle breakdown reported',
        message: `Driver reported ${breakdownType.replaceAll('_', ' ').toLowerCase()} on trip ${assignment.trip.scheduleCode || tripId}.`,
        type: 'emergency',
        priority: 'urgent',
        targetAudience: 'admins',
        tripId,
        sourceType: 'UC48_EMERGENCY_BREAKDOWN',
        sourceId: issue._id,
        metadata: {
          issueId: String(issue._id),
          tripId: String(tripId),
          vehicleId: String(vehicleId),
          breakdownType,
        },
      }, userId, io);
    } catch {
      // The emergency issue itself must still be stored even if realtime notification fails.
    }

    io?.to('fleet:operations').emit('server:vehicleIssue:emergencyReported', issue);
    io?.emit('server:vehicleIssue:emergencyReported', issue);
    return issue;
  }

  static async createFromDriverReport({ assignment, inspection, userId, payload = {} }) {
    const vehicleId = assignment?.trip?.vehicle?.busId;
    if (!vehicleId) {
      return null;
    }

    const locationText = String(payload.location || payload.locationText || '').trim();
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);

    return VehicleIssue.findOneAndUpdate(
      { inspectionId: inspection._id },
      {
        $setOnInsert: {
          vehicleId,
          tripId: assignment.trip._id,
          inspectionId: inspection._id,
          reportedBy: userId,
          reportedAt: inspection.reportedAt || new Date(),
        },
        $set: {
          issueType: normalizeIssueType(payload.issueType || payload.issueCategory),
          severity: normalizeSeverity(payload.severity),
          description: String(payload.description || payload.issueDescription || '').trim(),
          photos: Array.isArray(payload.photos) ? payload.photos.filter(Boolean) : [],
          location: {
            text: locationText,
            latitude: Number.isFinite(latitude) ? latitude : null,
            longitude: Number.isFinite(longitude) ? longitude : null,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  static async getIssues(query = {}) {
    const page = toPositiveInteger(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = toPositiveInteger(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = buildFilter(query);

    const [issues, total, counts, affectedVehicles] = await Promise.all([
      VehicleIssue.find(filter)
        .populate('vehicleId')
        .populate('tripId')
        .populate('reportedBy', 'fullName email phoneNumber role')
        .populate('emergencyBreakdown.standbyVehicleId')
        .populate('emergencyBreakdown.assignedDriverId', 'fullName email phoneNumber role')
        .sort({ severity: 1, reportedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VehicleIssue.countDocuments(filter),
      VehicleIssue.aggregate([
        {
          $group: {
            _id: null,
            newIssues: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
            criticalIssues: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            maintenanceRequired: {
              $sum: { $cond: [{ $eq: ['$status', 'maintenance_required'] }, 1, 0] },
            },
            emergencyReported: {
              $sum: { $cond: [{ $eq: ['$emergencyBreakdown.incidentStatus', 'REPORTED'] }, 1, 0] },
            },
            emergencyConfirmed: {
              $sum: { $cond: [{ $eq: ['$emergencyBreakdown.incidentStatus', 'CONFIRMED'] }, 1, 0] },
            },
            standbyDispatched: {
              $sum: { $cond: [{ $eq: ['$emergencyBreakdown.incidentStatus', 'STANDBY_BUS_DISPATCHED'] }, 1, 0] },
            },
          },
        },
      ]),
      VehicleIssue.distinct('vehicleId', filter),
    ]);

    return {
      issues: issues.map(formatIssue),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      counts: {
        newIssues: counts[0]?.newIssues || 0,
        criticalIssues: counts[0]?.criticalIssues || 0,
        vehiclesAffected: affectedVehicles.length,
        maintenanceRequired: counts[0]?.maintenanceRequired || 0,
        emergencyReported: counts[0]?.emergencyReported || 0,
        emergencyConfirmed: counts[0]?.emergencyConfirmed || 0,
        standbyDispatched: counts[0]?.standbyDispatched || 0,
      },
    };
  }

  static async getIssueById(id, actor) {
    const issue = await VehicleIssue.findById(id)
      .populate('vehicleId')
      .populate('tripId')
      .populate('reportedBy', 'fullName email phoneNumber role')
      .populate('reviewedBy', 'fullName email phoneNumber role')
      .populate('emergencyBreakdown.standbyVehicleId')
      .populate('emergencyBreakdown.assignedDriverId', 'fullName email phoneNumber role')
      .populate('reviewHistory.reviewedBy', 'fullName email phoneNumber role')
      .lean();

    if (!issue) {
      throw new CustomError('Vehicle issue not found', HTTP_STATUS.NOT_FOUND);
    }

    const [relatedIssues, maintenanceTasks] = await Promise.all([
      VehicleIssue.find({
        vehicleId: issue.vehicleId?._id || issue.vehicleId,
        _id: { $ne: issue._id },
      })
        .select('issueType severity status reportedAt adminNote')
        .sort({ reportedAt: -1 })
        .limit(8)
        .lean(),
      MaintenanceTask.find({ vehicleId: issue.vehicleId?._id || issue.vehicleId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    await logAudit({
      action: 'VEHICLE_ISSUE_DETAIL_VIEWED',
      actorId: actor?.userId,
      issueId: issue._id,
    });

    return {
      ...formatIssue(issue),
      maintenanceHistory: {
        relatedIssues,
        maintenanceTasks,
      },
      criticalSafetyRecommendation: issue.severity === 'critical'
        ? 'Critical safety issue: take this vehicle out of service until reviewed by maintenance.'
        : '',
    };
  }

  static assertTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
      return;
    }

    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
      throw new CustomError(
        `Cannot transition vehicle issue from ${currentStatus} to ${nextStatus}`,
        HTTP_STATUS.CONFLICT
      );
    }
  }

  static async createMaintenanceTask(issue, actor, adminNote) {
    if (issue.maintenanceTaskId) {
      return issue.maintenanceTaskId;
    }

    const task = await MaintenanceTask.create({
      vehicleIssueId: issue._id,
      vehicleId: issue.vehicleId,
      tripId: issue.tripId,
      title: `Review ${issue.issueType} issue`,
      description: issue.description,
      priority: issue.severity,
      status: 'draft',
      createdBy: actor.userId,
      adminNote,
    });

    return task._id;
  }

  static async markVehicleUnderMaintenance(vehicleId) {
    await Promise.all([
      FleetBus.updateOne({ _id: vehicleId }, { $set: { status: 'MAINTENANCE' } }),
      Vehicle.updateOne({ _id: vehicleId }, { $set: { status: 'maintenance' } }),
    ]);
  }

  static async assignReplacementVehicle(issue, replacementVehicleId, actor, adminNote, payload = {}, io = null) {
    if (!issue.tripId || !replacementVehicleId) {
      return null;
    }

    const result = await VehicleReassignmentService.assignReplacementVehicle(
      issue.tripId,
      replacementVehicleId,
      {
        reason: payload.reason || 'maintenance_required',
        note: adminNote || 'Replacement assigned from vehicle issue review.',
        notifyStaff: payload.notifyStaff !== false,
        notifyPassengers: Boolean(payload.notifyPassengers),
      },
      actor.userId,
      io
    );

    return result.reassignmentLog?.newVehicleId || replacementVehicleId;
  }

  static assertEmergencyIssue(issue) {
    if (!issue?.emergencyBreakdown?.isEmergency) {
      throw new CustomError('This vehicle issue is not an emergency breakdown', HTTP_STATUS.CONFLICT);
    }
  }

  static async confirmEmergencyBreakdown(id, payload, actor, io = null) {
    const issue = await VehicleIssue.findById(id);
    if (!issue) throw new CustomError('Vehicle issue not found', HTTP_STATUS.NOT_FOUND);
    this.assertEmergencyIssue(issue);
    if (issue.emergencyBreakdown.incidentStatus !== 'REPORTED') {
      throw new CustomError('Only reported breakdowns can be confirmed', HTTP_STATUS.CONFLICT);
    }

    issue.emergencyBreakdown.incidentStatus = 'CONFIRMED';
    issue.emergencyBreakdown.confirmedAt = new Date();
    issue.status = 'reviewed';
    issue.decision = 'mark_reviewed';
    issue.adminNote = String(payload.adminNote || issue.adminNote || '').trim();
    issue.reviewedBy = actor.userId;
    issue.reviewedAt = new Date();
    issue.reviewHistory.push({
      fromStatus: 'new',
      toStatus: 'reviewed',
      decision: 'mark_reviewed',
      adminNote: issue.adminNote,
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
    });
    await issue.save();

    const updated = await this.getIssueById(id, actor);
    io?.to('fleet:operations').emit('server:vehicleIssue:emergencyConfirmed', updated);
    io?.emit('server:vehicleIssue:emergencyConfirmed', updated);
    return updated;
  }

  static async resolveTripPassengerIds(issue) {
    const trip = await TripSchedule.findById(issue.tripId).lean();
    const tripKeys = [
      issue.tripId ? String(issue.tripId) : '',
      trip?.scheduleCode || '',
    ].filter(Boolean);

    if (!tripKeys.length) return [];

    const tickets = await PassengerTicket.find({
      tripId: { $in: tripKeys },
      bookingStatus: 'SUCCESS',
      paymentStatus: 'PAID',
      ticketStatus: { $nin: ['CANCELLED', 'REFUNDED'] },
    }).select('passenger').lean();

    return [...new Set(tickets.map((ticket) => String(ticket.passenger)).filter(Boolean))];
  }

  static async dispatchStandbyBus(id, payload, actor, io = null) {
    const issue = await VehicleIssue.findById(id);
    if (!issue) throw new CustomError('Vehicle issue not found', HTTP_STATUS.NOT_FOUND);
    this.assertEmergencyIssue(issue);
    if (issue.emergencyBreakdown.incidentStatus !== 'CONFIRMED') {
      throw new CustomError('Confirm the breakdown before dispatching a standby bus', HTTP_STATUS.CONFLICT);
    }
    if (!payload.standbyVehicleId || !mongoose.isValidObjectId(payload.standbyVehicleId)) {
      throw new CustomError('Standby vehicle is required', HTTP_STATUS.BAD_REQUEST);
    }

    const dispatchedVehicleId = await this.assignReplacementVehicle(
      issue,
      payload.standbyVehicleId,
      actor,
      payload.adminNote || 'Standby bus dispatched for emergency breakdown.',
      {
        reason: 'breakdown',
        note: payload.adminNote || 'Standby bus dispatched for emergency breakdown.',
        notifyStaff: true,
        notifyPassengers: false,
      },
      io
    );

    const passengerIds = await this.resolveTripPassengerIds(issue);
    let notification = null;
    if (passengerIds.length) {
      notification = await createBroadcastNotification({
        title: 'Standby bus dispatched',
        message: 'Your bus has encountered a technical issue.\nA standby bus has been dispatched and will continue your journey shortly.\nWe sincerely apologize for the inconvenience.',
        type: 'emergency',
        priority: 'urgent',
        targetAudience: 'specific_users',
        userIds: passengerIds,
        tripId: issue.tripId,
        sourceType: 'UC48_STANDBY_BUS_DISPATCHED',
        sourceId: issue._id,
        metadata: {
          issueId: String(issue._id),
          standbyVehicleId: String(dispatchedVehicleId || payload.standbyVehicleId),
        },
      }, actor.userId, io);
    }

    issue.emergencyBreakdown.incidentStatus = 'STANDBY_BUS_DISPATCHED';
    issue.emergencyBreakdown.standbyVehicleId = dispatchedVehicleId || payload.standbyVehicleId;
    issue.emergencyBreakdown.assignedDriverId = payload.assignedDriverId || null;
    issue.emergencyBreakdown.dispatchTime = new Date();
    issue.emergencyBreakdown.passengerNotificationId = notification?._id || null;
    issue.emergencyBreakdown.notificationSentAt = notification?.deliverySummary?.sentAt || (notification ? new Date() : null);
    issue.replacementVehicleId = dispatchedVehicleId || payload.standbyVehicleId;
    issue.status = 'maintenance_required';
    issue.decision = 'assign_replacement_vehicle';
    issue.adminNote = String(payload.adminNote || issue.adminNote || '').trim();
    issue.reviewedBy = actor.userId;
    issue.reviewedAt = new Date();
    issue.reviewHistory.push({
      fromStatus: 'reviewed',
      toStatus: 'maintenance_required',
      decision: 'assign_replacement_vehicle',
      adminNote: issue.adminNote,
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
      actions: {
        assignedReplacementVehicle: dispatchedVehicleId || payload.standbyVehicleId,
      },
    });
    await issue.save();

    const updated = await this.getIssueById(id, actor);
    io?.to('fleet:operations').emit('server:vehicleIssue:standbyDispatched', updated);
    io?.emit('server:vehicleIssue:standbyDispatched', updated);
    return updated;
  }

  static async resolveEmergencyBreakdown(id, payload, actor, io = null) {
    const issue = await VehicleIssue.findById(id);
    if (!issue) throw new CustomError('Vehicle issue not found', HTTP_STATUS.NOT_FOUND);
    this.assertEmergencyIssue(issue);
    if (issue.emergencyBreakdown.incidentStatus !== 'STANDBY_BUS_DISPATCHED') {
      throw new CustomError('A standby bus must be dispatched before resolving this emergency', HTTP_STATUS.CONFLICT);
    }

    issue.emergencyBreakdown.incidentStatus = 'RESOLVED';
    issue.status = 'resolved';
    issue.decision = 'resolved';
    issue.adminNote = String(payload.adminNote || issue.adminNote || '').trim();
    issue.reviewedBy = actor.userId;
    issue.reviewedAt = new Date();
    issue.reviewHistory.push({
      fromStatus: 'maintenance_required',
      toStatus: 'resolved',
      decision: 'resolved',
      adminNote: issue.adminNote,
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
    });
    await issue.save();

    const updated = await this.getIssueById(id, actor);
    io?.to('fleet:operations').emit('server:vehicleIssue:emergencyResolved', updated);
    io?.emit('server:vehicleIssue:emergencyResolved', updated);
    return updated;
  }

  static async reviewIssue(id, payload, actor, io) {
    const issue = await VehicleIssue.findById(id);
    if (!issue) {
      throw new CustomError('Vehicle issue not found', HTTP_STATUS.NOT_FOUND);
    }

    const adminNote = String(payload.adminNote || '').trim();
    const shouldCreateMaintenanceTask = Boolean(payload.createMaintenanceTask)
      || payload.decision === 'create_maintenance_task';
    const shouldMarkMaintenance = Boolean(payload.markVehicleUnderMaintenance)
      || payload.decision === 'mark_vehicle_under_maintenance';
    const shouldAssignReplacement = payload.decision === 'assign_replacement_vehicle'
      && payload.replacementVehicleId;
    const nextStatus = shouldCreateMaintenanceTask || shouldMarkMaintenance || shouldAssignReplacement
      ? 'maintenance_required'
      : DECISION_STATUS_MAP[payload.decision];

    this.assertTransition(issue.status, nextStatus);

    const previousStatus = issue.status;
    let maintenanceTaskId = issue.maintenanceTaskId;
    let replacementVehicleId = issue.replacementVehicleId;

    if (shouldCreateMaintenanceTask) {
      maintenanceTaskId = await this.createMaintenanceTask(issue, actor, adminNote);
    }

    if (shouldMarkMaintenance) {
      await this.markVehicleUnderMaintenance(issue.vehicleId);
    }

    if (shouldAssignReplacement) {
      replacementVehicleId = await this.assignReplacementVehicle(
        issue,
        payload.replacementVehicleId,
        actor,
        adminNote,
        payload,
        io
      );
    }

    issue.status = nextStatus;
    issue.decision = payload.decision;
    issue.adminNote = adminNote || issue.adminNote;
    issue.reviewedBy = actor.userId;
    issue.reviewedAt = new Date();
    issue.maintenanceTaskId = maintenanceTaskId || null;
    issue.replacementVehicleId = replacementVehicleId || null;
    issue.reviewHistory.push({
      fromStatus: previousStatus,
      toStatus: nextStatus,
      decision: payload.decision,
      adminNote,
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
      actions: {
        markVehicleUnderMaintenance: shouldMarkMaintenance,
        createMaintenanceTask: shouldCreateMaintenanceTask,
        assignedReplacementVehicle: replacementVehicleId || null,
      },
    });

    await issue.save();

    await logAudit({
      action: 'VEHICLE_ISSUE_REVIEWED',
      actorId: actor?.userId,
      issueId: issue._id,
      metadata: {
        fromStatus: previousStatus,
        toStatus: nextStatus,
        decision: payload.decision,
        markVehicleUnderMaintenance: shouldMarkMaintenance,
        createMaintenanceTask: shouldCreateMaintenanceTask,
        replacementVehicleId,
      },
    });

    const reviewedIssue = await this.getIssueById(id, actor);
    io?.to('fleet:operations').emit('server:vehicleIssue:reviewed', reviewedIssue);
    io?.emit('server:vehicleIssue:reviewed', reviewedIssue);
    return reviewedIssue;
  }
}

export default VehicleIssueService;
