const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const objectIdLikeRegex = /^[a-zA-Z0-9_-]{1,64}$/;
const passwordPolicyRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

export const validateProfileUpdate = (body) => {
  const errors = {};

  if (!body.fullName || body.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  }

  if (!body.email || !emailRegex.test(body.email)) {
    errors.email = 'Valid email is required';
  }

  if (!body.phoneNumber || !phoneRegex.test(body.phoneNumber)) {
    errors.phoneNumber = 'Valid phone number is required';
  }

  if (body.gender && !['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(body.gender)) {
    errors.gender = 'Invalid gender value';
  }

  if (body.dateOfBirth) {
    const date = new Date(body.dateOfBirth);
    if (Number.isNaN(date.getTime())) {
      errors.dateOfBirth = 'Invalid date of birth';
    } else if (date > new Date()) {
      errors.dateOfBirth = 'Date of birth cannot be in the future';
    }
  }

  if (body.address && String(body.address).trim().length > 250) {
    errors.address = 'Address must be less than 250 characters';
  }

  if (body.favoriteRoutes && !Array.isArray(body.favoriteRoutes)) {
    errors.favoriteRoutes = 'Favorite routes must be an array';
  }

  if (Array.isArray(body.favoriteRoutes)) {
    const invalidRoute = body.favoriteRoutes.find((route) => {
      return !route.routeNumber || !route.destination;
    });

    if (invalidRoute) {
      errors.favoriteRoutes = 'Each favorite route must include routeNumber and destination';
    }
  }

  if (body.favoriteStops && !Array.isArray(body.favoriteStops)) {
    errors.favoriteStops = 'Favorite stops must be an array';
  }

  if (Array.isArray(body.favoriteStops)) {
    const invalidStop = body.favoriteStops.find((stop) => !stop.stopName);
    if (invalidStop) {
      errors.favoriteStops = 'Each favorite stop must include stopName';
    }
  }

  if (body.notificationEnabled !== undefined && typeof body.notificationEnabled !== 'boolean') {
    errors.notificationEnabled = 'Notification setting must be a boolean';
  }

  return errors;
};

export const validatePasswordChange = (body) => {
  const errors = {};

  if (!body.currentPassword) {
    errors.currentPassword = 'Current password is required';
  }

  if (!body.newPassword || !passwordPolicyRegex.test(body.newPassword)) {
    errors.newPassword =
      'New password must be at least 8 characters and include uppercase, lowercase, number, and special character';
  }

  if (!body.confirmPassword || body.confirmPassword !== body.newPassword) {
    errors.confirmPassword = 'Password confirmation does not match';
  }

  return errors;
};

export const validateNotificationSettings = (body) => {
  const errors = {};
  const allowedPermissionStatuses = ['DEFAULT', 'GRANTED', 'DENIED', 'UNSUPPORTED'];
  const allowedTypes = [
    'arrivalAlerts',
    'delayAlerts',
    'routeChangeAlerts',
    'tripUpdates',
    'accountUpdates',
  ];

  if (typeof body.notificationEnabled !== 'boolean') {
    errors.notificationEnabled = 'Notification setting must be a boolean';
  }

  if (
    body.permissionStatus !== undefined
    && !allowedPermissionStatuses.includes(body.permissionStatus)
  ) {
    errors.permissionStatus = 'Invalid notification permission status';
  }

  if (body.deviceToken !== undefined && String(body.deviceToken).length > 256) {
    errors.deviceToken = 'Device token must be less than 256 characters';
  }

  if (body.notificationTypes !== undefined) {
    if (!body.notificationTypes || typeof body.notificationTypes !== 'object' || Array.isArray(body.notificationTypes)) {
      errors.notificationTypes = 'Notification types must be an object';
    } else {
      allowedTypes.forEach((type) => {
        if (
          body.notificationTypes[type] !== undefined
          && typeof body.notificationTypes[type] !== 'boolean'
        ) {
          errors[`notificationTypes.${type}`] = `${type} must be a boolean`;
        }
      });
    }
  }

  return errors;
};

export const validateObjectIdParam = (params) => {
  const errors = {};

  if (params?.id && !objectIdLikeRegex.test(params.id)) {
    errors.id = 'Invalid identifier';
  }

  return errors;
};

export default {
  validateProfileUpdate,
  validatePasswordChange,
  validateNotificationSettings,
  validateObjectIdParam,
};
