const MAX_TEXT_LENGTH = 120;
const MAX_ROUTE_ID_LENGTH = 64;
const ALLOWED_PREFERENCES = ['fastest', 'shortest', 'lowest-cost', 'least-traffic'];

const isPlainString = (value) => value === undefined || typeof value === 'string';

const hasControlCharacters = (value) => (
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  })
);

const validateOptionalText = (errors, payload, field) => {
  const value = payload[field];

  if (!isPlainString(value)) {
    errors[field] = `${field} must be a string`;
    return;
  }

  if (value && value.length > MAX_TEXT_LENGTH) {
    errors[field] = `${field} must not exceed ${MAX_TEXT_LENGTH} characters`;
    return;
  }

  if (value && hasControlCharacters(value)) {
    errors[field] = `${field} contains invalid characters`;
  }
};

const validateRequiredText = (errors, payload, field) => {
  validateOptionalText(errors, payload, field);

  if (!errors[field] && !String(payload[field] || '').trim()) {
    errors[field] = `${field} is required`;
  }
};

export const validateRouteSearchQuery = (query = {}) => {
  const errors = {};

  ['q', 'from', 'to'].forEach((field) => validateOptionalText(errors, query, field));

  return errors;
};

export const validateRouteSuggestionsQuery = (query = {}) => {
  const errors = {};

  validateRequiredText(errors, query, 'from');
  validateRequiredText(errors, query, 'to');
  validateOptionalText(errors, query, 'preference');

  if (!errors.preference && query.preference && !ALLOWED_PREFERENCES.includes(query.preference)) {
    errors.preference = `preference must be one of: ${ALLOWED_PREFERENCES.join(', ')}`;
  }

  return errors;
};

export const validateNearbyRoutesQuery = (query = {}) => {
  const errors = {};
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);

  if (query.latitude === undefined || query.latitude === '') {
    errors.latitude = 'latitude is required';
  } else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'latitude must be between -90 and 90';
  }

  if (query.longitude === undefined || query.longitude === '') {
    errors.longitude = 'longitude is required';
  } else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'longitude must be between -180 and 180';
  }

  if (query.radiusKm !== undefined && query.radiusKm !== '') {
    const radiusKm = Number(query.radiusKm);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
      errors.radiusKm = 'radiusKm must be greater than 0 and at most 50';
    }
  }

  return errors;
};

export const validateRouteIdParam = (params = {}) => {
  const errors = {};
  const routeId = String(params.routeId || '').trim();

  if (!routeId) {
    errors.routeId = 'routeId is required';
  } else if (routeId.length > MAX_ROUTE_ID_LENGTH) {
    errors.routeId = `routeId must not exceed ${MAX_ROUTE_ID_LENGTH} characters`;
  } else if (!/^[A-Za-z0-9_-]+$/.test(routeId)) {
    errors.routeId = 'routeId contains invalid characters';
  }

  return errors;
};

export default {
  validateRouteSearchQuery,
  validateRouteSuggestionsQuery,
  validateNearbyRoutesQuery,
  validateRouteIdParam,
};
