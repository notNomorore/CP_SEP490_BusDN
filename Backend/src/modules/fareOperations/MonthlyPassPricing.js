import mongoose from 'mongoose';
import { FARE_POLICY_STATUS } from './FareMatrix.js';

export const MONTHLY_PASS_TYPES = ['ROUTE_PASS', 'NETWORK_PASS'];

const MonthlyPassPricingSchema = new mongoose.Schema(
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
    passType: {
      type: String,
      enum: MONTHLY_PASS_TYPES,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    validityDays: {
      type: Number,
      default: 30,
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
  },
  { timestamps: true }
);

MonthlyPassPricingSchema.index({ status: 1, passType: 1, routeId: 1, effectiveFrom: -1 });

export default mongoose.model('MonthlyPassPricing', MonthlyPassPricingSchema);
