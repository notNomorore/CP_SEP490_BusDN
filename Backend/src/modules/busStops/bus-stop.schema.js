import { isInsideDaNang, normalizeText } from './bus-stop.utils.js';

export const validateImportedStop = (stop) => {
  const errors = {};
  const latitude = Number(stop.latitude);
  const longitude = Number(stop.longitude);

  if (!stop.stationName?.trim()) {
    errors.stopName = 'Stop name is required';
  }
  if (!stop.stationCode?.trim()) {
    errors.stopCode = 'Stop code is required';
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Latitude must be a valid number';
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Longitude must be a valid number';
  }
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && !isInsideDaNang(latitude, longitude)) {
    errors.location = 'Stop is outside Da Nang bounds';
  }
  if (stop.city && !['da nang', 'da nẵng'].includes(normalizeText(stop.city))) {
    errors.city = 'Stop is not in Da Nang';
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
    data: {
      ...stop,
      latitude,
      longitude,
      stationCode: stop.stationCode?.trim().toUpperCase(),
      stationName: stop.stationName?.trim(),
      address: stop.address?.trim() || stop.stationName?.trim(),
      city: 'Da Nang',
      isActive: stop.isActive !== false,
    },
  };
};

export const validateListQuery = (query = {}) => ({
  search: query.search?.trim() || '',
  district: query.district?.trim() || '',
  routeId: query.routeId?.trim() || '',
  source: query.source?.trim() || '',
  isActive: query.isActive === undefined ? undefined : query.isActive !== 'false',
});
