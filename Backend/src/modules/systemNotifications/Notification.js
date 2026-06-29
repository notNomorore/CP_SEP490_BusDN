import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'general',
  'route_update',
  'delay_alert',
  'service_interruption',
  'emergency',
  'maintenance',
  'promotion',
];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export const NOTIFICATION_TARGET_AUDIENCES = [
  'all',
  'passengers',
  'drivers',
  'bus_assistants',
  'admins',
  'route_passengers',
  'trip_staff',
  'specific_users',
];

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
      required: true,
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

export default mongoose.model('Notification', NotificationSchema);
