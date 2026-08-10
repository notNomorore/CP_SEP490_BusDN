import mongoose from 'mongoose';
import {
  LEGACY_NOTIFICATION_TYPES,
  LEGACY_TARGET_AUDIENCES,
  NOTIFICATION_PRIORITIES,
} from './notification.constants.js';

export const NOTIFICATION_TYPES = LEGACY_NOTIFICATION_TYPES;
export { NOTIFICATION_PRIORITIES };
export const NOTIFICATION_TARGET_AUDIENCES = LEGACY_TARGET_AUDIENCES;

export const NOTIFICATION_STATUSES = ['draft', 'scheduled', 'sent', 'cancelled'];

const DeliverySummarySchema = new mongoose.Schema(
  {
    resolvedCount: { type: Number, min: 0, default: 0 },
    sentCount: { type: Number, min: 0, default: 0 },
    failedCount: { type: Number, min: 0, default: 0 },
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    notificationType: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITIES,
      default: 'normal',
      index: true,
    },
    targetAudience: {
      type: String,
      enum: NOTIFICATION_TARGET_AUDIENCES,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    relatedPromotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
      index: true,
    },
    promotionCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    actionUrl: {
      type: String,
      trim: true,
      default: '',
    },
    sourceType: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
    source: {
      module: { type: String, trim: true, default: '' },
      entityId: { type: String, trim: true, default: '' },
    },
    deduplicationKey: {
      type: String,
      trim: true,
      default: '',
    },
    userIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    recipientUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      default: 'draft',
      index: true,
    },
    deliverySummary: {
      type: DeliverySummarySchema,
      default: () => ({}),
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

NotificationSchema.pre('validate', function normalizeNotification(next) {
  this.title = String(this.title || '').trim();
  this.message = String(this.message || '').trim();

  if (this.priority === 'urgent') {
    this.type = this.type || 'emergency';
  }

  if (this.targetAudience !== 'specific_users') {
    this.userIds = [];
  }

  next();
});

NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ targetAudience: 1, createdAt: -1 });
NotificationSchema.index(
  { deduplicationKey: 1 },
  { unique: true, partialFilterExpression: { deduplicationKey: { $type: 'string', $ne: '' } } }
);
NotificationSchema.index(
  { type: 1, relatedPromotionId: 1 },
  { unique: true, partialFilterExpression: { type: 'promotion', relatedPromotionId: { $type: 'objectId' } } }
);

export default mongoose.model('Notification', NotificationSchema);
