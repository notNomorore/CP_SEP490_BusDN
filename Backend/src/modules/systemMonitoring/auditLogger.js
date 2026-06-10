import AuditLog, { sanitizeValue } from './AuditLog.js';
import { detectSuspiciousActivity } from './suspiciousDetection.service.js';

const getIpAddress = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  return String(forwarded?.split(',')[0] || req?.ip || req?.socket?.remoteAddress || '').trim();
};

export const createAuditLog = async ({
  req,
  user,
  action,
  module,
  description = '',
  resourceType = '',
  resourceId = null,
  status = 'SUCCESS',
  riskLevel = 'LOW',
  metadata = {},
}) => {
  try {
    const log = await AuditLog.create({
      userId: user?._id || user?.userId || null,
      userEmail: user?.email || '',
      userRole: user?.role || '',
      action,
      module,
      description,
      resourceType,
      resourceId,
      ipAddress: getIpAddress(req),
      userAgent: req?.headers?.['user-agent'] || '',
      deviceInfo: req?.headers?.['sec-ch-ua-platform'] || '',
      status,
      riskLevel,
      metadata: sanitizeValue(metadata),
    });
    await detectSuspiciousActivity(log);
    return log;
  } catch {
    return null;
  }
};

export default createAuditLog;
