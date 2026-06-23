import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema(
  {
    ticketCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true, index: true },
    routeNumber: { type: String, required: true, trim: true },
    tripId: { type: String, required: true, trim: true, index: true },
    departureLocation: { type: String, required: true, trim: true },
    destinationLocation: { type: String, required: true, trim: true },
    seatNumber: { type: String, required: true, trim: true, uppercase: true },
    ticketPrice: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['CREDIT_CARD', 'E_WALLET', 'CASHLESS'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    bookingStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    ticketStatus: {
      type: String,
      enum: ['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    serviceDate: { type: Date, required: true },
    departureTime: { type: String, trim: true, default: '' },
    usedAt: Date,
    cancelledAt: Date,
    purchasedAt: { type: Date, default: Date.now },
    digitalTicket: {
      qrPayload: { type: String, trim: true, default: '' },
      issuedAt: Date,
    },
  },
  { timestamps: true }
);

TicketSchema.index({ routeId: 1, tripId: 1, serviceDate: 1, seatNumber: 1, bookingStatus: 1 });

export default mongoose.models.PassengerTicket
  || mongoose.model('PassengerTicket', TicketSchema);
