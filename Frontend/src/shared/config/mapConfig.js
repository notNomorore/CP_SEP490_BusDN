export const DA_NANG_CENTER = [16.0471, 108.2068];

export const DA_NANG_BOUNDS = [
  [15.85, 107.95],
  [16.25, 108.35],
];

export const DA_NANG_MAP_CONFIG = {
  center: DA_NANG_CENTER,
  bounds: DA_NANG_BOUNDS,
  initialZoom: 12,
  minZoom: 10,
  maxZoom: 19,
  routeFitMaxZoom: 15,
  maxBoundsViscosity: 1,
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; OpenStreetMap contributors',
};

export const isInsideDaNang = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= DA_NANG_BOUNDS[0][0]
    && lat <= DA_NANG_BOUNDS[1][0]
    && lng >= DA_NANG_BOUNDS[0][1]
    && lng <= DA_NANG_BOUNDS[1][1];
};
