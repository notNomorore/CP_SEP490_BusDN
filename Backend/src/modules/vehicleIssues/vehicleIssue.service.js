import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import FleetBus from '../admin/FleetBus.js';
import TripSchedule from '../admin/TripSchedule.js';
import Vehicle from '../fleetOperations/Vehicle.js';
import Trip from '../fleetOperations/Trip.js';
import PassengerTicket from '../tickets/Ticket.js';
import BoardingRecord from '../busAssistant/BoardingRecord.js';
import OperationIncident from '../scheduleOperations/OperationIncident.js';
import OperationNotification from '../scheduleOperations/OperationNotification.js';
import { createBroadcastNotification } from '../systemNotifications/systemNotification.service.js';
import VehicleReassignmentService from '../vehicleReassignments/vehicleReassignment.service.js';
import VehicleIssue from './VehicleIssue.js';
import MaintenanceTask from './MaintenanceTask.js';
import { propagateIncidentDelay } from '../scheduleOperations/scheduleDelayPropagation.service.js';

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
  const validTypes = new Set([
    'engine',
    'brake',
    'tire',
    'accident',
    'door',
    'air_conditioner',
    'gps_device',
    'ticket_scanner',
    'cleanliness',
    'safety_equipment',
    'other',
  ]);
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
  const mapped = legacyMap[String(value || '').trim().toUpperCase()] || normalized;
  return validTypes.has(mapped) ? mapped : 'other';
};

const extractIssueCategory = (description = '') => {
  const match = String(description).match(/Nh[oó]m l[oỗ]i:\s*([A-Z_]+)/i);
  return match?.[1] || '';
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

const severityFromOperationIncident = (severity) => ({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}[String(severity || '').trim().toUpperCase()] || 'medium');

const vehicleIssueStatusToOperationIncidentStatus = (status) => ({
  new: 'OPEN',
  reviewed: 'ACKNOWLEDGED',
  maintenance_required: 'ACKNOWLEDGED',
  no_action_needed: 'RESOLVED',
  resolved: 'RESOLVED',
  dismissed: 'CANCELLED',
}[status] || 'OPEN');

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
  static getTripVehicleLabel(assignment = {}) {
    const vehicle = assignment?.trip?.vehicle || {};
    return vehicle.plateNumber || vehicle.busCode || 'chưa có biển số';
  }

  static async syncPreTripIssuesFromOperationIncidents() {
    const incidents = await OperationIncident.find({
      type: 'VEHICLE_ISSUE',
      driver: { $ne: null },
      vehicle: { $ne: null },
    }).sort({ reportedAt: -1, updatedAt: -1 }).limit(300).lean();

    await Promise.all(incidents.map(async (incident) => {
      const existing = await VehicleIssue.findOne({
        $or: [
          { sourceIncidentId: incident._id },
          {
            tripId: incident.trip || null,
            vehicleId: incident.vehicle,
            reportedBy: incident.driver,
            'emergencyBreakdown.isEmergency': { $ne: true },
          },
        ],
      });

      const description = String(incident.description || '').trim() || 'Driver reported a pre-trip vehicle issue.';
      const issueType = normalizeIssueType(
        incident.issueCategory
        || incident.issueType
        || extractIssueCategory(description)
      );
      const locationText = String(incident.locationText || '').trim();
      const latitude = Number(incident.latitude);
      const longitude = Number(incident.longitude);

      if (existing) {
        if (!existing.sourceIncidentId) {
          existing.sourceIncidentId = incident._id;
          await existing.save();
        }
        return;
      }

      await VehicleIssue.create({
        vehicleId: incident.vehicle,
        tripId: incident.trip || null,
        sourceIncidentId: incident._id,
        reportedBy: incident.driver,
        reportedAt: incident.reportedAt || incident.createdAt || new Date(),
        issueType,
        severity: severityFromOperationIncident(incident.severity),
        description,
        photos: (incident.evidenceFiles || []).map((file) => file.url).filter(Boolean),
        location: {
          text: locationText,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
        },
        status: 'new',
      });
    }));
  }

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

    await this.markVehicleHasIssue(vehicleId);
    issue.maintenanceTaskId = await this.createMaintenanceTask(
      issue,
      { userId },
      'Emergency breakdown reported. Broken vehicle is waiting for maintenance handling.'
    );
    await issue.save();

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

    await this.notifyTripStaffOfVehicleIssue({
      assignment,
      issue,
      title: 'Sự cố xe khẩn cấp trong chuyến',
      message: `Chuyến ${assignment.trip.scheduleCode || tripId} vừa ghi nhận sự cố xe (${this.getTripVehicleLabel(assignment)}). Vui lòng phối hợp với điều hành và chờ hướng dẫn thay xe nếu cần.`,
      sourceType: 'UC48_EMERGENCY_BREAKDOWN_STAFF',
      actorId: userId,
      io,
    });

    io?.to('fleet:operations').emit('server:vehicleIssue:emergencyReported', issue);
    io?.emit('server:vehicleIssue:emergencyReported', issue);
    return issue;
  }

  static async createFromDriverReport({ assignment, inspection, userId, payload = {}, operationIncident = null }) {
    const vehicleId = assignment?.trip?.vehicle?.busId;
    if (!vehicleId) {
      return null;
    }

    const locationText = String(payload.location || payload.locationText || '').trim();
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);

    const issue = await VehicleIssue.findOneAndUpdate(
      { inspectionId: inspection._id },
      {
        $setOnInsert: {
          vehicleId,
          tripId: assignment.trip._id,
          inspectionId: inspection._id,
          sourceIncidentId: operationIncident?._id || null,
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

    await this.markVehicleHasIssue(vehicleId);
    issue.maintenanceTaskId = await this.createMaintenanceTask(
      issue,
      { userId },
      'Pre-trip vehicle issue reported. Broken vehicle is waiting for maintenance handling.'
    );
    await issue.save();

    await this.notifyTripStaffOfVehicleIssue({
      assignment,
      issue,
      title: 'Tài xế báo lỗi xe trước chuyến',
      message: `Chuyến ${assignment.trip.scheduleCode || assignment.trip._id} vừa ghi nhận lỗi xe trước khi xuất bến (${this.getTripVehicleLabel(assignment)}). Vui lòng theo dõi hướng dẫn điều hành và xe thay thế nếu được phân phối.`,
      sourceType: 'UC43_PRE_TRIP_VEHICLE_ISSUE_STAFF',
      actorId: userId,
    });

    return issue;
  }

  static async getIssues(query = {}) {
    await this.syncPreTripIssuesFromOperationIncidents();

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
        { $match: filter },
        {
          $group: {
            _id: null,
            newIssues: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
            criticalIssues: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            maintenanceRequired: {
              $sum: { $cond: [{ $eq: ['$status', 'maintenance_required'] }, 1, 0] },
            },
            preTripIssues: {
              $sum: { $cond: [{ $ne: ['$emergencyBreakdown.isEmergency', true] }, 1, 0] },
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
        preTripIssues: counts[0]?.preTripIssues || 0,
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

    const existingTask = await MaintenanceTask.findOne({
      vehicleIssueId: issue._id,
      status: { $nin: ['approved', 'cancelled'] },
    }).select('_id');
    if (existingTask) {
      return existingTask._id;
    }

    const task = await MaintenanceTask.create({
      vehicleIssueId: issue._id,
      vehicleId: issue.vehicleId,
      tripId: issue.tripId,
      title: `Review ${issue.issueType} issue`,
      description: issue.description,
      priority: issue.severity,
      status: 'assigned',
      createdBy: actor.userId,
      adminNote,
    });

    return task._id;
  }

  static async markVehicleUnderMaintenance(vehicleId) {
    const bus = await FleetBus.findById(vehicleId).select('busCode plateNumber').lean();
    await Promise.all([
      FleetBus.updateOne({ _id: vehicleId }, { $set: { status: 'MAINTENANCE' } }),
      bus ? Vehicle.updateOne(
        { $or: [{ vehicleCode: bus.busCode }, { plateNumber: bus.plateNumber }] },
        { $set: { status: 'maintenance' } }
      ) : null,
    ]);
  }

  static async markVehicleHasIssue(vehicleId) {
    const bus = await FleetBus.findById(vehicleId).select('busCode plateNumber').lean();
    await Promise.all([
      FleetBus.updateOne({ _id: vehicleId }, { $set: { status: 'ISSUE' } }),
      bus ? Vehicle.updateOne(
        { $or: [{ vehicleCode: bus.busCode }, { plateNumber: bus.plateNumber }] },
        { $set: { status: 'idle' } }
      ) : null,
    ]);
  }

  static getAssignmentStaffUserIds(assignment = {}) {
    return [...new Set([
      assignment.driver?.userId || assignment.trip?.driver?.userId,
      assignment.busAssistant?.userId || assignment.assistant?.userId || assignment.trip?.assistant?.userId,
    ].map((id) => String(id || '').trim()).filter(Boolean))];
  }

  static async notifyTripStaffOfVehicleIssue({
    assignment,
    issue,
    title,
    message,
    sourceType,
    actorId,
    io = null,
  }) {
    const tripId = assignment?.trip?._id || issue?.tripId;
    const vehicleId = assignment?.trip?.vehicle?.busId || issue?.vehicleId;
    const routeId = assignment?.trip?.routeId?._id || assignment?.trip?.routeId || null;
    const targetUsers = this.getAssignmentStaffUserIds(assignment);

    if (!tripId || !issue?._id) return;

    await Promise.allSettled([
      createBroadcastNotification({
        title,
        message,
        type: 'maintenance',
        priority: 'urgent',
        targetAudience: 'trip_staff',
        tripId,
        sourceType,
        sourceId: issue._id,
        metadata: {
          issueId: String(issue._id),
          tripId: String(tripId),
          vehicleId: vehicleId ? String(vehicleId) : '',
        },
      }, actorId, io),
      OperationNotification.findOneAndUpdate(
        {
          sourceType,
          sourceId: issue._id,
        },
        {
          $set: {
            title,
            message,
            category: 'EMERGENCY_INSTRUCTION',
            priority: 'CRITICAL',
            targetRoles: ['DRIVER', 'BUS_ASSISTANT'],
            targetUsers,
            route: routeId,
            trip: tripId,
            vehicle: vehicleId,
            activeFrom: new Date(),
            expiresAt: null,
            status: 'ACTIVE',
            createdBy: actorId,
            sourceType,
            sourceId: issue._id,
            metadata: {
              notificationKind: sourceType,
              issueId: issue._id,
              tripCode: assignment?.trip?.scheduleCode || '',
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ),
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

    issue.maintenanceTaskId = await this.createMaintenanceTask(
      issue,
      actor,
      adminNote || 'Replacement vehicle assigned. Broken vehicle is waiting for maintenance handling.'
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
    const serviceDateToken = trip?.serviceDate
      ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(trip.serviceDate))
      : '';
    const passengerTicketTripId = trip ? [
      trip.routeCode,
      serviceDateToken,
      trip.departureTime,
      trip.direction,
    ].filter(Boolean).join('-') : '';
    const tripKeys = [
      issue.tripId ? String(issue.tripId) : '',
      trip?.scheduleCode || '',
      passengerTicketTripId,
    ].filter(Boolean);

    if (!tripKeys.length) return [];

    const operationalTrips = await Trip.find({ scheduleId: issue.tripId }).select('_id').lean();
    const boardingTripIds = [issue.tripId, ...operationalTrips.map((item) => item._id)].filter(Boolean);
    const [tickets, boardingRecords] = await Promise.all([
      PassengerTicket.find({
        tripId: { $in: tripKeys },
        bookingStatus: 'SUCCESS',
        paymentStatus: 'PAID',
        ticketStatus: { $in: ['ACTIVE', 'USED'] },
      }).select('passenger').lean(),
      BoardingRecord.find({
        tripId: { $in: boardingTripIds },
        validationStatus: 'VALIDATED',
        passengerId: { $ne: null },
      }).select('passengerId').lean(),
    ]);

    return [...new Set([
      ...tickets.map((ticket) => String(ticket.passenger || '')),
      ...boardingRecords.map((record) => String(record.passengerId || '')),
    ].filter(Boolean))];
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
    const estimatedDelayMinutes = Number(payload.estimatedDelayMinutes);
    if (!Number.isInteger(estimatedDelayMinutes) || estimatedDelayMinutes < 1 || estimatedDelayMinutes > 1440) {
      throw new CustomError('Estimated delay must be an integer from 1 to 1440 minutes', HTTP_STATUS.BAD_REQUEST);
    }
    const staffNotificationMessage = String(payload.staffNotificationMessage || '').trim();
    const passengerNotificationMessage = String(payload.passengerNotificationMessage || '').trim();
    if (payload.notifyStaff && !staffNotificationMessage) {
      throw new CustomError('Staff notification message is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (payload.notifyPassengers && !passengerNotificationMessage) {
      throw new CustomError('Passenger notification message is required', HTTP_STATUS.BAD_REQUEST);
    }

    const dispatchedVehicleId = await this.assignReplacementVehicle(
      issue,
      payload.standbyVehicleId,
      actor,
      payload.adminNote || 'Standby bus dispatched for emergency breakdown.',
      {
        reason: 'breakdown',
        note: staffNotificationMessage || 'Điều xe dự phòng cho sự cố khẩn cấp.',
        notifyStaff: Boolean(payload.notifyStaff),
        notifyPassengers: false,
        estimatedDelayMinutes,
      },
      io
    );

    await Promise.all([
      Trip.updateMany(
        { scheduleId: issue.tripId, status: { $in: ['scheduled', 'active', 'paused', 'delayed', 'incident'] } },
        { $set: { status: 'delayed', delayMinutes: estimatedDelayMinutes, delayReason: 'Xe hỏng khẩn cấp' } }
      ),
      issue.sourceIncidentId
        ? OperationIncident.updateOne({ _id: issue.sourceIncidentId }, { $set: { estimatedDelayMinutes } })
        : null,
    ].filter(Boolean));

    await propagateIncidentDelay({
      scheduleId: issue.tripId,
      delayMinutes: estimatedDelayMinutes,
      reason: 'Xe hỏng khẩn cấp',
      actorId: actor.userId,
    });

    const passengerIds = await this.resolveTripPassengerIds(issue);
    const standbyVehicle = await FleetBus.findById(dispatchedVehicleId || payload.standbyVehicleId)
      .select('plateNumber busCode')
      .lean();
    const standbyVehicleLabel = standbyVehicle?.plateNumber
      || standbyVehicle?.busCode
      || String(dispatchedVehicleId || payload.standbyVehicleId);
    let notification = null;
    if (payload.notifyPassengers && passengerIds.length) {
      notification = await createBroadcastNotification({
        title: 'Chuyến xe đã đổi xe do sự cố',
        message: `${passengerNotificationMessage}\nXe thay thế: ${standbyVehicleLabel}. Chuyến dự kiến trễ ${estimatedDelayMinutes} phút.`,
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
          standbyVehicleLabel,
          estimatedDelayMinutes,
        },
      }, actor.userId, io);
    }

    issue.emergencyBreakdown.incidentStatus = 'STANDBY_BUS_DISPATCHED';
    issue.emergencyBreakdown.standbyVehicleId = dispatchedVehicleId || payload.standbyVehicleId;
    issue.emergencyBreakdown.assignedDriverId = payload.assignedDriverId || null;
    issue.emergencyBreakdown.dispatchTime = new Date();
    issue.emergencyBreakdown.estimatedDelayMinutes = estimatedDelayMinutes;
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

    if (issue.sourceIncidentId || issue.emergencyBreakdown?.sourceIncidentId) {
      await OperationIncident.updateOne(
        { _id: issue.sourceIncidentId || issue.emergencyBreakdown.sourceIncidentId },
        {
          $set: {
            status: 'RESOLVED',
            canContinue: true,
            requiresReplacementVehicle: false,
          },
        }
      );
    }

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
      maintenanceTaskId = issue.maintenanceTaskId || maintenanceTaskId;
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

    if (issue.sourceIncidentId) {
      await OperationIncident.updateOne(
        { _id: issue.sourceIncidentId, type: 'VEHICLE_ISSUE' },
        { $set: { status: vehicleIssueStatusToOperationIncidentStatus(nextStatus) } }
      );
    }

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
