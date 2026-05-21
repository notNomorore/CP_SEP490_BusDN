// API Response wrapper for consistent response format
import { HTTP_STATUS } from '../constants/index.js';

export class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = 'Success', statusCode = HTTP_STATUS.OK, meta = null) {
    return new ApiResponse(statusCode, message, data, meta);
  }

  static error(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, data = null) {
    return new ApiResponse(statusCode, message, data);
  }

  static created(data, message = 'Resource created successfully') {
    return new ApiResponse(HTTP_STATUS.CREATED, message, data);
  }

  static badRequest(message = 'Invalid request', data = null) {
    return new ApiResponse(HTTP_STATUS.BAD_REQUEST, message, data);
  }

  static unauthorized(message = 'Unauthorized access') {
    return new ApiResponse(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Access forbidden') {
    return new ApiResponse(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiResponse(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message = 'Conflict', data = null) {
    return new ApiResponse(HTTP_STATUS.CONFLICT, message, data);
  }

  static serverError(message = 'Internal server error') {
    return new ApiResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }

  toJSON() {
    const response = {
      success: this.statusCode < 400,
      statusCode: this.statusCode,
      message: this.message,
      timestamp: this.timestamp,
    };

    if (this.data !== null) {
      response.data = this.data;
    }

    if (this.meta) {
      response.meta = this.meta;
    }

    return response;
  }
}

// Middleware to send consistent response
export const responseHandler = (req, res, next) => {
  res.apiResponse = (response) => {
    if (response instanceof ApiResponse) {
      return res.status(response.statusCode).json(response.toJSON());
    }
    return res.status(500).json(new ApiResponse(500, 'Invalid response format').toJSON());
  };

  res.success = (data, message = 'Success', statusCode = HTTP_STATUS.OK) => {
    return res.apiResponse(ApiResponse.success(data, message, statusCode));
  };

  res.created = (data, message = 'Resource created successfully') => {
    return res.apiResponse(ApiResponse.created(data, message));
  };

  res.error = (message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) => {
    return res.apiResponse(ApiResponse.error(message, statusCode));
  };

  res.badRequest = (message = 'Invalid request') => {
    return res.apiResponse(ApiResponse.badRequest(message));
  };

  res.unauthorized = (message = 'Unauthorized access') => {
    return res.apiResponse(ApiResponse.unauthorized(message));
  };

  res.forbidden = (message = 'Access forbidden') => {
    return res.apiResponse(ApiResponse.forbidden(message));
  };

  res.notFound = (message = 'Resource not found') => {
    return res.apiResponse(ApiResponse.notFound(message));
  };

  next();
};

export default ApiResponse;
