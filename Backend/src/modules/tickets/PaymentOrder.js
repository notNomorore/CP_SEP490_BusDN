import mongoose from 'mongoose';

const PaymentOrderSchema = new mongoose.Schema(
  {
    orderCode: { type: Number, required: true, unique: true, index: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticketType: {
      type: String,
      enum: ['ONE_WAY', 'MONTHLY_PASS'],
      required: true,
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: { type: String, trim: true, default: 'PAYOS' },
    payos: {
      paymentLinkId: { type: String, trim: true, default: '' },
      checkoutUrl: { type: String, trim: true, default: '' },
      qrCode: { type: String, trim: true, default: '' },
      rawStatus: { type: String, trim: true, default: '' },
      rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'PassengerTicket' },
    monthlyPassId: { type: mongoose.Schema.Types.ObjectId, ref: 'MonthlyPass' },
    paidAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

PaymentOrderSchema.index({ passenger: 1, status: 1, createdAt: -1 });

export default mongoose.models.PaymentOrder
  || mongoose.model('PaymentOrder', PaymentOrderSchema);
