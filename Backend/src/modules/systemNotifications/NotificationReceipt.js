import mongoose from 'mongoose';

const NotificationReceiptSchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

NotificationReceiptSchema.index({ notificationId: 1, userId: 1 }, { unique: true });

export default mongoose.model('NotificationReceipt', NotificationReceiptSchema);
