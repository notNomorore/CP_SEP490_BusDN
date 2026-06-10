import AuditLog from './AuditLog.js';
import SuspiciousActivity from './SuspiciousActivity.js';

const activeStatuses = ['OPEN', 'INVESTIGATING'];

const createIfMissing = async ({ type, log, logs, riskLevel, description, sourceKey }) => {
  const existing = await SuspiciousActivity.findOne({
    activityType: type,
    sourceKey,
    status: { $in: activeStatuses },
  });
  if (existing) {
    existing.relatedLogIds = [...new Set([
      ...existing.relatedLogIds.map(String),
      ...logs.map((item) => String(item._id)),
    ])];
    existing.detectedAt = new Date();
    await existing.save();
    return existing;
  }

  return SuspiciousActivity.create({
    userId: log.userId,
    userEmail: log.userEmail,
    activityType: type,
    description,
    riskLevel,
    relatedLogIds: logs.map((item) => item._id),
    sourceKey,
  });
};

export const detectSuspiciousActivity = async (log) => {
  const now = new Date();
  const sourceKey = String(log.userId || log.userEmail || log.ipAddress || 'unknown');

  if (log.action === 'LOGIN' && log.status === 'FAILED') {
    const logs = await AuditLog.find({
      action: 'LOGIN',
      status: 'FAILED',
      createdAt: { $gte: new Date(now.getTime() - 10 * 60 * 1000) },
      $or: [
        ...(log.userEmail ? [{ userEmail: log.userEmail }] : []),
        ...(log.ipAddress ? [{ ipAddress: log.ipAddress }] : []),
      ],
    }).sort({ createdAt: -1 });
    if (logs.length >= 5) {
      return createIfMissing({
        type: 'FAILED_LOGIN_ATTEMPTS',
        log,
        logs,
        riskLevel: logs.length >= 10 ? 'CRITICAL' : 'HIGH',
        description: `${logs.length} failed login attempts detected within 10 minutes.`,
        sourceKey,
      });
    }
  }

  if (log.module === 'PAYMENT' && log.status === 'FAILED') {
    const logs = await AuditLog.find({
      module: 'PAYMENT',
      status: 'FAILED',
      createdAt: { $gte: new Date(now.getTime() - 15 * 60 * 1000) },
      $or: [
        ...(log.userId ? [{ userId: log.userId }] : []),
        ...(log.userEmail ? [{ userEmail: log.userEmail }] : []),
      ],
    }).sort({ createdAt: -1 });
    if (logs.length > 3) {
      return createIfMissing({
        type: 'MULTIPLE_PAYMENT_FAILURES',
        log,
        logs,
        riskLevel: 'HIGH',
        description: `${logs.length} failed payments detected within 15 minutes.`,
        sourceKey,
      });
    }
  }

  if (/ROLE|PERMISSION/.test(log.action)) {
    return createIfMissing({
      type: 'ROLE_CHANGE',
      log,
      logs: [log],
      riskLevel: 'HIGH',
      description: log.description || 'A user role or permission change was recorded.',
      sourceKey: `${sourceKey}:${log._id}`,
    });
  }

  if (log.riskLevel === 'CRITICAL' || /SENSITIVE|RESTRICTED/.test(log.action)) {
    return createIfMissing({
      type: 'SENSITIVE_DATA_ACCESS',
      log,
      logs: [log],
      riskLevel: log.riskLevel,
      description: log.description || 'Sensitive or restricted system access was recorded.',
      sourceKey: `${sourceKey}:${log._id}`,
    });
  }

  return null;
};

export default detectSuspiciousActivity;
