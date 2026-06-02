import mongoose from 'mongoose';

const VehicleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    capacity: {
      type: Number,
      min: 1,
      default: 40,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE'],
      default: 'AVAILABLE',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'vehicles',
  }
);

export default mongoose.model('Vehicle', VehicleSchema);
