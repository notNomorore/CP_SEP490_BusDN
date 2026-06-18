import mongoose from 'mongoose';

const RevenueSummarySchema = new mongoose.Schema(
  {
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    busAssistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    systemAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    actualCollectedAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    differenceAmount: {
      type: Number,
      required: true,
    },
    reconciliationStatus: {
      type: String,
      enum: ['MATCHED', 'DISCREPANCY'],
      required: true,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    attachmentUrls: {
      type: [String],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

RevenueSummarySchema.index({ shiftId: 1, busAssistantId: 1 }, { unique: true });

export default mongoose.models.RevenueSummary || mongoose.model('RevenueSummary', RevenueSummarySchema);
