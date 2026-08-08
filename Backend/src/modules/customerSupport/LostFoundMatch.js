import mongoose from 'mongoose';

const ReturnProcessSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['PICKUP_AT_BUS_STATION', 'HANDOVER_BY_STAFF', 'OTHER', ''],
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    responsibleStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receiverName: {
      type: String,
      trim: true,
      default: '',
    },
    proofReference: {
      type: String,
      trim: true,
      default: '',
    },
    handoverNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const LostFoundMatchSchema = new mongoose.Schema(
  {
    lostItemReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportCase',
      required: true,
      index: true,
    },
    foundItemReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OperationIncident',
      required: true,
      index: true,
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      index: true,
    },
    matchingFactors: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'RETURN_IN_PROGRESS', 'COMPLETED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    returnProcess: {
      type: ReturnProcessSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

LostFoundMatchSchema.index(
  { lostItemReport: 1, foundItemReport: 1 },
  { unique: true }
);
LostFoundMatchSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('LostFoundMatch', LostFoundMatchSchema);
