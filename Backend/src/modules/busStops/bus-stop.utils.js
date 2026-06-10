export const DA_NANG_BOUNDS = {
  minLat: 15.85,
  maxLat: 16.25,
  minLng: 107.95,
  maxLng: 108.35,
};

export const isInsideDaNang = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= DA_NANG_BOUNDS.minLat
    && latitude <= DA_NANG_BOUNDS.maxLat
    && longitude >= DA_NANG_BOUNDS.minLng
    && longitude <= DA_NANG_BOUNDS.maxLng;
};

export const haversineDistanceMeters = (left, right) => {
  const lat1 = Number(left?.latitude);
  const lng1 = Number(left?.longitude);
  const lat2 = Number(right?.latitude);
  const lng2 = Number(right?.longitude);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

export const normalizeText = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ');

export const areSimilarStopNames = (left = '', right = '') => {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);

  if (!leftText || !rightText) {
    return false;
  }

  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) {
    return true;
  }

  const leftTokens = new Set(leftText.split(' ').filter((token) => token.length > 2));
  const rightTokens = new Set(rightText.split(' ').filter((token) => token.length > 2));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const denominator = Math.max(leftTokens.size, rightTokens.size, 1);

  return shared / denominator >= 0.6;
};

export const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
