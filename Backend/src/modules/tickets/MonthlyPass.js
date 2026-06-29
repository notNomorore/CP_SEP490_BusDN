import mongoose from 'mongoose';

const ValidationLogSchema = new mongoose.Schema(
  {
    validatedAt: { type: Date, default: Date.now },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    result: { type: String, trim: true, default: '' },
    routeCode: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const MonthlyPassSchema = new mongoose.Schema(
  {
    passCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', index: true },
    routeCode: { type: String, trim: true, default: 'ALL', index: true },
    passType: {
      type: String,
      enum: ['STANDARD', 'STUDENT', 'PRIORITY'],
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    validFrom: { type: Date, index: true },
    validUntil: { type: Date, index: true },
    passPrice: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['', 'CREDIT_CARD', 'E_WALLET', 'ONLINE_BANKING', 'PAYOS'],
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    passStatus: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'PENDING', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    digitalPass: {
      qrPayload: { type: String, trim: true, default: '' },
      qrCodeData: { type: String, trim: true, default: '' },
      qrCodeImage: { type: String, default: '' },
      qrSignature: { type: String, trim: true, default: '' },
      issuedAt: Date,
      expiresAt: Date,
    },
    validationLogs: { type: [ValidationLogSchema], default: [] },
    purchasedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MonthlyPassSchema.index({ passenger: 1, passType: 1, passStatus: 1 });

export default mongoose.models.MonthlyPass
  || mongoose.model('MonthlyPass', MonthlyPassSchema);
