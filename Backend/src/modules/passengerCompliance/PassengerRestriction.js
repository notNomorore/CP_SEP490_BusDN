import mongoose from 'mongoose';

export const RESTRICTION_TYPES = [
  'WARNING',
  'TEMPORARY_SUSPENSION',
  'ROUTE_BAN',
  'ACCOUNT_SUSPENSION',
];
export const RESTRICTION_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED'];

const PassengerRestrictionSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    violationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PassengerViolation',
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    restrictionType: {
      type: String,
      enum: RESTRICTION_TYPES,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: RESTRICTION_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

PassengerRestrictionSchema.index({ passengerId: 1, status: 1, endDate: -1 });
PassengerRestrictionSchema.index({ violationId: 1, createdAt: -1 });
PassengerRestrictionSchema.index({ status: 1, startDate: 1, endDate: 1 });

export default mongoose.model('PassengerRestriction', PassengerRestrictionSchema);
