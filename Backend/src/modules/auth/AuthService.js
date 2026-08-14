import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from './User.js';
import logger from '../../utils/logger.js';
import emailService from '../../utils/emailService.js';
import { config } from '../../config/environment.js';

/**
 * Auth Service - Handles authentication business logic
 */
export class AuthService {
  static googleClient = null;

  static isAllowedAvatarValue(value) {
    if (value === '') return true;
    if (typeof value !== 'string') return false;
    if (/^\/uploads\/avatars\/[^/]+$/i.test(value)) return true;

    const cloudName = config.cloudinary.cloudName;
    if (!cloudName) return false;

    const escapedCloudName = cloudName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^https://res\\.cloudinary\\.com/${escapedCloudName}/`, 'i').test(value);
  }

  static createLockedLoginError(user) {
    const reason = user.accountLock?.reason?.trim() || 'Kh\u00f4ng c\u00f3 l\u00fd do c\u1ee5 th\u1ec3';
    const lockedUntil = user.accountLock?.lockedUntil;
    const untilText = lockedUntil
      ? ` Th\u1eddi h\u1ea1n kh\u00f3a \u0111\u1ebfn: ${new Date(lockedUntil).toLocaleString('vi-VN')}.`
      : '';
    const error = new Error(`T\u00e0i kho\u1ea3n \u0111\u00e3 b\u1ecb kh\u00f3a. L\u00fd do: ${reason}.${untilText} Vui l\u00f2ng li\u00ean h\u1ec7 qu\u1ea3n tr\u1ecb vi\u00ean \u0111\u1ec3 \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3.`);
    error.code = 'ACCOUNT_LOCKED';
    error.reason = reason;
    error.lockedUntil = lockedUntil || null;
    return error;
  }

  static buildIdentifierConditions(email, phone) {
    const conditions = [];

    if (email) {
      conditions.push({ email: email.toLowerCase() });
    }

    if (phone) {
      conditions.push({ phoneNumber: phone });
    }

    return conditions;
  }

  static getGoogleClient() {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(config.googleAuth.clientId);
    }

    return this.googleClient;
  }

  static async verifyGoogleCredential(credential) {
    if (!config.googleAuth.clientId) {
      const error = new Error('Google authentication is not configured');
      error.code = 'GOOGLE_AUTH_NOT_CONFIGURED';
      error.statusCode = 500;
      throw error;
    }

    if (!credential || typeof credential !== 'string') {
      const error = new Error('Google credential is required');
      error.code = 'GOOGLE_CREDENTIAL_REQUIRED';
      error.statusCode = 400;
      throw error;
    }

    try {
      const ticket = await this.getGoogleClient().verifyIdToken({
        idToken: credential,
        audience: config.googleAuth.clientId,
      });
      const payload = ticket.getPayload();
      const issuer = payload?.iss;

      if (!['accounts.google.com', 'https://accounts.google.com'].includes(issuer)) {
        const error = new Error('Invalid Google credential issuer');
        error.code = 'INVALID_GOOGLE_CREDENTIAL';
        error.statusCode = 401;
        throw error;
      }

      if (!payload?.sub || !payload?.email) {
        const error = new Error('Google credential is missing required account information');
        error.code = 'INVALID_GOOGLE_CREDENTIAL';
        error.statusCode = 401;
        throw error;
      }

      if (payload.email_verified !== true) {
        const error = new Error('Google account email is not verified');
        error.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
        error.statusCode = 401;
        throw error;
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        fullName: payload.name?.trim() || payload.email.split('@')[0] || 'Passenger',
        avatar: payload.picture || '',
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }

      const authError = new Error('Invalid Google credential');
      authError.code = 'INVALID_GOOGLE_CREDENTIAL';
      authError.statusCode = 401;
      throw authError;
    }
  }

  static async ensureGooglePassengerCanLogin(user) {
    if (user.role !== 'PASSENGER') {
      const error = new Error('Google login is only available for Passenger accounts');
      error.code = 'UNSUPPORTED_GOOGLE_ROLE';
      error.statusCode = 403;
      throw error;
    }

    if (user.status === 'INACTIVE') {
      const error = new Error('User account is inactive');
      error.statusCode = 401;
      throw error;
    }

    if (user.accountLock?.isLocked || user.status === 'LOCKED') {
      const hasExpiry = Boolean(user.accountLock?.lockedUntil);
      const lockExpired = hasExpiry && new Date() >= user.accountLock.lockedUntil;

      if (lockExpired) {
        user.status = 'ACTIVE';
        user.accountLock = {
          isLocked: false,
          reason: '',
          lockedUntil: null,
        };
        await user.save();
      } else {
        throw this.createLockedLoginError(user);
      }
    }
  }

  /**
   * Generate OTP code
   */
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate password reset token
   */
  static generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Register new user
   */
  static async registerUser(registerData) {
    const { email, phone, phoneNumber, fullName, password } = registerData;
    const normalizedPhone = phoneNumber || phone;
    const identifierConditions = this.buildIdentifierConditions(email, normalizedPhone);

    if (identifierConditions.length === 0) {
      throw new Error('Email or phone is required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: identifierConditions,
    });

    if (existingUser) {
      throw new Error('Email or phone already registered');
    }

    // Generate OTP
    const otp = this.generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new user
    const user = new User({
      email: email?.toLowerCase(),
      phoneNumber: normalizedPhone,
      fullName: fullName.trim(),
      password,
      otp: {
        code: otp,
        expiresAt: otpExpiresAt,
      },
      isVerified: false,
      isFirstLogin: true,
    });

    await user.save();

    // Send verification OTP email
    if (email) {
      try {
        await emailService.sendVerificationOTP(email, otp, fullName.trim());
        logger.info(`Verification OTP email sent to: ${email}`);
      } catch (emailError) {
        logger.warn(`Failed to send verification OTP email to ${email}:`, emailError.message);
        // Don't throw - registration should still succeed even if email fails
      }
    }

    logger.info(`User registered: ${email || normalizedPhone}`);

    return {
      userId: user._id,
      otp, // In production, this should be sent via email/SMS only
      expiresAt: otpExpiresAt,
    };
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(email, phone, otp) {
    const identifierConditions = this.buildIdentifierConditions(email, phone);
    const user = await User.findOne({
      $or: identifierConditions,
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.otp?.code) {
      throw new Error('No OTP request found');
    }

    if (user.otp.code !== otp) {
      throw new Error('Invalid OTP');
    }

    if (new Date() > user.otp.expiresAt) {
      throw new Error('OTP has expired');
    }

    // Mark as verified
    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    // Send welcome email
    if (email) {
      try {
        await emailService.sendWelcomeEmail(email, user.fullName);
        logger.info(`Welcome email sent to: ${email}`);
      } catch (emailError) {
        logger.warn(`Failed to send welcome email to ${email}:`, emailError.message);
        // Don't throw - verification should still succeed even if email fails
      }
    }

    logger.info(`User verified: ${email || phone}`);

    return user;
  }

  /**
   * Resend verification OTP for unverified users
   */
  static async resendVerificationOTP(email, phone) {
    const identifierConditions = this.buildIdentifierConditions(email, phone);
    const user = await User.findOne({
      $or: identifierConditions,
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('User already verified');
    }

    const otp = this.generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = {
      code: otp,
      expiresAt: otpExpiresAt,
    };
    await user.save();

    // Send verification OTP email
    if (email) {
      try {
        await emailService.sendVerificationOTP(email, otp, user.fullName);
        logger.info(`Verification OTP email resent to: ${email}`);
      } catch (emailError) {
        logger.warn(`Failed to resend verification OTP email to ${email}:`, emailError.message);
        // Don't throw - resend should still succeed even if email fails
      }
    }

    logger.info(`Verification OTP resent: ${email || phone}`);

    return {
      userId: user._id,
      otp,
      expiresAt: otpExpiresAt,
    };
  }

  /**
   * Login user
   */
  static async loginUser(identifier, password) {
    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: identifier?.toLowerCase() },
        { phoneNumber: identifier },
      ],
    }).select('+password');

    if (!user) {
      throw new Error('Invalid email/phone or password');
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new Error('User account not verified');
    }

    if (user.status === 'INACTIVE') {
      throw new Error('User account is inactive');
    }

    // Locked accounts must receive a clear lock message with the lock reason.
    if (user.accountLock?.isLocked || user.status === 'LOCKED') {
      const hasExpiry = Boolean(user.accountLock?.lockedUntil);
      const lockExpired = hasExpiry && new Date() >= user.accountLock.lockedUntil;

      if (lockExpired) {
        user.status = 'ACTIVE';
        user.accountLock = {
          isLocked: false,
          reason: '',
          lockedUntil: null,
        };
        await user.save();
      } else {
        throw this.createLockedLoginError(user);
      }
    }

    // Verify password
    if (!user.password) {
      throw new Error('Invalid email/phone or password');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid email/phone or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = process.env.CLIENT_IP || '0.0.0.0';
    await user.save();

    logger.info(`User logged in: ${identifier}`);

    return user;
  }

  /**
   * Login or create a passenger account with a verified Google ID token.
   */
  static async loginWithGoogle(credential) {
    const googleAccount = await this.verifyGoogleCredential(credential);

    let user = await User.findOne({ googleId: googleAccount.googleId });
    let authEvent = 'login';

    if (user) {
      await this.ensureGooglePassengerCanLogin(user);
    } else {
      user = await User.findOne({ email: googleAccount.email });

      if (user) {
        await this.ensureGooglePassengerCanLogin(user);
        user.googleId = googleAccount.googleId;
        user.isVerified = true;
        if (!user.avatar && googleAccount.avatar) {
          user.avatar = googleAccount.avatar;
        }
        authEvent = 'link';
        logger.info(`Google account linked to passenger user: ${user._id}`);
      } else {
        user = new User({
          fullName: googleAccount.fullName,
          email: googleAccount.email,
          avatar: googleAccount.avatar,
          role: 'PASSENGER',
          status: 'ACTIVE',
          isVerified: true,
          isFirstLogin: false,
          googleId: googleAccount.googleId,
        });
        authEvent = 'create';
        logger.info('Passenger account created through Google login');
      }
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = process.env.CLIENT_IP || '0.0.0.0';
    await user.save();

    logger.info(`Google login success for passenger user: ${user._id}`);

    return { user, authEvent };
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email, phone) {
    const identifierConditions = this.buildIdentifierConditions(email, phone);
    const user = await User.findOne({
      $or: identifierConditions,
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate OTP and reset token
    const otp = this.generateOTP();
    const token = this.generateResetToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = {
      code: otp,
      expiresAt,
    };
    user.passwordReset = {
      token,
      expiresAt,
    };

    await user.save();

    // Send password reset OTP email
    if (email) {
      try {
        await emailService.sendPasswordResetOTP(email, otp, user.fullName);
        logger.info(`Password reset OTP email sent to: ${email}`);
      } catch (emailError) {
        logger.warn(`Failed to send password reset OTP email to ${email}:`, emailError.message);
        // Don't throw - password reset should still succeed even if email fails
      }
    }

    logger.info(`Password reset requested for: ${email || phone}`);

    return {
      token,
      otp, // In production, send via email/SMS only
      expiresAt,
    };
  }

  /**
   * Reset password
   */
  static async resetPassword(resetToken, otp, newPassword) {
    const user = await User.findOne({
      'passwordReset.token': resetToken,
    });

    if (!user) {
      throw new Error('Invalid reset token');
    }

    // Check if reset token expired
    if (new Date() > user.passwordReset.expiresAt) {
      throw new Error('Reset token has expired');
    }

    // Verify OTP
    if (user.otp?.code !== otp) {
      throw new Error('Invalid OTP');
    }

    if (new Date() > user.otp.expiresAt) {
      throw new Error('OTP has expired');
    }

    // Update password
    user.password = newPassword;
    user.otp = undefined;
    user.passwordReset = undefined;
    await user.save();

    logger.info(`Password reset for: ${user.email || user.phoneNumber}`);

    return user;
  }

  /**
   * Change password
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      throw new Error('New password must be different from the temporary password');
    }

    // Update password
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    logger.info(`Password changed for user: ${userId}`);

    return user;
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId, updateData) {
    const allowedFields = ['fullName', 'avatar', 'preferences'];
    const updates = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'avatar' && !this.isAllowedAvatarValue(updateData[field])) {
          const error = new Error('Avatar must be uploaded through the profile avatar endpoint');
          error.statusCode = 400;
          throw error;
        }

        updates[field] = updateData[field];
      }
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true });

    if (!user) {
      throw new Error('User not found');
    }

    logger.info(`User profile updated: ${userId}`);

    return user;
  }

  /**
   * Logout (token invalidation handled on client)
   */
  static async logoutUser(userId) {
    logger.info(`User logged out: ${userId}`);
    // Token is stateless, logout is handled on client by removing token
    // In future, can implement token blacklist in Redis
    return { message: 'Logged out successfully' };
  }
}

export default AuthService;
