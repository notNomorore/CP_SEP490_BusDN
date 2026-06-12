import mongoose from 'mongoose';

const SupportCaseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['COMPLAINT'],
      required: true,
      index: true,
    },
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['SERVICE_QUALITY', 'DELAY', 'DRIVER_BEHAVIOR', 'SAFETY', 'PAYMENT', 'OTHER'],
      default: 'OTHER',
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    routeName: String,
    tripCode: String,
    busPlate: String,
    incidentAt: Date,
    contactPhone: String,
    contactEmail: String,
    responses: [
      {
        message: {
          type: String,
          required: true,
          trim: true,
        },
        responder: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        statusBefore: {
          type: String,
          enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'],
          default: 'OPEN',
        },
        statusAfter: {
          type: String,
          enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'],
          default: 'IN_PROGRESS',
        },
        responseType: {
          type: String,
          enum: ['COMPLAINT_RESPONSE', 'INTERNAL_NOTE'],
          default: 'COMPLAINT_RESPONSE',
        },
        visibleToPassenger: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    closedAt: Date,
  },
  {
    timestamps: true,
  }
);

SupportCaseSchema.index({ createdAt: -1 });
SupportCaseSchema.index({ type: 1, status: 1, createdAt: -1 });

export default mongoose.model('SupportCase', SupportCaseSchema);
