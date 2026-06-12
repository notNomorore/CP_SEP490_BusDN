import mongoose from 'mongoose';

const BusStopSyncLogSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['DANABUS', 'ECOBUS', 'PUBLIC_API', 'MANUAL'],
      default: 'PUBLIC_API',
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'],
      required: true,
    },
    totalFetched: {
      type: Number,
      default: 0,
      min: 0,
    },
    created: {
      type: Number,
      default: 0,
      min: 0,
    },
    updated: {
      type: Number,
      default: 0,
      min: 0,
    },
    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },
    errors: {
      type: [
        {
          index: Number,
          sourceId: String,
          stopCode: String,
          message: String,
        },
      ],
      default: [],
    },
    startedAt: {
      type: Date,
      required: true,
    },
    finishedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

BusStopSyncLogSchema.index({ createdAt: -1 });
BusStopSyncLogSchema.index({ source: 1, status: 1 });

export default mongoose.model('BusStopSyncLog', BusStopSyncLogSchema);
