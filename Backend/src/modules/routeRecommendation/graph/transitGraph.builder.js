const DIRECTIONS = [
  { key: 'outboundRoute', direction: 'OUTBOUND' },
  { key: 'inboundRoute', direction: 'INBOUND' },
];

const isFiniteCoordinate = (stop) => (
  Number.isFinite(Number(stop?.latitude))
  && Number.isFinite(Number(stop?.longitude))
);

const idOf = (value) => String(value || '').trim();

const nodeKey = ({ routeId, direction, stationId }) => `${routeId}|${direction}|${stationId}`;
const serviceKey = ({ routeId, direction }) => `${routeId}|${direction}`;

export class TransitGraph {
  constructor() {
    this.nodes = new Map();
    this.adjacency = new Map();
    this.routeStops = new Map();
    this.stations = new Map();
    this.nodesByStation = new Map();
    this.routesById = new Map();
    this.warnings = [];
  }

  addWarning(message, details = {}) {
    this.warnings.push({ message, details });
  }

  addNode(node) {
    this.nodes.set(node.key, node);
    this.routesById.set(node.routeId, node.route);
    this.stations.set(node.stationId, node.station);

    const stationNodes = this.nodesByStation.get(node.stationId) || [];
    stationNodes.push(node);
    this.nodesByStation.set(node.stationId, stationNodes);

    const stops = this.routeStops.get(node.serviceKey) || [];
    stops.push(node);
    this.routeStops.set(node.serviceKey, stops);
  }

  addEdge(edge) {
    const edges = this.adjacency.get(edge.fromKey) || [];
    edges.push(edge);
    this.adjacency.set(edge.fromKey, edges);
  }

  finalize() {
    for (const [key, stops] of this.routeStops.entries()) {
      this.routeStops.set(
        key,
        stops.sort((left, right) => left.stopOrder - right.stopOrder)
      );
    }
  }

  getNodesAtStation(stationId) {
    return this.nodesByStation.get(String(stationId)) || [];
  }

  getServiceStops(routeId, direction) {
    return this.routeStops.get(`${String(routeId)}|${direction}`) || [];
  }

  getDownstreamStops(node, { includeCurrent = false } = {}) {
    return this.getServiceStops(node.routeId, node.direction)
      .filter((stop) => includeCurrent ? stop.stopOrder >= node.stopOrder : stop.stopOrder > node.stopOrder);
  }

  getUpstreamStops(node, { includeCurrent = false } = {}) {
    return this.getServiceStops(node.routeId, node.direction)
      .filter((stop) => includeCurrent ? stop.stopOrder <= node.stopOrder : stop.stopOrder < node.stopOrder);
  }

  getSegment(fromNode, toNode) {
    if (
      fromNode.routeId !== toNode.routeId
      || fromNode.direction !== toNode.direction
      || fromNode.stopOrder >= toNode.stopOrder
    ) {
      return null;
    }

    const stops = this.getServiceStops(fromNode.routeId, fromNode.direction);
    const selectedStops = stops.filter((stop) => stop.stopOrder >= fromNode.stopOrder && stop.stopOrder <= toNode.stopOrder);
    const durationMinutes = selectedStops.slice(0, -1).reduce((total, stop, index) => {
      const nextStop = selectedStops[index + 1];
      const edge = (this.adjacency.get(stop.key) || []).find((item) => (
        item.type === 'BUS' && item.toKey === nextStop.key
      ));
      return total + (edge?.durationMinutes ?? 0);
    }, 0);

    return {
      durationMinutes,
      stops: selectedStops.map((stop) => stop.station),
    };
  }
}

const normalizeStation = (stop, station) => ({
  stationId: idOf(stop.stationId),
  stationCode: station?.stationCode || '',
  stationName: station?.stationName || stop.stopName,
  stopName: stop.stopName,
  address: station?.address || stop.address,
  latitude: Number(station?.latitude ?? stop.latitude),
  longitude: Number(station?.longitude ?? stop.longitude),
  isMainStation: Boolean(station?.isMainStation ?? stop.isMainStation),
});

const calculateSegmentDurationMinutes = ({ currentStop, nextStop, directionStops, routeDirection, config }) => {
  const preferred = Number(nextStop.arrivalOffsetMinutes) - Number(currentStop.departureOffsetMinutes);
  if (Number.isFinite(preferred) && preferred >= 0) {
    return preferred;
  }

  const routeDuration = Number(routeDirection?.estimatedDurationMinutes);
  if (Number.isFinite(routeDuration) && routeDuration > 0 && directionStops.length > 1) {
    return routeDuration / (directionStops.length - 1);
  }

  return config.DEFAULT_BUS_SEGMENT_MINUTES;
};

export const buildTransitGraph = ({ routes = [], stations = [], config }) => {
  const graph = new TransitGraph();
  const stationMap = new Map(stations.map((station) => [idOf(station._id), station]));

  routes
    .filter((route) => route.status === 'PUBLISHED')
    .forEach((route) => {
      DIRECTIONS.forEach(({ key, direction }) => {
        const routeDirection = route[key] || {};
        const orderedStops = [...(routeDirection.orderedStops || [])]
          .sort((left, right) => Number(left.stopOrder) - Number(right.stopOrder));

        if (orderedStops.length < 2) {
          graph.addWarning('Route direction has fewer than two stops', { routeId: idOf(route._id), routeCode: route.routeCode, direction });
          return;
        }

        const validStops = [];
        orderedStops.forEach((stop) => {
          const stationId = idOf(stop.stationId);
          const station = stationMap.get(stationId);

          if (!stationId) {
            graph.addWarning('Route stop missing stationId', { routeId: idOf(route._id), routeCode: route.routeCode, direction, stopName: stop.stopName });
            return;
          }

          if (!station || station.isActive === false) {
            graph.addWarning('Route stop references missing or inactive station', { routeId: idOf(route._id), routeCode: route.routeCode, direction, stationId });
            return;
          }

          if (!isFiniteCoordinate(stop) && !isFiniteCoordinate(station)) {
            graph.addWarning('Route stop has invalid coordinates', { routeId: idOf(route._id), routeCode: route.routeCode, direction, stationId });
            return;
          }

          validStops.push({ stop, station });
        });

        if (validStops.length < 2) {
          graph.addWarning('Route direction has fewer than two valid stops', { routeId: idOf(route._id), routeCode: route.routeCode, direction });
          return;
        }

        validStops.forEach(({ stop, station }) => {
          const routeId = idOf(route._id);
          const stationId = idOf(stop.stationId);
          const node = {
            key: nodeKey({ routeId, direction, stationId }),
            serviceKey: serviceKey({ routeId, direction }),
            routeId,
            routeCode: route.routeCode,
            routeName: route.routeName,
            direction,
            stationId,
            stopOrder: Number(stop.stopOrder),
            arrivalOffsetMinutes: Number(stop.arrivalOffsetMinutes),
            departureOffsetMinutes: Number(stop.departureOffsetMinutes),
            stop,
            station: normalizeStation(stop, station),
            route,
          };

          graph.addNode(node);
        });

        const serviceStops = validStops
          .map(({ stop }) => graph.nodes.get(nodeKey({ routeId: idOf(route._id), direction, stationId: idOf(stop.stationId) })))
          .filter(Boolean)
          .sort((left, right) => left.stopOrder - right.stopOrder);

        serviceStops.slice(0, -1).forEach((currentNode, index) => {
          const nextNode = serviceStops[index + 1];
          const durationMinutes = calculateSegmentDurationMinutes({
            currentStop: currentNode.stop,
            nextStop: nextNode.stop,
            directionStops: serviceStops,
            routeDirection,
            config,
          });

          if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
            graph.addWarning('Skipped negative or invalid bus segment duration', {
              routeId: idOf(route._id),
              routeCode: route.routeCode,
              direction,
              fromStationId: currentNode.stationId,
              toStationId: nextNode.stationId,
            });
            return;
          }

          graph.addEdge({
            type: 'BUS',
            fromKey: currentNode.key,
            toKey: nextNode.key,
            routeId: currentNode.routeId,
            routeCode: currentNode.routeCode,
            routeName: currentNode.routeName,
            direction,
            fromStationId: currentNode.stationId,
            toStationId: nextNode.stationId,
            fromStopOrder: currentNode.stopOrder,
            toStopOrder: nextNode.stopOrder,
            durationMinutes,
          });
        });
      });
    });

  graph.finalize();
  return graph;
};

export default buildTransitGraph;
