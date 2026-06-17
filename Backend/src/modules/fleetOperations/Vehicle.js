import mongoose from 'mongoose';
import { VEHICLE_STATUSES } from './fleetOperations.constants.js';

const CurrentLocationSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    lng: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
      default: null,
    },
    speed: {
      type: Number,
      min: 0,
      default: 0,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const VehicleSchema = new mongoose.Schema(
  {
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    vehicleCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: VEHICLE_STATUSES,
      default: 'available',
      index: true,
    },
    currentLocation: {
      type: CurrentLocationSchema,
      default: () => ({}),
    },
    assignedRouteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

VehicleSchema.index({ status: 1, assignedRouteId: 1 });

export default mongoose.model('Vehicle', VehicleSchema);
