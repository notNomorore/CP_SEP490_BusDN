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
      enum: [
        'TRIP_REJECTION',
        'VEHICLE_ISSUE',
        'TRAFFIC_CONGESTION',
        'ACCIDENT',
        'VEHICLE_BREAKDOWN',
        'PASSENGER_VIOLATION',
        'PASSENGER_CONFLICT',
        'FOUND_ITEM',
      ],
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
      ref: 'TripSchedule',
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftAssignment',
      index: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusRoute',
      required: true,
      index: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FleetBus',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterRole: {
      type: String,
      enum: ['DRIVER', 'BUS_ASSISTANT'],
      default: 'DRIVER',
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
    trafficCategory: {
      type: String,
      enum: [
        'HEAVY_TRAFFIC',
        'ROADWORK',
        'FLOODING',
        'EVENT_CROWD',
        'STOP_OVERLOAD',
        'TEMPORARY_BLOCK',
        'OTHER',
        null,
      ],
      default: null,
      index: true,
    },
    affectedDirection: {
      type: String,
      enum: ['CURRENT_DIRECTION', 'OPPOSITE_DIRECTION', 'BOTH_DIRECTIONS', 'UNKNOWN', null],
      default: null,
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
    passengerConflict: {
      conflictCategory: {
        type: String,
        enum: ['ARGUMENT', 'FARE_DISPUTE', 'SEAT_DISPUTE', 'HARASSMENT', 'SAFETY_RISK', 'OTHER', null],
        default: null,
      },
      partiesInvolved: {
        type: String,
        trim: true,
        default: '',
      },
      actionTaken: {
        type: String,
        trim: true,
        default: '',
      },
    },
    passengerViolation: {
      violationCategory: {
        type: String,
        enum: ['NO_TICKET', 'WRONG_TICKET', 'SMOKING', 'LITTERING', 'UNSAFE_BEHAVIOR', 'DISTURBANCE', 'OTHER', null],
        default: null,
      },
      passengerDescription: {
        type: String,
        trim: true,
        default: '',
      },
      actionTaken: {
        type: String,
        trim: true,
        default: '',
      },
    },
    foundItem: {
      itemName: {
        type: String,
        trim: true,
        default: '',
      },
      itemDescription: {
        type: String,
        trim: true,
        default: '',
      },
      foundLocation: {
        type: String,
        trim: true,
        default: '',
      },
      handedTo: {
        type: String,
        trim: true,
        default: '',
      },
      recoveryStatus: {
        type: String,
        enum: ['REPORTED', 'STORED', 'RETURNED'],
        default: 'REPORTED',
      },
    },
    evidenceFiles: {
      type: [
        {
          originalName: {
            type: String,
            trim: true,
            default: '',
          },
          filename: {
            type: String,
            trim: true,
            default: '',
          },
          url: {
            type: String,
            trim: true,
            default: '',
          },
          mimeType: {
            type: String,
            trim: true,
            default: '',
          },
          size: {
            type: Number,
            default: 0,
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
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
