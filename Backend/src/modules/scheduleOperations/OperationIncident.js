import mongoose from 'mongoose';

const OperationIncidentSchema = new mongoose.Schema(
  {
    incidentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['TRAFFIC_CONGESTION', 'ACCIDENT', 'VEHICLE_BREAKDOWN'],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'],
      default: 'OPEN',
      index: true,
    },
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftAssignment',
      required: true,
      index: true,
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
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    locationText: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    estimatedDelayMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    injuriesReported: {
      type: Boolean,
      default: false,
    },
    policeNotified: {
      type: Boolean,
      default: false,
    },
    canContinue: {
      type: Boolean,
      default: null,
    },
    requiresReplacementVehicle: {
      type: Boolean,
      default: false,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'operationincidents',
  }
);

OperationIncidentSchema.index({ trip: 1, type: 1, status: 1 });
OperationIncidentSchema.index({ driver: 1, reportedAt: -1 });
OperationIncidentSchema.index({ vehicle: 1, status: 1 });

export default mongoose.model('OperationIncident', OperationIncidentSchema);
