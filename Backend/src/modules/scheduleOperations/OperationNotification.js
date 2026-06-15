import mongoose from 'mongoose';

const OperationNotificationSchema = new mongoose.Schema(
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
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: ['ROUTE_UPDATE', 'SCHEDULE_CHANGE', 'EMERGENCY_INSTRUCTION', 'GENERAL'],
      default: 'GENERAL',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL',
      index: true,
    },
    targetRoles: {
      type: [String],
      enum: ['DRIVER', 'BUS_ASSISTANT'],
      default: ['DRIVER', 'BUS_ASSISTANT'],
      index: true,
    },
    targetUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusRoute',
      default: null,
      index: true,
    },
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripSchedule',
      default: null,
      index: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
      default: null,
    },
    activeFrom: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    readBy: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          readAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'operationnotifications',
  }
);

OperationNotificationSchema.index({ status: 1, activeFrom: -1, priority: 1 });
OperationNotificationSchema.index({ trip: 1, status: 1, activeFrom: -1 });
OperationNotificationSchema.index({ route: 1, status: 1, activeFrom: -1 });

export default mongoose.model('OperationNotification', OperationNotificationSchema);
