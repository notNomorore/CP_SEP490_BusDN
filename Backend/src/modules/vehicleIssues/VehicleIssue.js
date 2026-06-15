import mongoose from 'mongoose';

export const VEHICLE_ISSUE_TYPES = [
  'engine',
  'brake',
  'tire',
  'door',
  'air_conditioner',
  'gps_device',
  'ticket_scanner',
  'cleanliness',
  'safety_equipment',
  'other',
];

export const VEHICLE_ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const VEHICLE_ISSUE_STATUSES = [
  'new',
  'reviewed',
  'maintenance_required',
  'no_action_needed',
  'resolved',
  'dismissed',
];

export const VEHICLE_ISSUE_DECISIONS = [
  'mark_reviewed',
  'no_action_needed',
  'create_maintenance_task',
  'mark_vehicle_under_maintenance',
  'assign_replacement_vehicle',
  'resolved',
  'dismissed',
];

const LocationSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, default: '' },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
  },
  { _id: false }
);

const ReviewHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, enum: VEHICLE_ISSUE_STATUSES, default: null },
    toStatus: { type: String, enum: VEHICLE_ISSUE_STATUSES, required: true },
    decision: { type: String, enum: VEHICLE_ISSUE_DECISIONS, required: true },
    adminNote: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedAt: { type: Date, default: Date.now },
    actions: {
      markVehicleUnderMaintenance: { type: Boolean, default: false },
      createMaintenanceTask: { type: Boolean, default: false },
      assignedReplacementVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'FleetBus', default: null },
    },
  },
  { _id: false }
);

const VehicleIssueSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripSchedule',
      default: null,
      index: true,
    },
    inspectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleInspection',
      default: null,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    issueType: {
      type: String,
      enum: VEHICLE_ISSUE_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: VEHICLE_ISSUE_SEVERITIES,
      default: 'medium',
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    location: {
      type: LocationSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: VEHICLE_ISSUE_STATUSES,
      default: 'new',
      index: true,
    },
    decision: {
      type: String,
      enum: VEHICLE_ISSUE_DECISIONS,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    maintenanceTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceTask',
      default: null,
    },
    replacementVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
      default: null,
    },
    reviewHistory: {
      type: [ReviewHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

VehicleIssueSchema.index({ status: 1, severity: 1, reportedAt: -1 });
VehicleIssueSchema.index({ vehicleId: 1, reportedAt: -1 });
VehicleIssueSchema.index({ tripId: 1, reportedAt: -1 });

export default mongoose.model('VehicleIssue', VehicleIssueSchema);
