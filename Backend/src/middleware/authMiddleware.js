import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';
import User from '../modules/auth/User.js';

const normalizeRole = (role) => String(role || '').trim().toUpperCase();
const buildLockedAccountResponse = (user) => {
  const reason = user.accountLock?.reason?.trim() || 'Không có lý do cụ thể';
  const lockedUntil = user.accountLock?.lockedUntil;
  const untilText = lockedUntil
    ? ` Thời hạn khóa đến: ${new Date(lockedUntil).toLocaleString('vi-VN')}.`
    : '';

  return {
    success: false,
    code: 'ACCOUNT_LOCKED',
    message: `Tài khoản đã bị khóa. Lý do: ${reason}.${untilText} Vui lòng liên hệ quản trị viên để được hỗ trợ.`,
    reason,
    lockedUntil: lockedUntil || null,
  };
};

/**
 * JWT Authentication Middleware
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('email role status accountLock').lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.accountLock?.isLocked || user.status === 'LOCKED') {
      const hasExpiry = Boolean(user.accountLock?.lockedUntil);
      const lockExpired = hasExpiry && new Date() >= user.accountLock.lockedUntil;

      if (lockExpired) {
        await User.findByIdAndUpdate(user._id, {
          status: 'ACTIVE',
          accountLock: {
            isLocked: false,
            reason: '',
            lockedUntil: null,
          },
        });
      } else {
        return res.status(423).json(buildLockedAccountResponse(user));
      }
    }

    // Attach user info to request
    req.user = {
      userId: user._id,
      email: user.email || decoded.email,
      role: normalizeRole(user.role || decoded.role),
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
};

/**
 * Role-based Authorization Middleware
 */
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);
    const userRole = normalizeRole(req.user.role);

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Role authorization backed by the latest database state.
 * Use this for staff workflows where an administrator can change roles.
 */
export const authorizeCurrentUserRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const user = await User.findById(req.user.userId).select('email role status');

      if (!user || user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden - Account is unavailable',
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden - Insufficient permissions',
        });
      }

      req.user.email = user.email;
      req.user.role = user.role;
      return next();
    } catch (error) {
      logger.error('Current user role authorization error:', error);
      return next(error);
    }
  };
};

/**
 * Optional Auth Middleware (doesn't fail if no token)
 */
export const optionalAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: normalizeRole(decoded.role),
      };
    }

    next();
  } catch (error) {
    // Continue without user info
    next();
  }
};

export default authMiddleware;
