import mongoose from 'mongoose';

export const VEHICLE_REASSIGNMENT_REASONS = [
  'breakdown',
  'maintenance_required',
  'accident',
  'gps_device_failure',
  'capacity_issue',
  'manual_reassignment',
  'other',
];

const VehicleReassignmentLogSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    oldVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    newVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: VEHICLE_REASSIGNMENT_REASONS,
      required: true,
      index: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

VehicleReassignmentLogSchema.index({ tripId: 1, changedAt: -1 });

export default mongoose.models.VehicleReassignmentLog
  || mongoose.model('VehicleReassignmentLog', VehicleReassignmentLogSchema);
