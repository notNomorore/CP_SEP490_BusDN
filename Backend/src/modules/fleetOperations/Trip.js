import mongoose from 'mongoose';
import { TRIP_STATUSES } from './fleetOperations.constants.js';

const TripSchema = new mongoose.Schema(
  {
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
      index: true,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripSchedule',
      default: null,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    plannedStartTime: {
      type: Date,
      required: true,
    },
    plannedEndTime: {
      type: Date,
      required: true,
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: TRIP_STATUSES,
      default: 'scheduled',
      index: true,
    },
    progressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    currentStopIndex: {
      type: Number,
      min: 0,
      default: 0,
    },
    nextStopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusStop',
      default: null,
    },
    delayMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    delayReason: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    delayAcknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    delayAcknowledgedAt: {
      type: Date,
      default: null,
    },
    idleSince: {
      type: Date,
      default: null,
    },
    operationNotes: {
      type: [
        {
          note: {
            type: String,
            required: true,
            trim: true,
          },
          reason: {
            type: String,
            trim: true,
            default: '',
          },
          createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    lastGpsAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

TripSchema.index({ routeId: 1, status: 1, plannedStartTime: 1 });
TripSchema.index({ vehicleId: 1, status: 1 });
TripSchema.index({ driverId: 1, status: 1 });

export default mongoose.model('Trip', TripSchema);
