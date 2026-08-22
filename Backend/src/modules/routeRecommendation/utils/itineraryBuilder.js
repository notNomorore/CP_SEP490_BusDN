import { extractBusRouteGeometry } from './routeGeometry.js';

const roundMinutes = (value) => Number((Number(value) || 0).toFixed(1));
const roundMeters = (value) => Math.round(Number(value) || 0);

const stationPayload = (station) => ({
  stationId: station.stationId,
  stationCode: station.stationCode,
  stationName: station.stationName,
  stopName: station.stopName,
  address: station.address,
  latitude: station.latitude,
  longitude: station.longitude,
});

const walkLeg = ({ from, to, walking }) => ({
  type: 'WALK',
  from,
  to,
  distanceMeters: roundMeters(walking.distanceMeters),
  durationSeconds: Math.round(walking.durationSeconds || 0),
  durationMinutes: roundMinutes((walking.durationSeconds || 0) / 60),
  geometry: walking.geometry,
  source: walking.source,
  isFallback: Boolean(walking.isFallback),
});

const waitLeg = (wait) => ({
  type: 'WAIT',
  durationMinutes: wait.durationMinutes,
  reason: wait.reason,
  estimatedArrivalTime: wait.estimatedArrivalTime || null,
});

const busLeg = (leg) => {
  const fromStation = stationPayload(leg.fromNode.station);
  const toStation = stationPayload(leg.toNode.station);
  const { geometry, geometrySource } = extractBusRouteGeometry({
    route: leg.fromNode.route,
    direction: leg.fromNode.direction,
    fromStation,
    toStation,
  });

  return {
    type: 'BUS',
    routeId: leg.fromNode.routeId,
    routeCode: leg.fromNode.routeCode,
    routeName: leg.fromNode.routeName,
    routeColor: leg.fromNode.route?.routeColor || null,
    direction: leg.fromNode.direction,
    fromStation,
    toStation,
    durationMinutes: roundMinutes(leg.segment.durationMinutes),
    stops: leg.segment.stops.map(stationPayload),
    geometry,
    geometrySource,
  };
};

const transferLeg = (leg, penaltyMinutes) => ({
  type: 'TRANSFER',
  fromStation: stationPayload(leg.fromStation),
  toStation: stationPayload(leg.toStation),
  walkingDistanceMeters: roundMeters(leg.distanceMeters),
  walkingDurationSeconds: Math.round(leg.durationSeconds || 0),
  walkingDurationMinutes: roundMinutes(leg.durationMinutes),
  transferPenaltyMinutes: penaltyMinutes,
  geometry: leg.geometry,
  sameStation: Boolean(leg.sameStation),
  walkingSource: leg.walkingSource || null,
  walkingIsFallback: Boolean(leg.walkingIsFallback),
});

export const buildItinerary = (path, { rank = null, label = null, config }) => {
  const legs = [
    walkLeg({
      from: { type: 'ORIGIN' },
      to: stationPayload(path.originWalk.candidate.station),
      walking: path.originWalk.walking,
    }),
  ];

  path.busLegs.forEach((leg, index) => {
    legs.push(waitLeg(leg.wait));
    legs.push(busLeg(leg));

    if (index === 0 && path.transferLeg) {
      legs.push(transferLeg(path.transferLeg, config.TRANSFER_PENALTY_MINUTES));
    }
  });

  legs.push(walkLeg({
    from: stationPayload(path.destinationWalk.candidate.station),
    to: { type: 'DESTINATION' },
    walking: path.destinationWalk.walking,
  }));

  const totals = legs.reduce((summary, leg) => {
    if (leg.type === 'WALK') {
      summary.totalWalkingDistance += leg.distanceMeters;
      summary.totalWalkingDuration += leg.durationMinutes;
    }

    if (leg.type === 'TRANSFER') {
      summary.totalWalkingDistance += leg.walkingDistanceMeters;
      summary.totalWalkingDuration += leg.walkingDurationMinutes;
      summary.totalTransferPenalty += leg.transferPenaltyMinutes;
    }

    if (leg.type === 'BUS') {
      summary.totalBusDuration += leg.durationMinutes;
    }

    if (leg.type === 'WAIT') {
      summary.totalWaitingDuration += leg.durationMinutes;
    }

    return summary;
  }, {
    totalWalkingDistance: 0,
    totalWalkingDuration: 0,
    totalBusDuration: 0,
    totalWaitingDuration: 0,
    totalTransferPenalty: 0,
  });

  const totalDurationMinutes = roundMinutes(
    totals.totalWalkingDuration
    + totals.totalBusDuration
    + totals.totalWaitingDuration
    + totals.totalTransferPenalty
  );

  return {
    rank,
    label,
    totalDuration: totalDurationMinutes,
    totalDurationMinutes,
    totalDurationSeconds: Math.round(totalDurationMinutes * 60),
    totalWalkingDistance: roundMeters(totals.totalWalkingDistance),
    totalWalkingDuration: roundMinutes(totals.totalWalkingDuration),
    totalBusDuration: roundMinutes(totals.totalBusDuration),
    totalWaitingDuration: roundMinutes(totals.totalWaitingDuration),
    transferCount: path.transferCount,
    legs,
    signature: path.signature,
  };
};

export default buildItinerary;
