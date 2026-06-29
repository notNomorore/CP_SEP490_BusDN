import mongoose from 'mongoose';
import { RISK_LEVELS } from './AuditLog.js';

export const SUSPICIOUS_ACTIVITY_TYPES = [
  'FAILED_LOGIN_ATTEMPTS',
  'UNUSUAL_LOCATION',
  'MULTIPLE_PAYMENT_FAILURES',
  'HIGH_VALUE_TRANSACTION',
  'ROLE_CHANGE',
  'SENSITIVE_DATA_ACCESS',
  'OTHER',
];
export const SUSPICIOUS_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'];

const SuspiciousActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userEmail: { type: String, trim: true, lowercase: true, default: '' },
    activityType: { type: String, enum: SUSPICIOUS_ACTIVITY_TYPES, required: true, index: true },
    description: { type: String, required: true, trim: true },
    riskLevel: { type: String, enum: RISK_LEVELS, default: 'HIGH', index: true },
    relatedLogIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AuditLog' }],
    status: { type: String, enum: SUSPICIOUS_STATUSES, default: 'OPEN', index: true },
    detectedAt: { type: Date, default: Date.now, index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    adminNote: { type: String, trim: true, default: '' },
    sourceKey: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);

SuspiciousActivitySchema.index({ status: 1, riskLevel: 1, detectedAt: -1 });
SuspiciousActivitySchema.index({ sourceKey: 1, activityType: 1, status: 1 });

export default mongoose.model('SuspiciousActivity', SuspiciousActivitySchema);
