import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import FleetBus from '../admin/FleetBus.js';
import Vehicle from '../fleetOperations/Vehicle.js';
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
      },
    };
  }

  static async getIssueById(id, actor) {
    const issue = await VehicleIssue.findById(id)
      .populate('vehicleId')
      .populate('tripId')
      .populate('reportedBy', 'fullName email phoneNumber role')
      .populate('reviewedBy', 'fullName email phoneNumber role')
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
