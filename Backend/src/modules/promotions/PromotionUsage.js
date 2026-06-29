import mongoose from 'mongoose';

export const PROMOTION_USAGE_STATUS = ['APPLIED', 'REVERSED', 'FAILED'];

const PromotionUsageSchema = new mongoose.Schema(
  {
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: 'UNKNOWN',
      index: true,
    },
    discountAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    originalAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    finalAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    usedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: PROMOTION_USAGE_STATUS,
      default: 'APPLIED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PromotionUsageSchema.index({ promotionId: 1, usedAt: -1 });
PromotionUsageSchema.index({ promotionId: 1, userId: 1, status: 1 });

export default mongoose.model('PromotionUsage', PromotionUsageSchema);
