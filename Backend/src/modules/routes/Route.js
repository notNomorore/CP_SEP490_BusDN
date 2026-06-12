import mongoose from 'mongoose';

const StopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
    },
    estimatedOffsetMinutes: {
      type: Number,
      default: 0,
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  { _id: false }
);

const PathPointSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  { _id: false }
);

const RouteSchema = new mongoose.Schema(
  {
    routeNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    origin: {
      type: String,
      required: true,
      trim: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
    },
    stops: {
      type: [StopSchema],
      default: [],
    },
    pathPoints: {
      type: [PathPointSchema],
      default: [],
    },
    distanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedDurationMinutes: {
      type: Number,
      required: true,
      min: 0,
    },
    fare: {
      type: Number,
      required: true,
      min: 0,
    },
    operatingHours: {
      firstDeparture: {
        type: String,
        default: '05:30',
      },
      lastDeparture: {
        type: String,
        default: '21:00',
      },
      frequencyMinutes: {
        type: Number,
        default: 30,
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

RouteSchema.index({
  routeNumber: 'text',
  name: 'text',
  origin: 'text',
  destination: 'text',
  'stops.name': 'text',
});

export default mongoose.model('Route', RouteSchema);
