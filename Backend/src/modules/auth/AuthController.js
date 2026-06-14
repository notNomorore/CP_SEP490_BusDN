import jwt from 'jsonwebtoken';
import { config } from '../../config/environment.js';
import AuthService from './AuthService.js';
import {
  RegisterDTO,
  LoginDTO,
  VerifyOtpDTO,
  ResendOtpDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  AuthResponseDTO,
  UserResponseDTO,
} from './dto/auth.dto.js';
import logger from '../../utils/logger.js';

/**
 * Auth Controller
 */
export class AuthController {
  /**
   * POST /auth/register
   * Register new user
   */
  static async register(req, res, next) {
    try {
      const {
        email,
        phone,
        phoneNumber,
        fullName,
        password,
        confirmPassword,
      } = req.body;

      // Validate input
      const validationErrors = RegisterDTO.validate({
        email,
        phone: phoneNumber || phone,
        fullName,
        password,
        confirmPassword,
      });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Register user
      const result = await AuthService.registerUser({
        email,
        phone: phoneNumber || phone,
        fullName,
        password,
      });

      return res.status(201).json({
        success: true,
        message: 'Registration successful. OTP sent to your email/phone.',
        userId: result.userId,
        expiresAt: result.expiresAt,
        ...(config.nodeEnv !== 'production' ? { devOtp: result.otp } : {}),
      });
    } catch (error) {
      logger.error('Registration error:', error);

      if (error.message === 'Email or phone already registered') {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP for registration
   */
  static async verifyOTP(req, res, next) {
    try {
      const { email, phone, phoneNumber, otp } = req.body;

      // Validate input
      const validationErrors = VerifyOtpDTO.validate({
        email,
        phone: phoneNumber || phone,
        otp,
      });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Verify OTP
      const user = await AuthService.verifyOTP(email, phoneNumber || phone, otp);

      // Generate JWT token on successful verification (auto-login)
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: user.role,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expire || '7d' }
      );

      return res.json({
        success: true,
        message: 'Email verified successfully',
        ...AuthResponseDTO.format(user, token),
      });
    } catch (error) {
      logger.error('OTP verification error:', error);

      if (error.message.includes('Invalid OTP') || error.message.includes('expired')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === 'No OTP request found') {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * POST /auth/resend-otp
   * Resend verification OTP for an unverified user
   */
  static async resendOTP(req, res, next) {
    try {
      const { email, phone, phoneNumber } = req.body;

      const validationErrors = ResendOtpDTO.validate({
        email,
        phone: phoneNumber || phone,
      });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const result = await AuthService.resendVerificationOTP(email, phoneNumber || phone);

      return res.json({
        success: true,
        message: 'Verification OTP resent successfully',
        userId: result.userId,
        expiresAt: result.expiresAt,
        ...(config.nodeEnv !== 'production' ? { devOtp: result.otp } : {}),
      });
    } catch (error) {
      logger.error('Resend OTP error:', error);

      if (
        error.message === 'User not found'
        || error.message === 'User already verified'
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * POST /auth/login
   * Login user
   */
  static async login(req, res, next) {
    try {
      const { identifier, password } = req.body;

      // Validate input
      const validationErrors = LoginDTO.validate({ identifier, password });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Login user
      const user = await AuthService.loginUser(identifier, password);

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: user.role,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expire || '7d' }
      );

      return res.json({
        success: true,
        message: 'Login successful',
        ...AuthResponseDTO.format(user, token),
      });
    } catch (error) {
      logger.error('Login error:', error);

      if (
        error.code === 'ACCOUNT_LOCKED'
        || error.message.includes('Invalid email/phone')
        || error.message.includes('not verified')
        || error.message.includes('locked')
      ) {
        return res.status(error.code === 'ACCOUNT_LOCKED' ? 423 : 401).json({
          success: false,
          message: error.message,
          ...(error.code === 'ACCOUNT_LOCKED'
            ? {
              code: error.code,
              reason: error.reason,
              lockedUntil: error.lockedUntil,
            }
            : {}),
        });
      }

      next(error);
    }
  }

  /**
   * POST /auth/forgot-password
   * Request password reset
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email, phone, phoneNumber } = req.body;

      // Validate input
      const validationErrors = ForgotPasswordDTO.validate({
        email,
        phone: phoneNumber || phone,
      });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Request password reset
      const result = await AuthService.requestPasswordReset(email, phoneNumber || phone);

      return res.json({
        success: true,
        message: 'Password reset OTP sent to your email/phone',
        token: result.token,
        expiresAt: result.expiresAt,
        ...(config.nodeEnv !== 'production' ? { devOtp: result.otp } : {}),
      });
    } catch (error) {
      logger.error('Forgot password error:', error);

      if (error.message === 'User not found') {
        // Don't reveal if user exists or not (security)
        return res.json({
          success: true,
          message: 'If account exists, password reset OTP has been sent',
        });
      }

      next(error);
    }
  }

  /**
   * POST /auth/reset-password
   * Reset password with OTP and token
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, otp, newPassword, confirmPassword } = req.body;

      // Validate input
      const validationErrors = ResetPasswordDTO.validate({
        token,
        otp,
        newPassword,
        confirmPassword,
      });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Reset password
      const user = await AuthService.resetPassword(token, otp, newPassword);

      return res.json({
        success: true,
        message: 'Password reset successful',
        user: UserResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Reset password error:', error);

      if (
        error.message.includes('Invalid')
        || error.message.includes('expired')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * POST /auth/change-password
   * Change password (requires authentication)
   */
  static async changePassword(req, res, next) {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Validate input
      const validationErrors = ChangePasswordDTO.validate({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Change password
      const user = await AuthService.changePassword(userId, currentPassword, newPassword);

      return res.json({
        success: true,
        message: 'Password changed successfully',
        user: UserResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Change password error:', error);

      if (
        error.message.includes('incorrect')
        || error.message.includes('not found')
        || error.message.includes('different')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * GET /auth/me
   * Get current user profile
   */
  static async getCurrentUser(req, res, next) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const user = await AuthService.getUserById(userId);

      return res.json({
        success: true,
        user: UserResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      next(error);
    }
  }

  /**
   * POST /auth/logout
   * Logout user
   */
  static async logout(req, res, next) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      await AuthService.logoutUser(userId);

      return res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  /**
   * PUT /auth/profile
   * Update user profile
   */
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const user = await AuthService.updateUserProfile(userId, req.body);

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: UserResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }
}

export default AuthController;
