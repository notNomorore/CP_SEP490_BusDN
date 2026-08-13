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
      ref: 'Route',
    },
    rosterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roster', default: null },
    isLocked: { type: Boolean, default: false },
    assignmentSource: { type: String, enum: ['AUTO', 'MANUAL'], default: 'MANUAL' },
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
      enum: ['MORNING', 'MIDDAY', 'AFTERNOON'],
      default: 'MORNING',
    },
    plannedStartDateTime: {
      type: Date,
      default: null,
    },
    plannedEndDateTime: {
      type: Date,
      default: null,
    },
    actualStartDateTime: {
      type: Date,
      default: null,
    },
    actualEndDateTime: {
      type: Date,
      default: null,
    },
    requiresAssistant: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED'],
      default: 'DRAFT',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'ACTIVE', 'INACTIVE', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'CANCELLED', 'ARCHIVED', 'SUMMARY_SUBMITTED'],
      default: 'DRAFT',
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
ShiftSchema.index({ rosterId: 1, workDate: 1, shiftType: 1 });
ShiftSchema.index({ plannedStartDateTime: 1, plannedEndDateTime: 1, status: 1 });

export default mongoose.model('Shift', ShiftSchema);
