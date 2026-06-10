import mongoose from 'mongoose';

const FleetBusSchema = new mongoose.Schema(
  {
    busCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    busType: {
      type: String,
      required: true,
      trim: true,
      default: 'Standard City Bus',
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    operator: {
      type: String,
      trim: true,
      default: 'Veridian Transit',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESERVE', 'MAINTENANCE'],
      default: 'ACTIVE',
    },
    currentLatitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    currentLongitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
    },
    lastTelemetryAt: Date,
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

FleetBusSchema.index({ status: 1, busType: 1 });

export default mongoose.model('FleetBus', FleetBusSchema);
