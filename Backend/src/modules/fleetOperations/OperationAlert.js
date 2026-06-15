import mongoose from 'mongoose';

const OperationAlertSchema = new mongoose.Schema(
  {
    targetRole: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    relatedIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IncidentReport',
      default: null,
      index: true,
    },
    relatedTripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

OperationAlertSchema.index({ targetRole: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('OperationAlert', OperationAlertSchema);
