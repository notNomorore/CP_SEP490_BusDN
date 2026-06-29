import mongoose from 'mongoose';

const DriverShiftAssignmentSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    checkInTime: Date,
    checkOutTime: Date,
    actualWorkingHours: {
      type: Number,
      min: 0,
      default: 0,
    },
    overtimeHours: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

DriverShiftAssignmentSchema.index({ driverId: 1, workDate: 1, status: 1 });
DriverShiftAssignmentSchema.index({ shiftId: 1, workDate: 1 });

export default mongoose.model('DriverShiftAssignment', DriverShiftAssignmentSchema);
