import mongoose from 'mongoose';
import { FARE_POLICY_STATUS } from './FareMatrix.js';

export const PRIORITY_DISCOUNT_TYPES = ['STUDENT', 'ELDERLY', 'DISABILITY', 'OTHER'];

const PriorityDiscountSchema = new mongoose.Schema(
  {
    priorityType: {
      type: String,
      enum: PRIORITY_DISCOUNT_TYPES,
      required: true,
      index: true,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    status: {
      type: String,
      enum: FARE_POLICY_STATUS,
      default: 'ACTIVE',
      index: true,
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
    requiredApproval: {
      type: Boolean,
      default: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

PriorityDiscountSchema.index({ status: 1, priorityType: 1, effectiveFrom: -1 });

export default mongoose.model('PriorityDiscount', PriorityDiscountSchema);
