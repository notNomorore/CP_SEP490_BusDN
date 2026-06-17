import mongoose from 'mongoose';

export const MAINTENANCE_TASK_STATUSES = [
  'draft',
  'assigned',
  'in_progress',
  'completed',
  'approved',
  'pending_rework',
  'cancelled',
];

export const MAINTENANCE_APPROVAL_STATUSES = [
  'pending_approval',
  'approved',
  'rejected',
];

const ApprovalHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, enum: MAINTENANCE_APPROVAL_STATUSES, default: null },
    toStatus: { type: String, enum: MAINTENANCE_APPROVAL_STATUSES, required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, default: Date.now },
    approvalNote: { type: String, trim: true, default: '' },
    safetyCheckPassed: { type: Boolean, default: false },
  },
  { _id: false }
);

const MaintenanceTaskSchema = new mongoose.Schema(
  {
    vehicleIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleIssue',
      required: true,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripSchedule',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: MAINTENANCE_TASK_STATUSES,
      default: 'draft',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvalStatus: {
      type: String,
      enum: MAINTENANCE_APPROVAL_STATUSES,
      default: 'pending_approval',
      index: true,
    },
    approvalNote: {
      type: String,
      trim: true,
      default: '',
    },
    safetyCheckPassed: {
      type: Boolean,
      default: false,
    },
    approvalHistory: {
      type: [ApprovalHistorySchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

MaintenanceTaskSchema.index({ vehicleId: 1, status: 1, createdAt: -1 });
MaintenanceTaskSchema.index({ approvalStatus: 1, status: 1, updatedAt: -1 });

export default mongoose.models.MaintenanceTask
  || mongoose.model('MaintenanceTask', MaintenanceTaskSchema);
