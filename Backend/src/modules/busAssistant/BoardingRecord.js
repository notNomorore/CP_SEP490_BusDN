import mongoose from 'mongoose';

const BoardingRecordSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    ticketCode: {
      type: String,
      trim: true,
      default: '',
    },
    qrCode: {
      type: String,
      trim: true,
      default: '',
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    validationStatus: {
      type: String,
      enum: ['VALIDATED', 'REJECTED'],
      default: 'VALIDATED',
      index: true,
    },
    boardedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

BoardingRecordSchema.index({ busAssistantId: 1, shiftId: 1, boardedAt: -1 });

export default mongoose.models.BoardingRecord || mongoose.model('BoardingRecord', BoardingRecordSchema);
