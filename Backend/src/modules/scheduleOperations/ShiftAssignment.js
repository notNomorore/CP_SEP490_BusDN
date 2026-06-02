import mongoose from 'mongoose';

const ShiftAssignmentSchema = new mongoose.Schema(
  {
    shiftCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    tripCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    busAssistant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    shiftStatus: {
      type: String,
      enum: ['ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'ASSIGNED',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'shiftassignments',
  }
);

ShiftAssignmentSchema.index({ driver: 1, trip: 1 });
ShiftAssignmentSchema.index({ busAssistant: 1, trip: 1 });

export default mongoose.model('ShiftAssignment', ShiftAssignmentSchema);
