import { haversineDistanceMeters } from '../../busStops/bus-stop.utils.js';

const isValidPoint = (point) => (
  Number.isFinite(Number(point?.latitude))
  && Number.isFinite(Number(point?.longitude))
);

const nearestPolylineIndex = (polyline, point) => {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  polyline.forEach((candidate, index) => {
    const distance = haversineDistanceMeters(point, candidate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
};

const directionKey = (direction) => (
  direction === 'INBOUND' ? 'inboundRoute' : 'outboundRoute'
);

export const extractBusRouteGeometry = ({ route, direction, fromStation, toStation }) => {
  const polyline = (route?.[directionKey(direction)]?.polylinePath || [])
    .filter(isValidPoint)
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }));

  if (polyline.length < 2 || !isValidPoint(fromStation) || !isValidPoint(toStation)) {
    return {
      geometry: null,
      geometrySource: 'UNAVAILABLE',
    };
  }

  const fromIndex = nearestPolylineIndex(polyline, fromStation);
  const toIndex = nearestPolylineIndex(polyline, toStation);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return {
      geometry: null,
      geometrySource: 'UNAVAILABLE',
    };
  }

  const startIndex = Math.min(fromIndex, toIndex);
  const endIndex = Math.max(fromIndex, toIndex);
  const coordinates = polyline.slice(startIndex, endIndex + 1);

  if (coordinates.length < 2) {
    return {
      geometry: null,
      geometrySource: 'UNAVAILABLE',
    };
  }

  return {
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map((point) => [point.longitude, point.latitude]),
    },
    geometrySource: 'ROUTE_POLYLINE',
  };
};

export default extractBusRouteGeometry;
