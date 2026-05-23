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
      { name: 'Da Nang Central Bus Station', order: 1, estimatedOffsetMinutes: 0 },
      { name: 'Dragon Bridge', order: 2, estimatedOffsetMinutes: 12 },
      { name: 'Marble Mountains', order: 3, estimatedOffsetMinutes: 28 },
      { name: 'Hoi An Ancient Town', order: 4, estimatedOffsetMinutes: 55 },
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
      { name: 'Da Nang Central Bus Station', order: 1, estimatedOffsetMinutes: 0 },
      { name: 'Hoa Cam', order: 2, estimatedOffsetMinutes: 20 },
      { name: 'Tuy Loan', order: 3, estimatedOffsetMinutes: 38 },
      { name: 'Ba Na Hills Gate', order: 4, estimatedOffsetMinutes: 70 },
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
      { name: 'Da Nang Central Bus Station', order: 1, estimatedOffsetMinutes: 0 },
      { name: 'Hai Van Pass', order: 2, estimatedOffsetMinutes: 45 },
      { name: 'Lang Co', order: 3, estimatedOffsetMinutes: 75 },
      { name: 'Hue Southern Bus Station', order: 4, estimatedOffsetMinutes: 140 },
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
      { name: 'Da Nang Central Bus Station', order: 1, estimatedOffsetMinutes: 0 },
      { name: 'Dien Ban', order: 2, estimatedOffsetMinutes: 35 },
      { name: 'Duy Xuyen', order: 3, estimatedOffsetMinutes: 55 },
      { name: 'My Son Sanctuary', order: 4, estimatedOffsetMinutes: 80 },
    ],
    operatingHours: { firstDeparture: '06:30', lastDeparture: '17:30', frequencyMinutes: 90 },
  },
];

export class RouteService {
  static async ensureSampleRoutes() {
    const routeCount = await Route.countDocuments();

    if (routeCount > 0) {
      return;
    }

    await Route.insertMany(sampleRoutes);
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
}

export default RouteService;
