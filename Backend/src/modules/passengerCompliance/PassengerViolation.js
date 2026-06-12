import mongoose from 'mongoose';

export const VIOLATION_TYPES = [
  'FARE_EVASION',
  'INVALID_TICKET',
  'DISORDERLY_BEHAVIOR',
  'HARASSMENT',
  'PROPERTY_DAMAGE',
  'OTHER',
];
export const VIOLATION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const VIOLATION_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];

const PassengerViolationSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    violationType: {
      type: String,
      enum: VIOLATION_TYPES,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    evidenceUrls: {
      type: [String],
      default: [],
    },
    severity: {
      type: String,
      enum: VIOLATION_SEVERITIES,
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: VIOLATION_STATUSES,
      default: 'PENDING',
      index: true,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

PassengerViolationSchema.index({ reportedAt: -1 });
PassengerViolationSchema.index({ passengerId: 1, reportedAt: -1 });
PassengerViolationSchema.index({ severity: 1, status: 1, reportedAt: -1 });

export default mongoose.model('PassengerViolation', PassengerViolationSchema);
