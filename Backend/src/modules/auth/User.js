import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const FavoriteRouteSchema = new mongoose.Schema(
  {
    routeId: {
      type: String,
      trim: true,
    },
    routeNumber: {
      type: String,
      trim: true,
      required: true,
    },
    destination: {
      type: String,
      trim: true,
      required: true,
    },
    quickAccessPath: {
      type: String,
      trim: true,
      default: '',
    },
    color: {
      type: String,
      trim: true,
      default: '#2ba471',
    },
    lastBoardedAt: Date,
    savedAt: {
      type: Date,
      default: Date.now,
    },
    favoriteStatus: {
      type: String,
      enum: ['SAVED', 'REMOVED'],
      default: 'SAVED',
    },
  },
  { _id: false }
);

const FavoriteStopSchema = new mongoose.Schema(
  {
    stopId: {
      type: String,
      trim: true,
    },
    routeId: {
      type: String,
      trim: true,
      default: '',
    },
    routeNumber: {
      type: String,
      trim: true,
      default: '',
    },
    stopName: {
      type: String,
      trim: true,
      required: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    nearbyArrivalText: {
      type: String,
      trim: true,
      default: '',
    },
    distanceMeters: {
      type: Number,
      min: 0,
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
    savedAt: {
      type: Date,
      default: Date.now,
    },
    favoriteStatus: {
      type: String,
      enum: ['SAVED', 'REMOVED'],
      default: 'SAVED',
    },
  },
  { _id: false }
);

const ArrivalNotificationSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: String,
      trim: true,
      required: true,
    },
    routeId: {
      type: String,
      trim: true,
      required: true,
    },
    routeNumber: {
      type: String,
      trim: true,
      required: true,
    },
    stopId: {
      type: String,
      trim: true,
      required: true,
    },
    stopName: {
      type: String,
      trim: true,
      required: true,
    },
    busId: {
      type: String,
      trim: true,
      default: '',
    },
    etaThresholdMinutes: {
      type: Number,
      min: 1,
      default: 5,
    },
    notificationStatus: {
      type: String,
      enum: ['ENABLED', 'DISABLED'],
      default: 'ENABLED',
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const DelayNotificationSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: String,
      trim: true,
      required: true,
    },
    routeId: {
      type: String,
      trim: true,
      required: true,
    },
    routeNumber: {
      type: String,
      trim: true,
      required: true,
    },
    busId: {
      type: String,
      trim: true,
      default: '',
    },
    tripId: {
      type: String,
      trim: true,
      default: '',
    },
    delayThresholdMinutes: {
      type: Number,
      min: 1,
      default: 5,
    },
    notificationStatus: {
      type: String,
      enum: ['ENABLED', 'DISABLED'],
      default: 'ENABLED',
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const RouteChangeNotificationSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: String,
      trim: true,
      required: true,
    },
    routeId: {
      type: String,
      trim: true,
      required: true,
    },
    routeNumber: {
      type: String,
      trim: true,
      required: true,
    },
    tripId: {
      type: String,
      trim: true,
      default: '',
    },
    notificationStatus: {
      type: String,
      enum: ['ENABLED', 'DISABLED'],
      default: 'ENABLED',
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const TravelHistorySchema = new mongoose.Schema(
  {
    routeNumber: {
      type: String,
      trim: true,
      required: true,
    },
    tripId: {
      type: String,
      trim: true,
      default: '',
    },
    ticketCode: {
      type: String,
      trim: true,
      default: '',
    },
    ticketType: {
      type: String,
      trim: true,
      default: 'ONE_WAY',
    },
    fromStop: {
      type: String,
      trim: true,
      required: true,
    },
    toStop: {
      type: String,
      trim: true,
      required: true,
    },
    boardedAt: {
      type: Date,
      required: true,
    },
    arrivedAt: Date,
    durationMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    fare: {
      type: Number,
      min: 0,
      default: 0,
    },
    vehicleLabel: {
      type: String,
      trim: true,
      default: '',
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: 'E_WALLET',
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED', 'IN_PROGRESS', 'INTERRUPTED', 'MISSED_TRIP'],
      default: 'COMPLETED',
    },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      default: 'Passenger',
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      alias: 'phone',
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
      default: 'PREFER_NOT_TO_SAY',
    },
    dateOfBirth: Date,
    address: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['PASSENGER', 'DRIVER', 'CONDUCTOR', 'BUS_ASSISTANT', 'ADMIN'],
      default: 'PASSENGER',
    },
    driverLicense: {
      licenseNumber: { type: String, trim: true, default: '' },
      permittedVehicleTypes: { type: [String], default: [] },
      expiresAt: Date,
      status: {
        type: String,
        enum: ['VALID', 'EXPIRED', 'SUSPENDED', 'UNVERIFIED'],
        default: 'UNVERIFIED',
      },
    },
    staffAvailability: {
      leaveRequests: {
        type: [{
          startDate: Date,
          endDate: Date,
          status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'CANCELLED'],
            default: 'PENDING',
          },
          reason: { type: String, trim: true, default: '' },
        }],
        default: [],
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING_ACTIVATION'],
      default: 'ACTIVE',
    },
    favoriteRoutes: {
      type: [FavoriteRouteSchema],
      default: [],
    },
    favoriteStops: {
      type: [FavoriteStopSchema],
      default: [],
    },
    arrivalNotifications: {
      type: [ArrivalNotificationSchema],
      default: [],
    },
    delayNotifications: {
      type: [DelayNotificationSchema],
      default: [],
    },
    routeChangeNotifications: {
      type: [RouteChangeNotificationSchema],
      default: [],
    },
    notificationEnabled: {
      type: Boolean,
      default: true,
    },
    monthlyPassStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING'],
      default: 'INACTIVE',
    },
    monthlyPassExpireDate: Date,
    travelHistory: {
      type: [TravelHistorySchema],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    otp: {
      code: String,
      expiresAt: Date,
    },
    passwordReset: {
      token: String,
      expiresAt: Date,
    },

    // Priority Group (special passenger status)
    isPriorityGroup: {
      type: Boolean,
      default: false,
    },
    priorityStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
      default: 'NONE',
    },
    priorityProfile: {
      profileType: {
        type: String,
        enum: ['STUDENT', 'SENIOR', 'DISABLED', 'PREGNANT', 'CHILD_UNDER_6', 'OTHER'],
      },
      fullName: String,
      dateOfBirth: Date,
      identityNumber: String,
      cardNumber: String,
      issuingAuthority: String,
      reason: String,
      status: {
        type: String,
        enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
        default: 'NONE',
      },
      rejectionReason: String,
      expiryDate: Date,
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      documents: [
        {
          type: {
            type: String,
            enum: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'PRIORITY_PROOF', 'PORTRAIT', 'OTHER'],
            required: true,
          },
          originalName: String,
          fileName: String,
          mimeType: String,
          size: Number,
          url: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    accountLock: {
      isLocked: {
        type: Boolean,
        default: false,
      },
      lockedUntil: Date,
      reason: String,
    },
    lastLoginAt: Date,
    lastLoginIp: String,

    // Staff performance metrics
    staffMetrics: {
      completedTrips: {
        type: Number,
        default: 0,
        min: 0,
      },
      incidents: {
        type: Number,
        default: 0,
        min: 0,
      },
      delayedTrips: {
        type: Number,
        default: 0,
        min: 0,
      },
      onTimeRate: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
      },
      performanceScore: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
      },
      lastActivityAt: Date,
    },
    activityReports: [
      {
        type: {
          type: String,
          enum: ['ACCOUNT_CREATED', 'TRIP_COMPLETED', 'INCIDENT_REPORTED', 'STATUS_UPDATED'],
          default: 'ACCOUNT_CREATED',
        },
        message: {
          type: String,
          trim: true,
        },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Metadata
    preferences: {
      language: {
        type: String,
        default: 'vi',
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcryptjs.genSalt(10);
  this.password = await bcryptjs.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcryptjs.compare(plainPassword, this.password);
};

UserSchema.methods.toPublicJSON = function toPublicJSON() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.otp;
  delete userObject.passwordReset;
  return userObject;
};

UserSchema.index({ createdAt: -1 });
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ monthlyPassStatus: 1 });

export default mongoose.model('User', UserSchema);
