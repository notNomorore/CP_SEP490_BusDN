import mongoose from 'mongoose';

const MonthlyPassSchema = new mongoose.Schema(
  {
    passCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    passType: {
      type: String,
      enum: ['STANDARD', 'STUDENT', 'PRIORITY'],
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    passPrice: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['CREDIT_CARD', 'E_WALLET', 'ONLINE_BANKING'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    passStatus: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'PENDING', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    digitalPass: {
      qrPayload: { type: String, trim: true, default: '' },
      issuedAt: Date,
    },
    purchasedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MonthlyPassSchema.index({ passenger: 1, passType: 1, passStatus: 1 });

export default mongoose.models.MonthlyPass
  || mongoose.model('MonthlyPass', MonthlyPassSchema);
