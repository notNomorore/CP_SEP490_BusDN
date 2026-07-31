import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    transactionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    walkInTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    busAssistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    ticketType: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'WALK_IN',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'QR', 'E_WALLET'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      min: 0,
      required: true,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    finalAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'COMPLETED',
      index: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'BUS_ASSISTANT',
    },
  },
  {
    timestamps: true,
    collection: 'transactions',
    strict: false,
  }
);

TransactionSchema.index({ busAssistantId: 1, shiftId: 1, status: 1, completedAt: -1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
