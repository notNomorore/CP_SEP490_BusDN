import mongoose from 'mongoose';

const ShiftAuditLogSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: { createdAt: 'changedAt', updatedAt: false } }
);

ShiftAuditLogSchema.index({ entityId: 1, changedAt: -1 });
ShiftAuditLogSchema.index({ action: 1, changedAt: -1 });

export default mongoose.model('ShiftAuditLog', ShiftAuditLogSchema);
