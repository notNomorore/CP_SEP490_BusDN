import mongoose from 'mongoose';

const VehicleInspectionSchema = new mongoose.Schema(
  {
    inspectionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      unique: true,
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
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'READY', 'ISSUE_REPORTED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    checklist: {
      tires: {
        type: Boolean,
        default: false,
      },
      brakes: {
        type: Boolean,
        default: false,
      },
      lights: {
        type: Boolean,
        default: false,
      },
      fuelOrBattery: {
        type: Boolean,
        default: false,
      },
      safetyEquipment: {
        type: Boolean,
        default: false,
      },
      cleanliness: {
        type: Boolean,
        default: false,
      },
    },
    issueCategory: {
      type: String,
      enum: ['ENGINE', 'BRAKE', 'TIRE', 'ELECTRICAL', 'CLEANLINESS', 'OTHER', null],
      default: null,
    },
    issueDescription: {
      type: String,
      trim: true,
      default: '',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    reportedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'vehicleinspections',
  }
);

VehicleInspectionSchema.index({ driver: 1, status: 1 });
VehicleInspectionSchema.index({ vehicle: 1, status: 1 });

export default mongoose.model('VehicleInspection', VehicleInspectionSchema);
