import Route from './Route.js';

const sampleRoutes = [
  {
    routeNumber: 'DN01',
    name: 'Da Nang - Hoi An',
    origin: 'Da Nang',
    destination: 'Hoi An',
    distanceKm: 31,
    estimatedDurationMinutes: 55,
    fare: 35000,
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
        name: 'Marble Mountains',
        order: 3,
        estimatedOffsetMinutes: 28,
        latitude: 16.0037,
        longitude: 108.2642,
      },
      {
        name: 'Hoi An Ancient Town',
        order: 4,
        estimatedOffsetMinutes: 55,
        latitude: 15.8801,
        longitude: 108.3380,
      },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '21:00', frequencyMinutes: 30 },
  },
  {
    routeNumber: 'DN02',
    name: 'Da Nang - Ba Na Hills',
    origin: 'Da Nang',
    destination: 'Ba Na Hills',
    distanceKm: 38,
    estimatedDurationMinutes: 70,
    fare: 55000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Hoa Cam',
        order: 2,
        estimatedOffsetMinutes: 20,
        latitude: 16.0121,
        longitude: 108.1795,
      },
      {
        name: 'Tuy Loan',
        order: 3,
        estimatedOffsetMinutes: 38,
        latitude: 15.9833,
        longitude: 108.1167,
      },
      {
        name: 'Ba Na Hills Gate',
        order: 4,
        estimatedOffsetMinutes: 70,
        latitude: 15.9970,
        longitude: 107.9888,
      },
    ],
    operatingHours: { firstDeparture: '06:00', lastDeparture: '19:30', frequencyMinutes: 45 },
  },
  {
    routeNumber: 'DN03',
    name: 'Da Nang - Hue',
    origin: 'Da Nang',
    destination: 'Hue',
    distanceKm: 96,
    estimatedDurationMinutes: 140,
    fare: 95000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Hai Van Pass',
        order: 2,
        estimatedOffsetMinutes: 45,
        latitude: 16.1989,
        longitude: 108.1290,
      },
      {
        name: 'Lang Co',
        order: 3,
        estimatedOffsetMinutes: 75,
        latitude: 16.2242,
        longitude: 108.0565,
      },
      {
        name: 'Hue Southern Bus Station',
        order: 4,
        estimatedOffsetMinutes: 140,
        latitude: 16.4383,
        longitude: 107.5996,
      },
    ],
    operatingHours: { firstDeparture: '05:00', lastDeparture: '20:00', frequencyMinutes: 60 },
  },
  {
    routeNumber: 'DN04',
    name: 'Da Nang - My Son Sanctuary',
    origin: 'Da Nang',
    destination: 'My Son',
    distanceKm: 42,
    estimatedDurationMinutes: 80,
    fare: 60000,
    stops: [
      {
        name: 'Da Nang Central Bus Station',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Dien Ban',
        order: 2,
        estimatedOffsetMinutes: 35,
        latitude: 15.8984,
        longitude: 108.2540,
      },
      {
        name: 'Duy Xuyen',
        order: 3,
        estimatedOffsetMinutes: 55,
        latitude: 15.7893,
        longitude: 108.2034,
      },
      {
        name: 'My Son Sanctuary',
        order: 4,
        estimatedOffsetMinutes: 80,
        latitude: 15.7658,
        longitude: 108.1220,
      },
    ],
    operatingHours: { firstDeparture: '06:30', lastDeparture: '17:30', frequencyMinutes: 90 },
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

    return routes.map((route) => ({
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
      status: route.status,
    }));
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
}

export default RouteService;
