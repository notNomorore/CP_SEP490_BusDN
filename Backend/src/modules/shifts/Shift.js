import mongoose from 'mongoose';

const ShiftSchema = new mongoose.Schema(
  {
    shiftCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    shiftName: {
      type: String,
      required: true,
      trim: true,
    },
    workDate: {
      type: Date,
      required: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusRoute',
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    breakMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    shiftType: {
      type: String,
      enum: ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FULL_DAY', 'CUSTOM'],
      default: 'CUSTOM',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'SUMMARY_SUBMITTED'],
      default: 'ACTIVE',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ShiftSchema.index({ shiftCode: 1, workDate: 1 }, { unique: true });
ShiftSchema.index({ status: 1, workDate: 1, startTime: 1 });
ShiftSchema.index({ routeId: 1, workDate: 1, startTime: 1 });

export default mongoose.model('Shift', ShiftSchema);
