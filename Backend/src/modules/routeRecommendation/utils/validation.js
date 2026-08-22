const parseCoordinate = (value) => {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

export const validateRecommendationQuery = (query = {}, defaults = {}) => {
  const fromLat = parseCoordinate(query.fromLat);
  const fromLng = parseCoordinate(query.fromLng);
  const toLat = parseCoordinate(query.toLat);
  const toLng = parseCoordinate(query.toLng);

  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return { valid: false, message: 'fromLat, fromLng, toLat, and toLng are required numeric coordinates' };
  }

  if (fromLat < -90 || fromLat > 90 || toLat < -90 || toLat > 90) {
    return { valid: false, message: 'Latitude must be between -90 and 90' };
  }

  if (fromLng < -180 || fromLng > 180 || toLng < -180 || toLng > 180) {
    return { valid: false, message: 'Longitude must be between -180 and 180' };
  }

  const requestedTransfers = query.maxTransfers === undefined
    ? defaults.MAX_TRANSFERS
    : Number(query.maxTransfers);

  if (!Number.isInteger(requestedTransfers) || requestedTransfers < 0 || requestedTransfers > 3) {
    return { valid: false, message: 'maxTransfers must be an integer between 0 and 3' };
  }

  return {
    valid: true,
    data: {
      origin: { latitude: fromLat, longitude: fromLng },
      destination: { latitude: toLat, longitude: toLng },
      maxTransfers: Math.min(requestedTransfers, defaults.MAX_TRANSFERS ?? requestedTransfers),
      preference: String(query.preference || 'FASTEST').trim().toUpperCase(),
    },
  };
};

export default validateRecommendationQuery;
