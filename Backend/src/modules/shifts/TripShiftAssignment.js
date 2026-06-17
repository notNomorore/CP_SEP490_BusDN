import mongoose from 'mongoose';

const TripShiftAssignmentSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripSchedule',
      required: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
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

TripShiftAssignmentSchema.index({ tripId: 1, workDate: 1, status: 1 });
TripShiftAssignmentSchema.index({ shiftId: 1, workDate: 1 });
TripShiftAssignmentSchema.index({ driverId: 1, workDate: 1 });
TripShiftAssignmentSchema.index({ vehicleId: 1, workDate: 1 });

export default mongoose.model('TripShiftAssignment', TripShiftAssignmentSchema);
