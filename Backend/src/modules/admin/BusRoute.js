import mongoose from 'mongoose';

const RouteStopSchema = new mongoose.Schema(
  {
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RouteStation',
    },
    stopName: {
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
    stopOrder: {
      type: Number,
      required: true,
      min: 1,
    },
    arrivalOffsetMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    departureOffsetMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    isMainStation: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const StationReferenceSchema = new mongoose.Schema(
  {
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RouteStation',
    },
    stopName: {
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
  },
  { _id: false }
);

const PolylinePointSchema = new mongoose.Schema(
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

const RouteDirectionSchema = new mongoose.Schema(
  {
    startStation: StationReferenceSchema,
    endStation: StationReferenceSchema,
    orderedStops: {
      type: [RouteStopSchema],
      default: [],
    },
    polylinePath: {
      type: [PolylinePointSchema],
      default: [],
    },
    estimatedDistanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const ScheduleArrivalSchema = new mongoose.Schema(
  {
    direction: {
      type: String,
      enum: ['OUTBOUND', 'INBOUND'],
      required: true,
    },
    stopOrder: {
      type: Number,
      required: true,
      min: 1,
    },
    stopName: {
      type: String,
      required: true,
      trim: true,
    },
    arrivalOffsetMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    departureOffsetMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const ScheduleConfigSchema = new mongoose.Schema(
  {
    firstDepartureTime: {
      type: String,
      trim: true,
      default: '',
    },
    lastDepartureTime: {
      type: String,
      trim: true,
      default: '',
    },
    frequencyMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },
    operatingDays: {
      type: [String],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    holidaySchedule: {
      type: String,
      trim: true,
      default: '',
    },
    estimatedArrivalTimes: {
      type: [ScheduleArrivalSchema],
      default: [],
    },
  },
  { _id: false }
);

const FareConfigSchema = new mongoose.Schema(
  {
    baseFare: {
      type: Number,
      default: 0,
      min: 0,
    },
    studentFare: {
      type: Number,
      default: 0,
      min: 0,
    },
    childFare: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyPassFare: {
      type: Number,
      default: 0,
      min: 0,
    },
    luggageFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeRideRules: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const AssignedVehicleSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
    },
    busCode: {
      type: String,
      trim: true,
      default: '',
    },
    plateNumber: {
      type: String,
      trim: true,
      default: '',
    },
    busType: {
      type: String,
      trim: true,
      default: '',
    },
    capacity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const AssignedStaffSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      trim: true,
      default: '',
    },
    shiftLabel: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const BusRouteSchema = new mongoose.Schema(
  {
    routeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    routeName: {
      type: String,
      required: true,
      trim: true,
    },
    routeType: {
      type: String,
      trim: true,
      default: 'URBAN',
    },
    operator: {
      type: String,
      trim: true,
      default: 'Veridian Transit',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUSPENDED'],
      default: 'DRAFT',
    },
    routeColor: {
      type: String,
      trim: true,
      default: '#10b981',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    outboundRoute: {
      type: RouteDirectionSchema,
      default: () => ({}),
    },
    inboundRoute: {
      type: RouteDirectionSchema,
      default: () => ({}),
    },
    scheduleConfig: {
      type: ScheduleConfigSchema,
      default: () => ({}),
    },
    fareConfig: {
      type: FareConfigSchema,
      default: () => ({}),
    },
    vehicleAssignment: {
      busType: {
        type: String,
        trim: true,
        default: '',
      },
      capacity: {
        type: Number,
        default: 0,
        min: 0,
      },
      assignedBuses: {
        type: [AssignedVehicleSchema],
        default: [],
      },
      assignedDrivers: {
        type: [AssignedStaffSchema],
        default: [],
      },
      assistantStaff: {
        type: [AssignedStaffSchema],
        default: [],
      },
      shiftSchedule: {
        type: String,
        trim: true,
        default: '',
      },
    },
    lastPublishedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

BusRouteSchema.index({ routeName: 1, routeCode: 1, status: 1 });

export default mongoose.model('BusRoute', BusRouteSchema);
