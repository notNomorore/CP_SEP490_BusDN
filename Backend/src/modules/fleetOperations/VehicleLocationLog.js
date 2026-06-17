import mongoose from 'mongoose';

const VehicleLocationLogSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
      index: true,
    },
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    speed: {
      type: Number,
      min: 0,
      default: 0,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
      default: 0,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

VehicleLocationLogSchema.index({ vehicleId: 1, recordedAt: -1 });
VehicleLocationLogSchema.index({ tripId: 1, recordedAt: -1 });

export default mongoose.model('VehicleLocationLog', VehicleLocationLogSchema);
