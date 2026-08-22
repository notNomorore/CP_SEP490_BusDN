import { haversineDistanceMeters } from '../../busStops/bus-stop.utils.js';

export const findNearbyTransitStops = ({
  point,
  transitGraph,
  maxDistanceMeters,
  limit,
}) => {
  const candidates = [];

  for (const station of transitGraph.stations.values()) {
    const distanceMeters = haversineDistanceMeters(point, station);
    if (distanceMeters > maxDistanceMeters) {
      continue;
    }

    const nodes = transitGraph.getNodesAtStation(station.stationId);
    if (!nodes.length) {
      continue;
    }

    candidates.push({
      station,
      stationId: station.stationId,
      distanceMeters,
      nodes,
    });
  }

  return candidates
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, limit);
};

export default findNearbyTransitStops;
