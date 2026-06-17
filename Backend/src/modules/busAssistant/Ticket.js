import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      trim: true,
      index: true,
    },
    qrCode: {
      type: String,
      trim: true,
      index: true,
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    passengerName: {
      type: String,
      trim: true,
      default: '',
    },
    passengerEmail: {
      type: String,
      trim: true,
      default: '',
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
    fromStopId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    toStopId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ticketType: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'E_TICKET',
      index: true,
    },
    passengerType: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ADULT',
    },
    passengerQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ACTIVE',
      index: true,
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'tickets',
    strict: false,
  }
);

TicketSchema.index({ qrCode: 1, status: 1 });
TicketSchema.index({ ticketCode: 1, status: 1 });

export default mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
