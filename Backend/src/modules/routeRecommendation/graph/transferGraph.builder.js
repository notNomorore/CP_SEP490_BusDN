import { haversineDistanceMeters } from '../../busStops/bus-stop.utils.js';

const servicesDiffer = (left, right) => (
  left.routeId !== right.routeId || left.direction !== right.direction
);

export class TransferGraph {
  constructor() {
    this.adjacency = new Map();
    this.edgeCount = 0;
  }

  addEdge(edge) {
    const edges = this.adjacency.get(edge.fromKey) || [];
    if (edges.some((item) => item.toKey === edge.toKey)) {
      return;
    }

    edges.push(edge);
    this.adjacency.set(edge.fromKey, edges);
    this.edgeCount += 1;
  }

  getEdges(fromKey) {
    return this.adjacency.get(fromKey) || [];
  }
}

const shouldUseStation = (stationId, stationIds) => !stationIds || stationIds.has(stationId);

export const buildTransferGraph = async ({
  transitGraph,
  walkingRouting,
  config,
  fromStationIds = null,
  toStationIds = null,
}) => {
  const graph = new TransferGraph();
  const stations = [...transitGraph.stations.values()];

  for (const station of stations) {
    if (!shouldUseStation(station.stationId, fromStationIds) || !shouldUseStation(station.stationId, toStationIds)) {
      continue;
    }

    const nodes = transitGraph.getNodesAtStation(station.stationId);
    nodes.forEach((fromNode) => {
      nodes.forEach((toNode) => {
        if (!servicesDiffer(fromNode, toNode)) {
          return;
        }

        graph.addEdge({
          type: 'TRANSFER',
          fromKey: fromNode.key,
          toKey: toNode.key,
          fromStation: fromNode.station,
          toStation: toNode.station,
          distanceMeters: 0,
          durationSeconds: 0,
          durationMinutes: 0,
          geometry: null,
          sameStation: true,
        });
      });
    });
  }

  for (const fromStation of stations) {
    if (!shouldUseStation(fromStation.stationId, fromStationIds)) {
      continue;
    }

    const nearbyStations = stations
      .filter((toStation) => toStation.stationId !== fromStation.stationId && shouldUseStation(toStation.stationId, toStationIds))
      .map((toStation) => ({
        station: toStation,
        distanceMeters: haversineDistanceMeters(fromStation, toStation),
      }))
      .filter((candidate) => candidate.distanceMeters <= config.MAX_TRANSFER_WALKING_DISTANCE_METERS)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, config.MAX_TRANSFER_CANDIDATES_PER_STATION);

    for (const candidate of nearbyStations) {
      const walking = await walkingRouting.route({ from: fromStation, to: candidate.station, allowExternal: false });
      if (walking.distanceMeters > config.MAX_TRANSFER_WALKING_DISTANCE_METERS) {
        continue;
      }

      const fromNodes = transitGraph.getNodesAtStation(fromStation.stationId);
      const toNodes = transitGraph.getNodesAtStation(candidate.station.stationId);
      fromNodes.forEach((fromNode) => {
        toNodes.forEach((toNode) => {
          if (!servicesDiffer(fromNode, toNode)) {
            return;
          }

          graph.addEdge({
            type: 'TRANSFER',
            fromKey: fromNode.key,
            toKey: toNode.key,
            fromStation: fromNode.station,
            toStation: toNode.station,
            distanceMeters: walking.distanceMeters,
            durationSeconds: walking.durationSeconds,
            durationMinutes: walking.durationSeconds / 60,
            geometry: walking.geometry,
            sameStation: false,
            walkingSource: walking.source,
            walkingIsFallback: walking.isFallback,
          });
        });
      });
    }
  }

  return graph;
};

export default buildTransferGraph;
