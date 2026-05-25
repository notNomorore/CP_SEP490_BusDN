import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    // Basic Information
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    fullName: {
      type: String,
      default: 'Hành khách',
      trim: true,
    },
    avatar: {
      type: String,
      default: '/assets/default-avatar.svg',
    },

    // Authentication
    password: {
      type: String,
      required: true,
      select: false, // Don't select password by default
    },

    // Role & Status
    role: {
      type: String,
      enum: ['PASSENGER', 'DRIVER', 'CONDUCTOR', 'STAFF', 'BUS ASSISTANT', 'ADMIN'],
      default: 'PASSENGER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING_ACTIVATION'],
      default: 'ACTIVE',
    },

    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },

    // OTP for email verification
    otp: {
      code: String,
      expiresAt: Date,
    },

    // Password Reset Token
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
      cardImageFront: String,
      cardImageBack: String,
      cardNumber: String,
      status: {
        type: String,
        enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
        default: 'NONE',
      },
      expiryDate: Date,
    },

    // Wallet
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Account Lock
    accountLock: {
      isLocked: {
        type: Boolean,
        default: false,
      },
      lockedUntil: Date,
      reason: String,
    },

    // Last Login
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
  }
);

// Hash password before saving
UserSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
  } catch (error) {
    throw new Error('Error hashing password');
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  try {
    return await bcryptjs.compare(plainPassword, this.password);
  } catch (error) {
    throw new Error('Error comparing password');
  }
};

// Get user public data
UserSchema.methods.toPublicJSON = function toPublicJSON() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.otp;
  delete userObject.passwordReset;
  return userObject;
};

// Indexes
UserSchema.index({ createdAt: -1 });

export default mongoose.model('User', UserSchema);
