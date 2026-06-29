import mongoose from 'mongoose';

const ValidationLogSchema = new mongoose.Schema(
  {
    validatedAt: { type: Date, default: Date.now },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    result: { type: String, trim: true, default: '' },
    tripId: { type: String, trim: true, default: '' },
    routeCode: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const TicketSchema = new mongoose.Schema(
  {
    ticketCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    ticketType: {
      type: String,
      enum: ['ONE_WAY', 'TRANSFER'],
      default: 'ONE_WAY',
      index: true,
    },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true, index: true },
    routeCode: { type: String, trim: true, default: '', index: true },
    routeNumber: { type: String, required: true, trim: true },
    tripId: { type: String, required: true, trim: true, index: true },
    departureLocation: { type: String, required: true, trim: true },
    destinationLocation: { type: String, required: true, trim: true },
    passengerType: {
      type: String,
      enum: ['STANDARD', 'STUDENT', 'PRIORITY'],
      default: 'STANDARD',
      required: true,
    },
    seatNumber: { type: String, trim: true, uppercase: true, default: '' },
    ticketPrice: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['', 'CREDIT_CARD', 'E_WALLET', 'CASHLESS', 'PAYOS'],
      default: '',
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
      enum: ['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED', 'REFUNDED'],
      default: 'ACTIVE',
      index: true,
    },
    serviceDate: { type: Date, required: true },
    departureTime: { type: String, trim: true, default: '' },
    validFrom: { type: Date, index: true },
    validUntil: { type: Date, index: true },
    expiresAt: { type: Date, index: true },
    usedAt: Date,
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    validatedTripId: { type: String, trim: true, default: '' },
    validationLogs: { type: [ValidationLogSchema], default: [] },
    cancelledAt: Date,
    purchasedAt: { type: Date, default: Date.now },
    digitalTicket: {
      qrPayload: { type: String, trim: true, default: '' },
      qrCodeData: { type: String, trim: true, default: '' },
      qrCodeImage: { type: String, default: '' },
      qrSignature: { type: String, trim: true, default: '' },
      issuedAt: Date,
      expiresAt: Date,
    },
  },
  { timestamps: true }
);

TicketSchema.index({ routeId: 1, tripId: 1, serviceDate: 1, bookingStatus: 1 });

export default mongoose.models.PassengerTicket
  || mongoose.model('PassengerTicket', TicketSchema);
