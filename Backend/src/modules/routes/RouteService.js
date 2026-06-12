import Route from './Route.js';

const sampleRoutes = [
  {
    routeNumber: 'DN01',
    name: 'Da Nang Central - My Khe Beach',
    origin: 'Da Nang Central Bus Station',
    destination: 'My Khe Beach',
    distanceKm: 12,
    estimatedDurationMinutes: 25,
    fare: 15000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Dragon Bridge',
        order: 2,
        estimatedOffsetMinutes: 12,
        latitude: 16.0614,
        longitude: 108.2272,
      },
      {
        name: 'Han Market',
        order: 3,
        estimatedOffsetMinutes: 18,
        latitude: 16.0681,
        longitude: 108.2245,
      },
      {
        name: 'My Khe Beach',
        order: 4,
        estimatedOffsetMinutes: 25,
        latitude: 16.0544,
        longitude: 108.2478,
      },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0668, longitude: 108.1760 },
      { latitude: 16.0670, longitude: 108.1840 },
      { latitude: 16.0672, longitude: 108.1912 },
      { latitude: 16.0676, longitude: 108.1988 },
      { latitude: 16.0680, longitude: 108.2070 },
      { latitude: 16.0684, longitude: 108.2150 },
      { latitude: 16.0681, longitude: 108.2245 },
      { latitude: 16.0614, longitude: 108.2272 },
      { latitude: 16.0602, longitude: 108.2312 },
      { latitude: 16.0585, longitude: 108.2360 },
      { latitude: 16.0560, longitude: 108.2418 },
      { latitude: 16.0544, longitude: 108.2478 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '21:00', frequencyMinutes: 20 },
  },
  {
    routeNumber: 'DN02',
    name: 'Da Nang Central - Hoa Khanh',
    origin: 'Da Nang Central Bus Station',
    destination: 'Hoa Khanh',
    distanceKm: 14,
    estimatedDurationMinutes: 35,
    fare: 15000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Thanh Khe District',
        order: 2,
        estimatedOffsetMinutes: 10,
        latitude: 16.0679,
        longitude: 108.1817,
      },
      {
        name: 'Lien Chieu',
        order: 3,
        estimatedOffsetMinutes: 25,
        latitude: 16.0737,
        longitude: 108.1502,
      },
      {
        name: 'Hoa Khanh',
        order: 4,
        estimatedOffsetMinutes: 35,
        latitude: 16.0750,
        longitude: 108.1428,
      },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0670, longitude: 108.1660 },
      { latitude: 16.0672, longitude: 108.1625 },
      { latitude: 16.0676, longitude: 108.1588 },
      { latitude: 16.0680, longitude: 108.1555 },
      { latitude: 16.0695, longitude: 108.1528 },
      { latitude: 16.0713, longitude: 108.1510 },
      { latitude: 16.0737, longitude: 108.1502 },
      { latitude: 16.0745, longitude: 108.1465 },
      { latitude: 16.0750, longitude: 108.1428 },
    ],
    operatingHours: { firstDeparture: '05:45', lastDeparture: '20:30', frequencyMinutes: 25 },
  },
  {
    routeNumber: 'DN03',
    name: 'Da Nang Central - Son Tra',
    origin: 'Da Nang Central Bus Station',
    destination: 'Son Tra',
    distanceKm: 17,
    estimatedDurationMinutes: 35,
    fare: 25000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Nguyen Tat Thanh',
        order: 2,
        estimatedOffsetMinutes: 10,
        latitude: 16.0760,
        longitude: 108.1940,
      },
      {
        name: 'Thuan Phuoc Bridge',
        order: 3,
        estimatedOffsetMinutes: 20,
        latitude: 16.0908,
        longitude: 108.2318,
      },
      {
        name: 'Linh Ung Pagoda',
        order: 4,
        estimatedOffsetMinutes: 35,
        latitude: 16.1005,
        longitude: 108.2773,
      },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0680, longitude: 108.1740 },
      { latitude: 16.0700, longitude: 108.1805 },
      { latitude: 16.0730, longitude: 108.1870 },
      { latitude: 16.0760, longitude: 108.1940 },
      { latitude: 16.0790, longitude: 108.2020 },
      { latitude: 16.0825, longitude: 108.2110 },
      { latitude: 16.0860, longitude: 108.2200 },
      { latitude: 16.0885, longitude: 108.2265 },
      { latitude: 16.0908, longitude: 108.2318 },
      { latitude: 16.0930, longitude: 108.2380 },
      { latitude: 16.0960, longitude: 108.2445 },
      { latitude: 16.1010, longitude: 108.2505 },
      { latitude: 16.1060, longitude: 108.2570 },
      { latitude: 16.1110, longitude: 108.2640 },
      { latitude: 16.1118, longitude: 108.2695 },
      { latitude: 16.1080, longitude: 108.2732 },
      { latitude: 16.1005, longitude: 108.2773 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '20:30', frequencyMinutes: 30 },
  },
  {
    routeNumber: 'DN04',
    name: 'Da Nang Central - Marble Mountains',
    origin: 'Da Nang Central Bus Station',
    destination: 'Marble Mountains',
    distanceKm: 16,
    estimatedDurationMinutes: 35,
    fare: 20000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Dragon Bridge',
        order: 2,
        estimatedOffsetMinutes: 12,
        latitude: 16.0614,
        longitude: 108.2272,
      },
      {
        name: 'My Khe Beach',
        order: 3,
        estimatedOffsetMinutes: 22,
        latitude: 16.0544,
        longitude: 108.2478,
      },
      {
        name: 'Marble Mountains',
        order: 4,
        estimatedOffsetMinutes: 35,
        latitude: 16.0037,
        longitude: 108.2642,
      },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0662, longitude: 108.1765 },
      { latitude: 16.0656, longitude: 108.1842 },
      { latitude: 16.0649, longitude: 108.1918 },
      { latitude: 16.0640, longitude: 108.1998 },
      { latitude: 16.0630, longitude: 108.2070 },
      { latitude: 16.0620, longitude: 108.2145 },
      { latitude: 16.0614, longitude: 108.2272 },
      { latitude: 16.0605, longitude: 108.2310 },
      { latitude: 16.0585, longitude: 108.2360 },
      { latitude: 16.0562, longitude: 108.2413 },
      { latitude: 16.0544, longitude: 108.2478 },
      { latitude: 16.0486, longitude: 108.2505 },
      { latitude: 16.0420, longitude: 108.2528 },
      { latitude: 16.0350, longitude: 108.2550 },
      { latitude: 16.0285, longitude: 108.2572 },
      { latitude: 16.0210, longitude: 108.2600 },
      { latitude: 16.0138, longitude: 108.2624 },
      { latitude: 16.0037, longitude: 108.2642 },
    ],
    operatingHours: { firstDeparture: '05:45', lastDeparture: '21:00', frequencyMinutes: 25 },
  },
];

const toRadians = (degrees) => degrees * (Math.PI / 180);

const calculateDistanceKm = (start, end) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLng = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export class RouteService {
  static async ensureSampleRoutes() {
    for (const route of sampleRoutes) {
      await Route.updateOne(
        { routeNumber: route.routeNumber },
        { $set: route },
        { upsert: true }
      );
    }
  }

  static buildSearchQuery({ q, from, to }) {
    const andConditions = [{ status: 'ACTIVE' }];

    if (q) {
      const searchRegex = new RegExp(q.trim(), 'i');
      andConditions.push({
        $or: [
          { routeNumber: searchRegex },
          { name: searchRegex },
          { origin: searchRegex },
          { destination: searchRegex },
          { 'stops.name': searchRegex },
        ],
      });
    }

    if (from) {
      const fromRegex = new RegExp(from.trim(), 'i');
      andConditions.push({
        $or: [
          { origin: fromRegex },
          { 'stops.name': fromRegex },
        ],
      });
    }

    if (to) {
      const toRegex = new RegExp(to.trim(), 'i');
      andConditions.push({
        $or: [
          { destination: toRegex },
          { 'stops.name': toRegex },
        ],
      });
    }

    return { $and: andConditions };
  }

  static async searchRoutes(params) {
    await this.ensureSampleRoutes();

    const query = this.buildSearchQuery(params);
    const routes = await Route.find(query)
      .sort({ routeNumber: 1 })
      .limit(50)
      .lean();

    return routes.map((route) => this.formatRoute(route));
  }

  static formatRoute(route) {
    return {
      id: route._id,
      routeNumber: route.routeNumber,
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      stops: route.stops,
      distanceKm: route.distanceKm,
      estimatedDurationMinutes: route.estimatedDurationMinutes,
      fare: route.fare,
      operatingHours: route.operatingHours,
      pathPoints: route.pathPoints || [],
      status: route.status,
    };
  }

  static async findNearbyRoutes({ latitude, longitude, radiusKm = 5 }) {
    await this.ensureSampleRoutes();

    const userLocation = {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
    const maxDistanceKm = Number(radiusKm) || 5;

    if (
      Number.isNaN(userLocation.latitude)
      || Number.isNaN(userLocation.longitude)
      || userLocation.latitude < -90
      || userLocation.latitude > 90
      || userLocation.longitude < -180
      || userLocation.longitude > 180
    ) {
      throw new Error('Invalid latitude or longitude');
    }

    const routes = await Route.find({ status: 'ACTIVE' }).sort({ routeNumber: 1 }).lean();
    const nearbyStops = [];
    const suggestedRouteMap = new Map();

    for (const route of routes) {
      for (const stop of route.stops) {
        if (typeof stop.latitude !== 'number' || typeof stop.longitude !== 'number') {
          continue;
        }

        const distanceFromUserKm = calculateDistanceKm(userLocation, {
          latitude: stop.latitude,
          longitude: stop.longitude,
        });

        if (distanceFromUserKm <= maxDistanceKm) {
          nearbyStops.push({
            name: stop.name,
            order: stop.order,
            latitude: stop.latitude,
            longitude: stop.longitude,
            distanceKm: Number(distanceFromUserKm.toFixed(2)),
            route: {
              id: route._id,
              routeNumber: route.routeNumber,
              name: route.name,
              origin: route.origin,
              destination: route.destination,
            },
          });

          suggestedRouteMap.set(String(route._id), this.formatRoute(route));
        }
      }
    }

    nearbyStops.sort((first, second) => first.distanceKm - second.distanceKm);

    return {
      userLocation,
      radiusKm: maxDistanceKm,
      nearbyStops: nearbyStops.slice(0, 10),
      routes: Array.from(suggestedRouteMap.values()),
    };
  }

  static findMatchingStop(route, keyword) {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return route.stops.find((stop) => (
      stop.name.toLowerCase().includes(normalizedKeyword)
    ));
  }

  static calculateBestRouteScore(route, startStop, endStop) {
    const stopTravelMinutes = Math.max(
      endStop.estimatedOffsetMinutes - startStop.estimatedOffsetMinutes,
      0
    );
    const stopSpan = Math.max(endStop.order - startStop.order, 1);
    const routeStopCount = Math.max(route.stops.length - 1, 1);
    const estimatedDistanceKm = Number(
      ((route.distanceKm / routeStopCount) * stopSpan).toFixed(2)
    );

    return {
      estimatedDurationMinutes: stopTravelMinutes || route.estimatedDurationMinutes,
      estimatedDistanceKm: estimatedDistanceKm || route.distanceKm,
      score: (stopTravelMinutes || route.estimatedDurationMinutes) + estimatedDistanceKm,
    };
  }

  static async findBestRoute({ from, to }) {
    await this.ensureSampleRoutes();

    if (!from?.trim() || !to?.trim()) {
      throw new Error('Departure and destination are required');
    }

    const routes = await Route.find({ status: 'ACTIVE' }).sort({ routeNumber: 1 }).lean();
    const candidates = [];

    for (const route of routes) {
      const fromRegex = new RegExp(from.trim(), 'i');
      const toRegex = new RegExp(to.trim(), 'i');
      const startStop =
        this.findMatchingStop(route, from)
        || (fromRegex.test(route.origin) ? route.stops[0] : null);
      const endStop =
        this.findMatchingStop(route, to)
        || (toRegex.test(route.destination) ? route.stops[route.stops.length - 1] : null);

      if (!startStop || !endStop || startStop.order >= endStop.order) {
        continue;
      }

      const optimization = this.calculateBestRouteScore(route, startStop, endStop);

      candidates.push({
        route: this.formatRoute(route),
        startStop,
        endStop,
        estimatedDurationMinutes: optimization.estimatedDurationMinutes,
        estimatedDistanceKm: optimization.estimatedDistanceKm,
        score: optimization.score,
      });
    }

    candidates.sort((first, second) => (
      first.score - second.score
      || first.estimatedDurationMinutes - second.estimatedDurationMinutes
      || first.estimatedDistanceKm - second.estimatedDistanceKm
    ));

    return {
      bestRoute: candidates[0] || null,
      alternatives: candidates.slice(1, 4),
      count: candidates.length,
      criteria: {
        from,
        to,
        optimizedBy: 'estimated travel time and distance',
      },
    };
  }
}

export default RouteService;
