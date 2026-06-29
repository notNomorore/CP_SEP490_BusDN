import mongoose from 'mongoose';

export const FARE_PRICING_TYPES = ['ROUTE_BASED', 'DISTANCE_BASED', 'DEFAULT'];
export const FARE_POLICY_STATUS = ['ACTIVE', 'INACTIVE'];

const FareMatrixSchema = new mongoose.Schema(
  {
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    routeName: {
      type: String,
      trim: true,
      default: '',
    },
    routeCode: {
      type: String,
      trim: true,
      default: '',
    },
    pricingType: {
      type: String,
      enum: FARE_PRICING_TYPES,
      required: true,
      index: true,
    },
    minDistanceKm: {
      type: Number,
      min: 0,
      default: null,
    },
    maxDistanceKm: {
      type: Number,
      min: 0,
      default: null,
    },
    baseFare: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'VND',
    },
    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: FARE_POLICY_STATUS,
      default: 'ACTIVE',
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

FareMatrixSchema.index({ status: 1, pricingType: 1, routeId: 1, effectiveFrom: -1 });

export default mongoose.model('FareMatrix', FareMatrixSchema);
