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
  },
  { _id: false }
);

const FavoriteStopSchema = new mongoose.Schema(
  {
    stopId: {
      type: String,
      trim: true,
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
      enum: ['COMPLETED', 'CANCELLED', 'IN_PROGRESS'],
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
      enum: ['PASSENGER', 'DRIVER', 'BUS_ASSISTANT', 'BUS ASSISTANT', 'ADMIN'],
      default: 'PASSENGER',
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
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
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
