import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import FleetBus from '../admin/FleetBus.js';
import Vehicle from '../fleetOperations/Vehicle.js';
import MaintenanceTask from './MaintenanceTask.js';
import VehicleIssue from './VehicleIssue.js';

const OPEN_ISSUE_STATUSES = ['new', 'reviewed', 'maintenance_required'];

const toPositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const safeUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
};

const safeVehicle = (vehicle) => {
  if (!vehicle) return null;
  return {
    _id: vehicle._id,
    busCode: vehicle.busCode || vehicle.vehicleCode || '',
    vehicleCode: vehicle.vehicleCode || vehicle.busCode || '',
    plateNumber: vehicle.plateNumber || '',
    busType: vehicle.busType || '',
    capacity: vehicle.capacity || 0,
    status: vehicle.status || '',
  };
};

const formatIssue = (issue) => {
  if (!issue) return null;
  return {
    _id: issue._id,
    issueType: issue.issueType,
    severity: issue.severity,
    status: issue.status,
    description: issue.description,
    photos: issue.photos || [],
    reportedAt: issue.reportedAt,
    adminNote: issue.adminNote || '',
  };
};

const formatTask = (task) => ({
  ...task,
  vehicle: safeVehicle(task.vehicleId),
  vehicleId: task.vehicleId?._id || task.vehicleId,
  issue: formatIssue(task.vehicleIssueId),
  vehicleIssueId: task.vehicleIssueId?._id || task.vehicleIssueId,
  createdBy: safeUser(task.createdBy),
  approvedBy: safeUser(task.approvedBy),
  approvalHistory: (task.approvalHistory || []).map((entry) => ({
    ...entry,
    approvedBy: safeUser(entry.approvedBy),
  })),
});

const logAudit = async ({ action, actorId, taskId, metadata = {} }) => {
  try {
    const AuditLog = mongoose?.models?.AuditLog;
    if (!AuditLog) return;
    await AuditLog.create({
      action,
      actorId,
      entityType: 'MaintenanceTask',
      entityId: taskId,
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Optional audit logging must not block maintenance approval.
  }
};

export class MaintenanceApprovalService {
  static async getPendingApprovalTasks(query = {}) {
    const page = toPositiveInteger(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = toPositiveInteger(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = {
      status: 'completed',
      approvalStatus: { $ne: 'approved' },
    };

    const [tasks, total] = await Promise.all([
      MaintenanceTask.find(filter)
        .populate('vehicleId')
        .populate('vehicleIssueId')
        .populate('createdBy', 'fullName email role')
        .populate('approvedBy', 'fullName email role')
        .populate('approvalHistory.approvedBy', 'fullName email role')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MaintenanceTask.countDocuments(filter),
    ]);

    const tasksWithChecks = await Promise.all(tasks.map(async (task) => ({
      ...formatTask(task),
      returnToServiceCheck: await this.canVehicleReturnToService(
        task.vehicleId?._id || task.vehicleId,
        { excludeIssueId: task.vehicleIssueId?._id || task.vehicleIssueId }
      ),
    })));

    return {
      tasks: tasksWithChecks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async canVehicleReturnToService(vehicleId, options = {}) {
    const filter = {
      vehicleId,
      severity: 'critical',
      status: { $in: OPEN_ISSUE_STATUSES },
    };

    if (options.excludeIssueId) {
      filter._id = { $ne: options.excludeIssueId };
    }

    const blockingCriticalIssues = await VehicleIssue.find(filter)
      .select('issueType severity status description reportedAt')
      .sort({ reportedAt: -1 })
      .lean();

    return {
      canReturn: blockingCriticalIssues.length === 0,
      blockingCriticalIssues,
    };
  }

  static async approveMaintenanceTask(taskId, adminId, payload = {}, io = null) {
    const task = await MaintenanceTask.findById(taskId);
    if (!task) {
      throw new CustomError('Maintenance task not found', HTTP_STATUS.NOT_FOUND);
    }

    if (task.status !== 'completed') {
      throw new CustomError('Only completed maintenance tasks can be approved', HTTP_STATUS.CONFLICT);
    }

    if (task.approvalStatus === 'approved') {
      throw new CustomError('Maintenance task is already approved', HTTP_STATUS.CONFLICT);
    }

    if (!payload.safetyCheckPassed) {
      throw new CustomError('Safety check must pass before approval', HTTP_STATUS.BAD_REQUEST);
    }

    const returnCheck = await this.canVehicleReturnToService(task.vehicleId, {
      excludeIssueId: task.vehicleIssueId,
    });
    if (!returnCheck.canReturn) {
      throw new CustomError(
        'Unresolved critical issue blocks maintenance approval',
        HTTP_STATUS.CONFLICT,
        { blockingCriticalIssues: returnCheck.blockingCriticalIssues }
      );
    }

    const approvalNote = String(payload.approvalNote || '').trim();
    const previousApprovalStatus = task.approvalStatus;
    const approvedAt = new Date();

    task.status = 'approved';
    task.approvalStatus = 'approved';
    task.approvedBy = adminId;
    task.approvedAt = approvedAt;
    task.approvalNote = approvalNote;
    task.safetyCheckPassed = true;
    task.approvalHistory.push({
      fromStatus: previousApprovalStatus,
      toStatus: 'approved',
      approvedBy: adminId,
      approvedAt,
      approvalNote,
      safetyCheckPassed: true,
    });

    await task.save();

    if (task.vehicleIssueId) {
      await VehicleIssue.updateOne(
        { _id: task.vehicleIssueId },
        {
          $set: {
            status: 'resolved',
            decision: 'resolved',
            reviewedBy: adminId,
            reviewedAt: approvedAt,
            adminNote: approvalNote || 'Resolved after maintenance approval',
          },
          $push: {
            reviewHistory: {
              fromStatus: 'maintenance_required',
              toStatus: 'resolved',
              decision: 'resolved',
              adminNote: approvalNote || 'Resolved after maintenance approval',
              reviewedBy: adminId,
              reviewedAt: approvedAt,
              actions: {
                markVehicleUnderMaintenance: false,
                createMaintenanceTask: false,
                assignedReplacementVehicle: null,
              },
            },
          },
        }
      );
    }

    await Promise.all([
      FleetBus.updateOne({ _id: task.vehicleId }, { $set: { status: 'ACTIVE' } }),
      Vehicle.updateOne({ _id: task.vehicleId }, { $set: { status: 'available' } }),
    ]);

    await logAudit({
      action: 'MAINTENANCE_TASK_APPROVED',
      actorId: adminId,
      taskId: task._id,
      metadata: { vehicleId: task.vehicleId, vehicleIssueId: task.vehicleIssueId },
    });

    const approvedTask = await this.getTaskById(task._id);
    io?.to('fleet:operations').emit('server:maintenance:approvalUpdated', approvedTask);
    io?.emit('server:maintenance:approvalUpdated', approvedTask);
    return approvedTask;
  }

  static async rejectMaintenanceTask(taskId, adminId, payload = {}, io = null) {
    const task = await MaintenanceTask.findById(taskId);
    if (!task) {
      throw new CustomError('Maintenance task not found', HTTP_STATUS.NOT_FOUND);
    }

    if (task.status !== 'completed') {
      throw new CustomError('Only completed maintenance tasks can be rejected', HTTP_STATUS.CONFLICT);
    }

    if (task.approvalStatus === 'approved') {
      throw new CustomError('Maintenance task is already approved', HTTP_STATUS.CONFLICT);
    }

    const approvalNote = String(payload.approvalNote || payload.rejectionReason || '').trim();
    if (!approvalNote) {
      throw new CustomError('Rejection reason is required', HTTP_STATUS.BAD_REQUEST);
    }

    const previousApprovalStatus = task.approvalStatus;
    const rejectedAt = new Date();

    task.status = 'pending_rework';
    task.approvalStatus = 'rejected';
    task.approvedBy = adminId;
    task.approvedAt = rejectedAt;
    task.approvalNote = approvalNote;
    task.safetyCheckPassed = Boolean(payload.safetyCheckPassed);
    task.approvalHistory.push({
      fromStatus: previousApprovalStatus,
      toStatus: 'rejected',
      approvedBy: adminId,
      approvedAt: rejectedAt,
      approvalNote,
      safetyCheckPassed: Boolean(payload.safetyCheckPassed),
    });

    await task.save();

    await Promise.all([
      FleetBus.updateOne({ _id: task.vehicleId }, { $set: { status: 'MAINTENANCE' } }),
      Vehicle.updateOne({ _id: task.vehicleId }, { $set: { status: 'maintenance' } }),
    ]);

    await logAudit({
      action: 'MAINTENANCE_TASK_REJECTED',
      actorId: adminId,
      taskId: task._id,
      metadata: { vehicleId: task.vehicleId, vehicleIssueId: task.vehicleIssueId },
    });

    const rejectedTask = await this.getTaskById(task._id);
    io?.to('fleet:operations').emit('server:maintenance:approvalUpdated', rejectedTask);
    io?.emit('server:maintenance:approvalUpdated', rejectedTask);
    return rejectedTask;
  }

  static async getTaskById(taskId) {
    const task = await MaintenanceTask.findById(taskId)
      .populate('vehicleId')
      .populate('vehicleIssueId')
      .populate('createdBy', 'fullName email role')
      .populate('approvedBy', 'fullName email role')
      .populate('approvalHistory.approvedBy', 'fullName email role')
      .lean();

    if (!task) {
      throw new CustomError('Maintenance task not found', HTTP_STATUS.NOT_FOUND);
    }

    const returnCheck = await this.canVehicleReturnToService(
      task.vehicleId?._id || task.vehicleId,
      { excludeIssueId: task.vehicleIssueId?._id || task.vehicleIssueId }
    );
    return {
      ...formatTask(task),
      returnToServiceCheck: returnCheck,
    };
  }
}

export default MaintenanceApprovalService;
