import mongoose from 'mongoose';

const RouteStationSchema = new mongoose.Schema(
  {
    stationCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    stationName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
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
    isMainStation: {
      type: Boolean,
      default: false,
    },
    city: {
      type: String,
      trim: true,
      default: 'Da Nang',
    },
    zone: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    googlePlaceId: {
      type: String,
      trim: true,
    },
    sourceId: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
      default: '',
    },
    ward: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['MANUAL', 'GOOGLE_MAPS', 'DANABUS', 'ECOBUS', 'PUBLIC_API'],
      default: 'MANUAL',
    },
    routeAssignments: {
      type: [
        {
          routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BusRoute',
          },
          routeCode: {
            type: String,
            trim: true,
            default: '',
          },
          routeName: {
            type: String,
            trim: true,
            default: '',
          },
          direction: {
            type: String,
            enum: ['OUTBOUND', 'INBOUND'],
            default: 'OUTBOUND',
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

RouteStationSchema.index({ stationName: 1 });
RouteStationSchema.index({ latitude: 1, longitude: 1 });
RouteStationSchema.index({ googlePlaceId: 1 }, { unique: true, sparse: true });
RouteStationSchema.index(
  { source: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } }
);
RouteStationSchema.index({ 'routeAssignments.routeId': 1 });

export default mongoose.model('RouteStation', RouteStationSchema);
