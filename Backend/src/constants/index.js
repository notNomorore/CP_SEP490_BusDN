// Backend constants and enums

export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
};

export const USER_ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  CUSTOMER: 'customer',
};

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
};

export const TICKET_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
};

export const PAYMENT_METHOD = {
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  E_WALLET: 'e_wallet',
  BANK_TRANSFER: 'bank_transfer',
  CASH: 'cash',
  WALLET: 'wallet',
};

export const ROUTE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
};

export const SCHEDULE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const TRIP_STATUS = {
  SCHEDULED: 'scheduled',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELAYED: 'delayed',
};

export const PRIORITY_LEVELS = {
  STUDENT: 'student',
  SENIOR: 'senior',
  DISABLED: 'disabled',
  PREGNANT: 'pregnant',
  CHILD_UNDER_3: 'child_under_3',
};

export const NOTIFICATION_TYPE = {
  BOOKING_CONFIRMATION: 'booking_confirmation',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  TICKET_REMINDER: 'ticket_reminder',
  TRACKING_UPDATE: 'tracking_update',
  PROMOTION: 'promotion',
  SYSTEM: 'system',
};

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already exists',
  INVALID_TOKEN: 'Invalid or expired token',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  INVALID_INPUT: 'Invalid input data',
  DATABASE_ERROR: 'Database error',
  INTERNAL_ERROR: 'Internal server error',
};

export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  BOOKING_SUCCESS: 'Booking successful',
  PAYMENT_SUCCESS: 'Payment successful',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE: 'YYYY-MM-DD',
  TIME: 'HH:mm:ss',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
};

export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECTION_ERROR: 'connect_error',

  // Tracking
  TRACKING_UPDATE: 'tracking:update',
  TRACKING_SUBSCRIBE: 'tracking:subscribe',
  TRACKING_UNSUBSCRIBE: 'tracking:unsubscribe',

  // Notifications
  NOTIFICATION_SEND: 'notification:send',
  NOTIFICATION_RECEIVED: 'notification:received',

  // Admin
  ADMIN_BROADCAST: 'admin:broadcast',
};

export const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
export const TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
export const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

export default {
  HTTP_STATUS,
  USER_ROLES,
  USER_STATUS,
  TICKET_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  ROUTE_STATUS,
  SCHEDULE_STATUS,
  TRIP_STATUS,
  PRIORITY_LEVELS,
  NOTIFICATION_TYPE,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PAGINATION,
  DATE_FORMATS,
  SOCKET_EVENTS,
  SESSION_TIMEOUT,
  TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};
