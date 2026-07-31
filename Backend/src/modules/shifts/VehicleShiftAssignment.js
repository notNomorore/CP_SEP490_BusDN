import mongoose from 'mongoose';

const VehicleShiftAssignmentSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
      required: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    workDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'ASSIGNED',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

VehicleShiftAssignmentSchema.index({ vehicleId: 1, workDate: 1, status: 1 });
VehicleShiftAssignmentSchema.index({ shiftId: 1, workDate: 1 });

export default mongoose.model('VehicleShiftAssignment', VehicleShiftAssignmentSchema);
