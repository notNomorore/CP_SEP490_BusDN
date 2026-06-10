import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';
import User from '../modules/auth/User.js';

const normalizeRole = (role) => String(role || '').trim().toUpperCase();

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
    const user = await User.findById(decoded.userId).select('email role status accountLock');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status !== 'ACTIVE' || user.accountLock?.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is not allowed to access this resource',
      });
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
