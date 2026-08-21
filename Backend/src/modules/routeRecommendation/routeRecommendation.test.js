import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { haversineDistanceMeters } from '../busStops/bus-stop.utils.js';
import { responseHandler } from '../../utils/response.js';
import routeRecommendationRoutes from './routeRecommendation.routes.js';
import routeRoutes from '../routes/routeRoutes.js';
import { buildTransitGraph } from './graph/transitGraph.builder.js';
import { buildTransferGraph } from './graph/transferGraph.builder.js';
import PathFinder from './graph/pathFinder.js';
import WaitingTimeService from './waitingTime.service.js';
import { findNearbyTransitStops } from './utils/nearbyStops.js';
import { rankItineraries } from './ranking/itineraryRanker.js';

const testConfig = {
  MAX_ORIGIN_STOPS: 8,
  MAX_DESTINATION_STOPS: 8,
  MAX_WALKING_DISTANCE_METERS: 500,
  MAX_TRANSFER_WALKING_DISTANCE_METERS: 200,
  MAX_TRANSFER_CANDIDATES_PER_STATION: 6,
  MAX_TRANSFER_ALIGHT_OPTIONS_PER_ORIGIN: 12,
  MAX_TRANSFERS: 1,
  MAX_RECOMMENDATIONS: 5,
  TRANSFER_PENALTY_MINUTES: 3,
  DEFAULT_BUS_SEGMENT_MINUTES: 5,
  DEFAULT_HEADWAY_MINUTES: 20,
  FALLBACK_WALKING_SPEED_METERS_PER_SECOND: 1.25,
};

const station = (id, latitude, longitude, name = id) => ({
  _id: id,
  stationId: id,
  stationCode: id,
  stationName: name,
  stopName: name,
  address: `${name} address`,
  latitude,
  longitude,
  isActive: true,
});

const stop = (stationData, order, offset = order * 5) => ({
  stationId: stationData._id,
  stopName: stationData.stationName,
  address: stationData.address,
  latitude: stationData.latitude,
  longitude: stationData.longitude,
  stopOrder: order,
  arrivalOffsetMinutes: offset,
  departureOffsetMinutes: offset,
});

const route = (id, code, stops, duration = 20) => ({
  _id: id,
  routeCode: code,
  routeName: `Route ${code}`,
  routeColor: '#10b981',
  status: 'PUBLISHED',
  scheduleConfig: { frequencyMinutes: 20 },
  outboundRoute: {
    orderedStops: stops,
    polylinePath: stops.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
    estimatedDurationMinutes: duration,
  },
  inboundRoute: {
    orderedStops: [],
    estimatedDurationMinutes: 0,
  },
});

const walkingRouting = {
  async route({ from, to }) {
    const distanceMeters = haversineDistanceMeters(from, to);
    return {
      distanceMeters,
      durationSeconds: distanceMeters / testConfig.FALLBACK_WALKING_SPEED_METERS_PER_SECOND,
      geometry: null,
      source: 'TEST',
      isFallback: true,
    };
  },
};

const runRecommendations = async ({ routes, stations, origin, destination, maxTransfers = 1 }) => {
  const transitGraph = buildTransitGraph({ routes, stations, config: testConfig });
  const originCandidates = findNearbyTransitStops({
    point: origin,
    transitGraph,
    maxDistanceMeters: testConfig.MAX_WALKING_DISTANCE_METERS,
    limit: testConfig.MAX_ORIGIN_STOPS,
  });
  const destinationCandidates = findNearbyTransitStops({
    point: destination,
    transitGraph,
    maxDistanceMeters: testConfig.MAX_WALKING_DISTANCE_METERS,
    limit: testConfig.MAX_DESTINATION_STOPS,
  });
  const transferGraph = await buildTransferGraph({
    transitGraph,
    walkingRouting,
    config: testConfig,
  });
  const waitingTimeService = new WaitingTimeService({
    now: new Date('2026-08-21T08:00:00+07:00'),
    schedules: [],
    config: testConfig,
  });
  const pathFinder = new PathFinder({
    transitGraph,
    transferGraph,
    walkingRouting,
    waitingTimeService,
    config: testConfig,
  });
  const paths = await pathFinder.findPaths({
    origin,
    destination,
    originCandidates,
    destinationCandidates,
    maxTransfers,
  });

  return {
    transitGraph,
    transferGraph,
    paths,
    recommendations: rankItineraries(paths, { preference: 'FASTEST', config: testConfig }),
  };
};

describe('route recommendation', () => {
  it('returns WALK, BUS, WALK when a direct route exists', async () => {
    const a = station('A', 16.0600, 108.2200, 'A');
    const b = station('B', 16.0610, 108.2210, 'B');
    const c = station('C', 16.0620, 108.2220, 'C');
    const result = await runRecommendations({
      routes: [route('R1', '09', [stop(a, 1, 0), stop(b, 2, 6), stop(c, 3, 12)])],
      stations: [a, b, c],
      origin: { latitude: 16.0601, longitude: 108.2201 },
      destination: { latitude: 16.0621, longitude: 108.2221 },
      maxTransfers: 0,
    });

    expect(result.recommendations[0].legs.map((leg) => leg.type)).toEqual(['WALK', 'WAIT', 'BUS', 'WALK']);
    const busLeg = result.recommendations[0].legs.find((leg) => leg.type === 'BUS');
    expect(busLeg.routeCode).toBe('09');
    expect(busLeg.geometry.type).toBe('LineString');
    expect(busLeg.geometry.coordinates.length).toBeGreaterThan(1);
  });

  it('finds a one-transfer route when no direct route reaches the destination', async () => {
    const a = station('A', 16.0600, 108.2200, 'A');
    const x = station('X', 16.0660, 108.2260, 'X');
    const y = station('Y', 16.0661, 108.2261, 'Y');
    const f = station('F', 16.0720, 108.2320, 'F');
    const result = await runRecommendations({
      routes: [
        route('R1', '09', [stop(a, 1, 0), stop(x, 2, 8)]),
        route('R2', '13', [stop(y, 1, 0), stop(f, 2, 9)]),
      ],
      stations: [a, x, y, f],
      origin: { latitude: 16.0601, longitude: 108.2201 },
      destination: { latitude: 16.0721, longitude: 108.2321 },
    });

    expect(result.recommendations[0].transferCount).toBe(1);
    expect(result.recommendations[0].legs.map((leg) => leg.type)).toEqual(['WALK', 'WAIT', 'BUS', 'TRANSFER', 'WAIT', 'BUS', 'WALK']);
  });

  it('detects transfers at a shared physical station without unrelated walking', async () => {
    const a = station('A', 16.0600, 108.2200, 'A');
    const x = station('X', 16.0660, 108.2260, 'Shared');
    const f = station('F', 16.0720, 108.2320, 'F');
    const result = await runRecommendations({
      routes: [
        route('R1', '09', [stop(a, 1, 0), stop(x, 2, 8)]),
        route('R2', '13', [stop(x, 1, 0), stop(f, 2, 9)]),
      ],
      stations: [a, x, f],
      origin: { latitude: 16.0601, longitude: 108.2201 },
      destination: { latitude: 16.0721, longitude: 108.2321 },
    });

    const transfer = result.recommendations[0].legs.find((leg) => leg.type === 'TRANSFER');
    expect(transfer.sameStation).toBe(true);
    expect(transfer.walkingDistanceMeters).toBe(0);
  });

  it('only creates nearby-station transfers inside the configured transfer radius', async () => {
    const x = station('X', 16.0610, 108.2210, 'X');
    const y = station('Y', 16.0612, 108.2212, 'Y');
    const z = station('Z', 16.0700, 108.2300, 'Z');
    const a = station('A', 16.0600, 108.2200, 'A');
    const f = station('F', 16.0620, 108.2220, 'F');
    const transitGraph = buildTransitGraph({
      routes: [
        route('R1', '09', [stop(a, 1, 0), stop(x, 2, 8)]),
        route('R2', '13', [stop(y, 1, 0), stop(f, 2, 9)]),
        route('R3', '15', [stop(z, 1, 0), stop(f, 2, 9)]),
      ],
      stations: [a, x, y, z, f],
      config: testConfig,
    });
    const transferGraph = await buildTransferGraph({ transitGraph, walkingRouting, config: testConfig });
    const xNode = transitGraph.getNodesAtStation('X')[0];
    const transferStationIds = transferGraph.getEdges(xNode.key).map((edge) => edge.toStation.stationId);

    expect(transferStationIds).toContain('Y');
    expect(transferStationIds).not.toContain('Z');
  });

  it('considers multiple origin stop candidates and selects the faster itinerary', async () => {
    const a1 = station('A1', 16.0600, 108.2200, 'A1');
    const a2 = station('A2', 16.0602, 108.2202, 'A2');
    const d = station('D', 16.0610, 108.2210, 'D');
    const result = await runRecommendations({
      routes: [
        route('SLOW', 'SLOW', [stop(a1, 1, 0), stop(d, 2, 30)]),
        route('FAST', 'FAST', [stop(a2, 1, 0), stop(d, 2, 5)]),
      ],
      stations: [a1, a2, d],
      origin: { latitude: 16.0601, longitude: 108.2201 },
      destination: { latitude: 16.0611, longitude: 108.2211 },
      maxTransfers: 0,
    });

    expect(result.recommendations[0].legs.find((leg) => leg.type === 'BUS').routeCode).toBe('FAST');
  });

  it('considers multiple destination stop candidates and selects the best alighting stop', async () => {
    const a = station('A', 16.0600, 108.2200, 'A');
    const d1 = station('D1', 16.0610, 108.2210, 'D1');
    const d2 = station('D2', 16.0611, 108.2211, 'D2');
    const result = await runRecommendations({
      routes: [
        route('R1', '09', [stop(a, 1, 0), stop(d1, 2, 20)]),
        route('R2', '13', [stop(a, 1, 0), stop(d2, 2, 5)]),
      ],
      stations: [a, d1, d2],
      origin: { latitude: 16.0601, longitude: 108.2201 },
      destination: { latitude: 16.06112, longitude: 108.22112 },
      maxTransfers: 0,
    });

    expect(result.recommendations[0].legs.find((leg) => leg.type === 'BUS').toStation.stationId).toBe('D2');
  });

  it('returns an empty recommendation list when no transit path exists', async () => {
    const a = station('A', 16.0600, 108.2200, 'A');
    const b = station('B', 16.0610, 108.2210, 'B');
    const c = station('C', 16.0800, 108.2400, 'C');
    const d = station('D', 16.0810, 108.2410, 'D');
    const result = await runRecommendations({
      routes: [
        route('R1', '09', [stop(a, 1, 0), stop(b, 2, 8)]),
        route('R2', '13', [stop(c, 1, 0), stop(d, 2, 9)]),
      ],
      stations: [a, b, c, d],
      origin: { latitude: 16.0601, longitude: 108.2201 },
      destination: { latitude: 16.0811, longitude: 108.2411 },
    });

    expect(result.recommendations).toEqual([]);
  });

  it('returns HTTP 400 for invalid coordinates', async () => {
    const app = express();
    app.use(responseHandler);
    app.use('/api/routes/recommend', routeRecommendationRoutes);

    const response = await request(app)
      .get('/api/routes/recommend')
      .query({ fromLat: 99, fromLng: 108.22, toLat: 16.06, toLng: 108.23 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('skips malformed route stops without stationId and does not crash', () => {
    const a = station('A', 16.0600, 108.2200, 'A');
    const b = station('B', 16.0610, 108.2210, 'B');
    const graph = buildTransitGraph({
      routes: [route('R1', '09', [{ ...stop(a, 1, 0), stationId: undefined }, stop(b, 2, 8)])],
      stations: [a, b],
      config: testConfig,
    });

    expect(graph.nodes.size).toBe(0);
    expect(graph.warnings.some((warning) => warning.message === 'Route stop missing stationId')).toBe(true);
  });

  it('keeps existing route API paths registered', () => {
    const paths = routeRoutes.stack
      .map((layer) => layer.route?.path)
      .filter(Boolean);

    expect(paths).toContain('/nearby');
    expect(paths).toContain('/best');
    expect(paths).toContain('/suggestions');
    expect(paths).toContain('/search');
  });
});
