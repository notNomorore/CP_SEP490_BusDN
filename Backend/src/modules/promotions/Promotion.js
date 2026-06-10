import mongoose from 'mongoose';

export const PROMOTION_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'];
export const PROMOTION_APPLICABLE_TO = [
  'ALL_ROUTES',
  'SELECTED_ROUTES',
  'MONTHLY_PASS',
  'E_TICKET',
];
export const PROMOTION_STATUS = ['ACTIVE', 'INACTIVE', 'EXPIRED'];

const PromotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discountType: {
      type: String,
      enum: PROMOTION_DISCOUNT_TYPES,
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    minOrderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    applicableTo: {
      type: String,
      enum: PROMOTION_APPLICABLE_TO,
      required: true,
    },
    routeIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Route',
      default: [],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    usagePerUser: {
      type: Number,
      min: 1,
      default: 1,
    },
    usedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: PROMOTION_STATUS,
      default: 'ACTIVE',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PromotionSchema.pre('validate', function normalizePromotion(next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (this.name) {
    this.name = this.name.trim();
  }

  if (this.description) {
    this.description = this.description.trim();
  }

  if (this.applicableTo !== 'SELECTED_ROUTES') {
    this.routeIds = [];
  }

  next();
});

PromotionSchema.methods.isCurrentlyUsable = function isCurrentlyUsable(now = new Date()) {
  return (
    this.status === 'ACTIVE'
    && this.startDate <= now
    && this.endDate >= now
    && (!this.usageLimit || this.usedCount < this.usageLimit)
  );
};

PromotionSchema.index({ status: 1, startDate: 1, endDate: 1 });
PromotionSchema.index({ discountType: 1, createdAt: -1 });
PromotionSchema.index({ applicableTo: 1 });

export default mongoose.model('Promotion', PromotionSchema);
