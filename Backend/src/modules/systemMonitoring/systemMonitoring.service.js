import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import AuditLog from './AuditLog.js';
import SuspiciousActivity from './SuspiciousActivity.js';
import { createAuditLog } from './auditLogger.js';
import User from '../auth/User.js';

const LOCK_DURATION_HOURS = {
  '2_HOURS': 2,
  '5_HOURS': 5,
  '10_HOURS': 10,
};

const positiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const dateFilter = (query, field = 'createdAt') => {
  if (!query.startDate && !query.endDate) {
    return {};
  }
  const filter = {};
  if (query.startDate) {
    filter.$gte = new Date(query.startDate);
  }
  if (query.endDate) {
    filter.$lte = endOfDay(query.endDate);
  }
  return { [field]: filter };
};

const auditFilter = (query) => {
  const filter = { ...dateFilter(query) };
  if (query.keyword) {
    const keyword = String(query.keyword).trim();
    filter.$or = [
      { userEmail: { $regex: keyword, $options: 'i' } },
      { action: { $regex: keyword, $options: 'i' } },
      { module: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
      { ipAddress: { $regex: keyword, $options: 'i' } },
    ];
  }
  ['userRole', 'action', 'module', 'status', 'riskLevel'].forEach((field) => {
    if (query[field]) {
      filter[field] = String(query[field]).toUpperCase();
    }
  });
  if (query.userId) {
    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }
  return filter;
};

const suspiciousFilter = (query) => {
  const filter = { ...dateFilter(query, 'detectedAt') };
  ['activityType', 'riskLevel', 'status'].forEach((field) => {
    if (query[field]) {
      filter[field] = query[field];
    }
  });
  if (query.userId) {
    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }
  return filter;
};

const safeUser = (user) => user ? {
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
} : null;

const findSuspiciousUser = async (activity) => {
  const directId = activity?.userId?._id || activity?.userId;
  if (directId) {
    const directUser = await User.findById(directId);
    if (directUser) return directUser;
  }

  const email = String(activity?.userEmail || '').trim().toLowerCase();
  if (email) {
    const emailUser = await User.findOne({ email });
    if (emailUser) return emailUser;
  }

  const relatedLog = await AuditLog.findOne({
    _id: { $in: activity?.relatedLogIds || [] },
    $or: [
      { userId: { $ne: null } },
      { userEmail: { $ne: '' } },
    ],
  }).sort({ createdAt: -1 }).lean();
  if (relatedLog?.userId) return User.findById(relatedLog.userId);
  if (relatedLog?.userEmail) return User.findOne({ email: String(relatedLog.userEmail).toLowerCase() });
  return null;
};

export class SystemMonitoringService {
  static async getAuditLogs(query) {
    const page = positiveInt(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = positiveInt(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = auditFilter(query);
    const [logs, total, counts] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'fullName email role avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([{
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          highRiskCount: {
            $sum: { $cond: [{ $in: ['$riskLevel', ['HIGH', 'CRITICAL']] }, 1, 0] },
          },
        },
      }]),
    ]);

    return {
      items: logs.map((log) => ({
        ...log,
        user: safeUser(log.userId),
        userId: log.userId?._id || log.userId,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        ...(counts[0] || { totalLogs: 0, successCount: 0, failedCount: 0, highRiskCount: 0 }),
      },
    };
  }

  static async getAuditLogDetail(id, actor, req) {
    const log = await AuditLog.findById(id)
      .populate('userId', 'fullName email role avatar')
      .lean();
    if (!log) {
      throw new CustomError('Audit log not found', HTTP_STATUS.NOT_FOUND);
    }
    const relatedSuspiciousActivity = await SuspiciousActivity.find({
      relatedLogIds: log._id,
    }).select('-relatedLogIds').sort({ detectedAt: -1 }).lean();

    await createAuditLog({
      req,
      user: actor,
      action: 'AUDIT_LOG_DETAIL_VIEWED',
      module: 'SYSTEM_MONITORING',
      description: 'Admin viewed an audit log detail.',
      resourceType: 'AuditLog',
      resourceId: log._id,
      riskLevel: 'MEDIUM',
    });

    return {
      ...log,
      user: safeUser(log.userId),
      userId: log.userId?._id || log.userId,
      relatedSuspiciousActivity,
    };
  }

  static async getSuspiciousActivities(query) {
    const page = positiveInt(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = positiveInt(query.limit, PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const filter = suspiciousFilter(query);
    const [items, total, counts] = await Promise.all([
      SuspiciousActivity.find(filter)
        .populate('userId', 'fullName email role avatar')
        .sort({ detectedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SuspiciousActivity.countDocuments(filter),
      SuspiciousActivity.aggregate([{
        $group: {
          _id: null,
          totalSuspiciousActivities: { $sum: 1 },
          openCount: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } },
          investigatingCount: { $sum: { $cond: [{ $eq: ['$status', 'INVESTIGATING'] }, 1, 0] } },
          resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
          criticalCount: { $sum: { $cond: [{ $eq: ['$riskLevel', 'CRITICAL'] }, 1, 0] } },
        },
      }]),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        user: safeUser(item.userId),
        userId: item.userId?._id || item.userId,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        ...(counts[0] || {
          totalSuspiciousActivities: 0,
          openCount: 0,
          investigatingCount: 0,
          resolvedCount: 0,
          criticalCount: 0,
        }),
      },
    };
  }

  static async getSuspiciousDetail(id, actor, req) {
    const activity = await SuspiciousActivity.findById(id)
      .populate('userId', 'fullName email role avatar')
      .populate('reviewedBy', 'fullName email role avatar')
      .populate('relatedLogIds')
      .lean();
    if (!activity) {
      throw new CustomError('Suspicious activity not found', HTTP_STATUS.NOT_FOUND);
    }
    const associatedUser = await findSuspiciousUser(activity);

    await createAuditLog({
      req,
      user: actor,
      action: 'SUSPICIOUS_ACTIVITY_VIEWED',
      module: 'SYSTEM_MONITORING',
      description: 'Admin viewed a suspicious activity case.',
      resourceType: 'SuspiciousActivity',
      resourceId: activity._id,
      riskLevel: 'MEDIUM',
    });

    return {
      ...activity,
      user: safeUser(associatedUser || activity.userId),
      userId: associatedUser?._id || activity.userId?._id || activity.userId,
      canLockAccount: Boolean(associatedUser),
      accountLock: associatedUser?.accountLock || null,
      reviewedBy: safeUser(activity.reviewedBy),
    };
  }

  static async updateSuspiciousStatus(id, payload, actor, req) {
    const activity = await SuspiciousActivity.findById(id);
    if (!activity) {
      throw new CustomError('Suspicious activity not found', HTTP_STATUS.NOT_FOUND);
    }
    const lockDuration = payload.lockDuration || 'NONE';
    let lockedUser = null;
    if (lockDuration !== 'NONE') {
      const targetUser = await findSuspiciousUser(activity);
      if (!targetUser) {
        throw new CustomError('This suspicious activity is not associated with a user account', HTTP_STATUS.UNPROCESSABLE_ENTITY);
      }
      if (String(targetUser._id) === String(actor.userId)) {
        throw new CustomError('Administrators cannot lock their own account', HTTP_STATUS.BAD_REQUEST);
      }
      if (String(targetUser.role).toUpperCase() === 'ADMIN') {
        throw new CustomError('Administrator accounts cannot be locked from suspicious activity review', HTTP_STATUS.FORBIDDEN);
      }

      const hours = LOCK_DURATION_HOURS[lockDuration];
      const lockedUntil = hours ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
      const lockLabel = lockDuration === 'PERMANENT' ? 'vĩnh viễn' : `${hours} giờ`;
      const reason = `Khóa ${lockLabel} do hoạt động đáng ngờ: ${activity.activityType}`;
      targetUser.status = 'LOCKED';
      targetUser.accountLock = { isLocked: true, lockedUntil, reason };
      await targetUser.save();
      lockedUser = { userId: targetUser._id, lockedUntil, lockDuration };
    }

    activity.status = payload.status;
    activity.adminNote = String(payload.adminNote || '').trim();
    if (['RESOLVED', 'DISMISSED'].includes(payload.status)) {
      activity.reviewedBy = actor.userId;
      activity.reviewedAt = new Date();
    } else {
      activity.reviewedBy = null;
      activity.reviewedAt = null;
    }
    await activity.save();

    await createAuditLog({
      req,
      user: actor,
      action: 'SUSPICIOUS_ACTIVITY_STATUS_UPDATED',
      module: 'SYSTEM_MONITORING',
      description: `Suspicious activity status changed to ${payload.status}.`,
      resourceType: 'SuspiciousActivity',
      resourceId: activity._id,
      riskLevel: 'HIGH',
      metadata: { status: payload.status, ...(lockedUser || {}) },
    });

    return this.getSuspiciousDetail(id, actor, req);
  }

  static async getOverview() {
    const [
      totalActivities,
      successfulActivities,
      failedActivities,
      suspiciousActivities,
      criticalActivities,
      activitiesByModule,
      activitiesByRole,
      activitiesByDate,
      recentHighRiskLogs,
      recentSuspiciousActivities,
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ status: 'SUCCESS' }),
      AuditLog.countDocuments({ status: 'FAILED' }),
      SuspiciousActivity.countDocuments(),
      AuditLog.countDocuments({ riskLevel: 'CRITICAL' }),
      AuditLog.aggregate([
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, module: '$_id', count: 1 } },
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$userRole', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, role: { $ifNull: ['$_id', 'UNKNOWN'] }, count: 1 } },
      ]),
      AuditLog.aggregate([
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
      AuditLog.find({ riskLevel: { $in: ['HIGH', 'CRITICAL'] } })
        .sort({ createdAt: -1 }).limit(10).lean(),
      SuspiciousActivity.find().sort({ detectedAt: -1 }).limit(10).lean(),
    ]);

    return {
      totalActivities,
      successfulActivities,
      failedActivities,
      suspiciousActivities,
      criticalActivities,
      activitiesByModule,
      activitiesByRole,
      activitiesByDate,
      recentHighRiskLogs,
      recentSuspiciousActivities,
    };
  }
}

export default SystemMonitoringService;
