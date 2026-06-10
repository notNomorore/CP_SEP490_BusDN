import mongoose from 'mongoose';

export const INCIDENT_TYPES = [
  'ACCIDENT',
  'TRAFFIC_CONGESTION',
  'VEHICLE_BREAKDOWN',
  'PASSENGER_VIOLATION',
  'PASSENGER_CONFLICT',
  'LOST_ITEM',
  'FOUND_ITEM',
  'OTHER',
];

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const INCIDENT_STATUSES = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
export const INCIDENT_REPORTER_ROLES = ['DRIVER', 'BUS_ASSISTANT', 'PASSENGER', 'ADMIN'];

const StatusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: null,
    },
    toStatus: {
      type: String,
      enum: INCIDENT_STATUSES,
      required: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const IncidentReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterRole: {
      type: String,
      enum: INCIDENT_REPORTER_ROLES,
      required: true,
    },
    incidentType: {
      type: String,
      enum: INCIDENT_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
      index: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    severity: {
      type: String,
      enum: INCIDENT_SEVERITIES,
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: 'PENDING',
      index: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    sourceModule: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    sourceType: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

IncidentReportSchema.index({ createdAt: -1 });
IncidentReportSchema.index({ status: 1, severity: 1, createdAt: -1 });
IncidentReportSchema.index({ routeId: 1, createdAt: -1 });
IncidentReportSchema.index(
  { sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceId: { $type: 'objectId' },
    },
  }
);

export default mongoose.model('IncidentReport', IncidentReportSchema);
