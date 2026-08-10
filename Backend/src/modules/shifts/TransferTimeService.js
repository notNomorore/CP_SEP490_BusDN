import Route from '../routes/Route.js';
import rules from './driverScheduling.config.js';

const id = (value) => String(value?._id || value || '');

const terminalFor = (route, direction, side) => {
  const path = direction === 'INBOUND' ? route?.inboundRoute : route?.outboundRoute;
  const station = side === 'START' ? path?.startStation : path?.endStation;
  return station?.stationId || `${station?.latitude || ''}:${station?.longitude || ''}`;
};

export default class TransferTimeService {
  static async getTripTerminals(trip) {
    const route = trip?.routeId && typeof trip.routeId === 'object' && trip.routeId.outboundRoute
      ? trip.routeId
      : await Route.findById(trip?.routeId).lean();
    return {
      start: terminalFor(route, trip?.direction, 'START'),
      end: terminalFor(route, trip?.direction, 'END'),
    };
  }

  static async estimateTransferMinutes(previousTrip, nextTrip) {
    if (!previousTrip || !nextTrip) return 0;
    const [previous, next] = await Promise.all([
      this.getTripTerminals(previousTrip),
      this.getTripTerminals(nextTrip),
    ]);
    if (previous.end && next.start && id(previous.end) === id(next.start)) return 0;
    return rules.defaultTransferMinutes;
  }
}
