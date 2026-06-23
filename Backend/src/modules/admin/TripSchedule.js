import mongoose from 'mongoose';

const AssignedPersonSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const AssignedVehicleSchema = new mongoose.Schema(
  {
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetBus' },
    busCode: { type: String, trim: true, default: '' },
    plateNumber: { type: String, trim: true, default: '' },
    busType: { type: String, trim: true, default: '' },
    capacity: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const TripLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracyMeters: { type: Number, min: 0, default: null },
    capturedAt: { type: Date, default: null },
  },
  { _id: false }
);

const GpsSyncSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['NOT_REQUESTED', 'SYNCED', 'FAILED'],
      default: 'NOT_REQUESTED',
    },
    retryCount: { type: Number, min: 0, default: 0 },
    message: { type: String, trim: true, default: '' },
    syncedAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
  },
  { _id: false }
);

const DriverAcceptanceSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    respondedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const TripScheduleSchema = new mongoose.Schema(
  {
    scheduleCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    serviceDate: { type: Date, required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusRoute', required: true },
    routeCode: { type: String, trim: true, default: '' },
    routeName: { type: String, trim: true, default: '' },
    direction: { type: String, enum: ['OUTBOUND', 'INBOUND'], default: 'OUTBOUND' },
    departureTime: { type: String, required: true, trim: true },
    expectedArrivalTime: { type: String, trim: true, default: '' },
    turnaroundEndTime: { type: String, trim: true, default: '' },
    shiftLabel: { type: String, trim: true, default: '' },
    isScheduleException: { type: Boolean, default: false },
    exceptionReason: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
    },
    vehicle: { type: AssignedVehicleSchema, default: () => ({}) },
    driver: { type: AssignedPersonSchema, default: () => ({}) },
    assistant: { type: AssignedPersonSchema, default: () => ({}) },
    notes: { type: String, trim: true, default: '' },
    actualStartAt: { type: Date, default: null },
    actualEndAt: { type: Date, default: null },
    startLocation: { type: TripLocationSchema, default: () => ({}) },
    gpsSync: { type: GpsSyncSchema, default: () => ({}) },
    driverAcceptance: { type: DriverAcceptanceSchema, default: () => ({}) },
    emergencyHistory: {
      type: [{
        reason: { type: String, trim: true, default: '' },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        previousVehicle: AssignedVehicleSchema,
        previousDriver: AssignedPersonSchema,
        previousAssistant: AssignedPersonSchema,
      }],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

TripScheduleSchema.index({ serviceDate: 1, routeId: 1, departureTime: 1 });
TripScheduleSchema.index({ 'vehicle.busId': 1, serviceDate: 1, departureTime: 1 });
TripScheduleSchema.index({ 'driver.userId': 1, serviceDate: 1, departureTime: 1 });
TripScheduleSchema.index({ 'assistant.userId': 1, serviceDate: 1, departureTime: 1 });

export default mongoose.model('TripSchedule', TripScheduleSchema);
