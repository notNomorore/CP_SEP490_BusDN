import mongoose from 'mongoose';

export const AUDIT_STATUSES = ['SUCCESS', 'FAILED'];
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const sensitiveKeyPattern = /password|token|secret|authorization|cardNumber|cvv|otp|credential/i;

const sanitizeValue = (value, depth = 0) => {
  if (depth > 5 || value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, item]) => {
      result[key] = sensitiveKeyPattern.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1);
      return result;
    }, {});
  }
  return value;
};

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userEmail: { type: String, trim: true, lowercase: true, default: '' },
    userRole: { type: String, trim: true, uppercase: true, default: '' },
    action: { type: String, required: true, trim: true, uppercase: true, index: true },
    module: { type: String, trim: true, uppercase: true, default: 'SYSTEM', index: true },
    description: { type: String, trim: true, default: '' },
    resourceType: { type: String, trim: true, default: '' },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    ipAddress: { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
    deviceInfo: { type: String, trim: true, default: '' },
    status: { type: String, enum: AUDIT_STATUSES, default: 'SUCCESS', index: true },
    riskLevel: { type: String, enum: RISK_LEVELS, default: 'LOW', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    entityType: { type: String, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.pre('validate', function normalizeLegacyAudit(next) {
  this.userId = this.userId || this.actorId || null;
  this.resourceType = this.resourceType || this.entityType || '';
  this.resourceId = this.resourceId || this.entityId || null;
  this.module = String(
    this.module === 'SYSTEM' && this.entityType
      ? this.entityType
      : this.module || this.entityType || 'SYSTEM'
  ).toUpperCase();
  this.metadata = sanitizeValue(this.metadata || {});
  next();
});

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ ipAddress: 1, action: 1, status: 1, createdAt: -1 });

export { sanitizeValue };
export default mongoose.model('AuditLog', AuditLogSchema);
