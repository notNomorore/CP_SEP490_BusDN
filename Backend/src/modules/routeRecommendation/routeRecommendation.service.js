import Route from '../routes/Route.js';
import RouteStation from '../admin/RouteStation.js';
import logger from '../../utils/logger.js';
import routeRecommendationConfig from './routeRecommendation.config.js';
import { validateRecommendationQuery } from './utils/validation.js';
import { buildTransitGraph } from './graph/transitGraph.builder.js';
import { buildTransferGraph } from './graph/transferGraph.builder.js';
import { findNearbyTransitStops } from './utils/nearbyStops.js';
import WalkingRoutingService from './walking/walkingRouting.service.js';
import WaitingTimeService from './waitingTime.service.js';
import PathFinder from './graph/pathFinder.js';
import { rankItineraries } from './ranking/itineraryRanker.js';

const stationSelect = '_id stationCode stationName address latitude longitude isMainStation isActive city zone routeAssignments';

export class RouteRecommendationService {
  constructor({
    config = routeRecommendationConfig,
    walkingRouting = new WalkingRoutingService(config),
  } = {}) {
    this.config = config;
    this.walkingRouting = walkingRouting;
  }

  validateQuery(query) {
    const validation = validateRecommendationQuery(query, this.config);
    if (!validation.valid) {
      const error = new Error(validation.message);
      error.statusCode = 400;
      throw error;
    }

    return validation.data;
  }

  async recommend(query) {
    const request = this.validateQuery(query);
    const [routes, stations] = await Promise.all([
      Route.find({ status: 'PUBLISHED' })
        .select('_id routeCode routeName routeColor status outboundRoute inboundRoute scheduleConfig fareConfig')
        .sort({ routeCode: 1 })
        .lean(),
      RouteStation.find({ isActive: { $ne: false } })
        .select(stationSelect)
        .lean(),
    ]);
    const transitGraph = buildTransitGraph({ routes, stations, config: this.config });
    const originCandidates = findNearbyTransitStops({
      point: request.origin,
      transitGraph,
      maxDistanceMeters: this.config.MAX_WALKING_DISTANCE_METERS,
      limit: this.config.MAX_ORIGIN_STOPS,
    });
    const destinationCandidates = findNearbyTransitStops({
      point: request.destination,
      transitGraph,
      maxDistanceMeters: this.config.MAX_WALKING_DISTANCE_METERS,
      limit: this.config.MAX_DESTINATION_STOPS,
    });

    if (!originCandidates.length || !destinationCandidates.length) {
      this.logDebug('No nearby candidate stops found', {
        originCandidateCount: originCandidates.length,
        destinationCandidateCount: destinationCandidates.length,
      });
      return this.emptyResponse(request, transitGraph, {
        originCandidateCount: originCandidates.length,
        destinationCandidateCount: destinationCandidates.length,
      });
    }

    const routeIds = [...new Set(routes.map((route) => String(route._id)))];
    const waitingTimeService = await WaitingTimeService.createForRoutes(routeIds, { config: this.config });
    const transferScope = this.buildTransferScope({ transitGraph, originCandidates, destinationCandidates });
    const transferGraph = await buildTransferGraph({
      transitGraph,
      walkingRouting: this.walkingRouting,
      config: this.config,
      fromStationIds: transferScope.fromStationIds,
      toStationIds: transferScope.toStationIds,
    });
    const pathFinder = new PathFinder({
      transitGraph,
      transferGraph,
      walkingRouting: this.walkingRouting,
      waitingTimeService,
      config: this.config,
    });
    const paths = await pathFinder.findPaths({
      origin: request.origin,
      destination: request.destination,
      originCandidates,
      destinationCandidates,
      maxTransfers: request.maxTransfers,
    });
    const recommendations = rankItineraries(paths, {
      preference: request.preference,
      config: this.config,
    });
    await this.enrichSelectedTransferGeometry(recommendations);
    const publicRecommendations = recommendations.map((recommendation) => {
      const publicRecommendation = { ...recommendation };
      delete publicRecommendation.signature;
      return publicRecommendation;
    });

    this.logDebug('Route recommendations calculated', {
      routeCount: routes.length,
      candidateOriginStopCount: originCandidates.length,
      candidateDestinationStopCount: destinationCandidates.length,
      transferCandidateCount: transferGraph.edgeCount,
      pathCount: paths.length,
      finalRecommendationCount: recommendations.length,
      graphWarningCount: transitGraph.warnings.length,
    });

    return {
      origin: request.origin,
      destination: request.destination,
      recommendations: publicRecommendations,
      meta: {
        maxTransfers: request.maxTransfers,
        preference: request.preference,
        walkingRouting: {
          source: this.config.WALKING_OSRM_BASE_URL ? 'OSRM_WALKING_OR_FALLBACK' : 'HAVERSINE_FALLBACK',
          geometryMayBeNull: true,
        },
        diagnostics: {
          originCandidateCount: originCandidates.length,
          destinationCandidateCount: destinationCandidates.length,
          transferCandidateCount: transferGraph.edgeCount,
          pathCount: paths.length,
          graphWarnings: transitGraph.warnings.slice(0, 10),
        },
      },
    };
  }

  buildTransferScope({ transitGraph, originCandidates, destinationCandidates }) {
    const fromStationIds = new Set();
    const toStationIds = new Set();

    originCandidates.flatMap((candidate) => candidate.nodes).forEach((originNode) => {
      transitGraph.getDownstreamStops(originNode).forEach((node) => fromStationIds.add(node.stationId));
    });

    destinationCandidates.flatMap((candidate) => candidate.nodes).forEach((destinationNode) => {
      transitGraph.getUpstreamStops(destinationNode).forEach((node) => toStationIds.add(node.stationId));
    });

    return { fromStationIds, toStationIds };
  }

  async enrichSelectedTransferGeometry(recommendations) {
    await Promise.all(recommendations.map(async (recommendation) => {
      await Promise.all((recommendation.legs || []).map(async (leg) => {
        if (leg.type !== 'TRANSFER' || leg.sameStation || leg.geometry) {
          return;
        }

        const walking = await this.walkingRouting.route({
          from: leg.fromStation,
          to: leg.toStation,
          allowExternal: true,
        });

        leg.geometry = walking.geometry;
        leg.walkingSource = walking.source;
        leg.walkingIsFallback = Boolean(walking.isFallback);
      }));
    }));
  }

  emptyResponse(request, transitGraph, candidateCounts = {}) {
    return {
      origin: request.origin,
      destination: request.destination,
      recommendations: [],
      meta: {
        maxTransfers: request.maxTransfers,
        preference: request.preference,
        diagnostics: {
          originCandidateCount: candidateCounts.originCandidateCount || 0,
          destinationCandidateCount: candidateCounts.destinationCandidateCount || 0,
          transferCandidateCount: 0,
          pathCount: 0,
          graphWarnings: transitGraph.warnings.slice(0, 10),
        },
      },
    };
  }

  logDebug(message, details) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(message, details);
    }
  }
}

export default new RouteRecommendationService();
