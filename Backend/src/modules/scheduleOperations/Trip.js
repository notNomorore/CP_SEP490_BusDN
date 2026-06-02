import mongoose from 'mongoose';

const TripSchema = new mongoose.Schema(
  {
    tripCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
      index: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    scheduledStart: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'trips',
  }
);

TripSchema.index({ scheduledStart: 1, status: 1 });

export default mongoose.model('Trip', TripSchema);
