import mongoose from 'mongoose';

export const WALKIN_PAYMENT_METHODS = ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'WALLET', 'E_WALLET'];
export const WALKIN_TICKET_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'];

const WalkInTicketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    ticketType: {
      type: String,
      enum: ['WALK_IN'],
      default: 'WALK_IN',
      immutable: true,
    },
    busAssistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    passengerCount: {
      type: Number,
      min: 1,
      default: 1,
    },
    farePerPassenger: {
      type: Number,
      min: 0,
      required: true,
    },
    totalAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    collectedAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: WALKIN_PAYMENT_METHODS,
      default: 'CASH',
      index: true,
    },
    status: {
      type: String,
      enum: WALKIN_TICKET_STATUSES,
      default: 'COMPLETED',
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

WalkInTicketSchema.pre('validate', function calculateAmounts(next) {
  if (this.totalAmount === undefined || this.totalAmount === null) {
    this.totalAmount = this.passengerCount * this.farePerPassenger;
  }
  if (this.collectedAmount === undefined || this.collectedAmount === null) {
    this.collectedAmount = this.totalAmount;
  }
  next();
});

WalkInTicketSchema.index({ issuedAt: -1 });
WalkInTicketSchema.index({ routeId: 1, shiftId: 1, issuedAt: -1 });

export default mongoose.model('WalkInTicket', WalkInTicketSchema);
