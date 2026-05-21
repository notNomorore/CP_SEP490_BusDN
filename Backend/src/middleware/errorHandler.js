// Global error handling middleware
import { HTTP_STATUS } from '../constants/index.js';
import logger from '../utils/logger.js';

export class CustomError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error handler for express-validator
export const handleValidationErrors = (errors) => {
  const messages = errors.array().map(err => ({
    field: err.param,
    message: err.msg,
    value: err.value,
  }));

  throw new CustomError(
    'Validation failed',
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    messages
  );
};

// MongoDB/Mongoose error handler
export const handleMongooseError = (error) => {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    throw new CustomError(
      'Validation error',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      messages
    );
  }

  if (error.name === 'CastError') {
    throw new CustomError(
      'Invalid ID format',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    throw new CustomError(
      `${field} already exists`,
      HTTP_STATUS.CONFLICT
    );
  }

  throw error;
};

// Global error handler middleware
export const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  // Log error details
  logger.error(`[${req.method}] ${req.originalUrl}`, {
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
  });

  // Handle custom errors
  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      success: false,
      statusCode: error.statusCode,
      message: error.message,
      ...(error.details && { details: error.details }),
      timestamp: new Date().toISOString(),
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'Invalid token',
      timestamp: new Date().toISOString(),
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'Token expired',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle Mongoose errors
  if (error.name === 'MongooseError' || error.name === 'ValidationError') {
    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      success: false,
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      message: 'Database validation error',
      timestamp: new Date().toISOString(),
    });
  }

  // Default error response
  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = error.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  });
};

// 404 Not Found handler
export const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    statusCode: HTTP_STATUS.NOT_FOUND,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
};

// Async wrapper to catch errors in async route handlers
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  CustomError,
  handleValidationErrors,
  handleMongooseError,
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
};
