import Route from './Route.js';
import BusRoute from '../admin/BusRoute.js';

const sampleRoutes = [
  {
    routeNumber: 'DN01',
    name: 'Da Nang Central - My Khe Beach',
    origin: 'Da Nang Central',
    destination: 'My Khe Beach',
    distanceKm: 12,
    estimatedDurationMinutes: 25,
    fare: 15000,
    stops: [
      {
        name: 'Da Nang Central',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Han Market',
        order: 2,
        estimatedOffsetMinutes: 14,
        latitude: 16.0681,
        longitude: 108.2245,
      },
      {
        name: 'Dragon Bridge',
        order: 3,
        estimatedOffsetMinutes: 18,
        latitude: 16.0614,
        longitude: 108.2272,
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
    origin: 'Da Nang Central',
    destination: 'Hoa Khanh',
    distanceKm: 14,
    estimatedDurationMinutes: 35,
    fare: 15000,
    stops: [
      {
        name: 'Da Nang Central',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Lien Chieu',
        order: 2,
        estimatedOffsetMinutes: 22,
        latitude: 16.0737,
        longitude: 108.1502,
      },
      {
        name: 'Hoa Khanh',
        order: 3,
        estimatedOffsetMinutes: 35,
        latitude: 16.0750,
        longitude: 108.1428,
      },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0684, longitude: 108.1661 },
      { latitude: 16.0702, longitude: 108.1629 },
      { latitude: 16.0719, longitude: 108.1595 },
      { latitude: 16.0731, longitude: 108.1563 },
      { latitude: 16.0737, longitude: 108.1502 },
      { latitude: 16.0742, longitude: 108.1468 },
      { latitude: 16.0750, longitude: 108.1428 },
    ],
    operatingHours: { firstDeparture: '05:45', lastDeparture: '20:30', frequencyMinutes: 25 },
  },
  {
    routeNumber: 'DN03',
    name: 'Da Nang Central - Son Tra',
    origin: 'Da Nang Central',
    destination: 'Son Tra',
    distanceKm: 17,
    estimatedDurationMinutes: 35,
    fare: 25000,
    stops: [
      {
        name: 'Da Nang Central',
        order: 1,
        estimatedOffsetMinutes: 0,
        latitude: 16.0667,
        longitude: 108.1690,
      },
      {
        name: 'Dragon Bridge',
        order: 2,
        estimatedOffsetMinutes: 10,
        latitude: 16.0614,
        longitude: 108.2272,
      },
      {
        name: 'Vo Nguyen Giap Beach Road',
        order: 3,
        estimatedOffsetMinutes: 20,
        latitude: 16.0700,
        longitude: 108.2470,
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
      { latitude: 16.0658, longitude: 108.1845 },
      { latitude: 16.0643, longitude: 108.1995 },
      { latitude: 16.0626, longitude: 108.2145 },
      { latitude: 16.0614, longitude: 108.2272 },
      { latitude: 16.0610, longitude: 108.2388 },
      { latitude: 16.0617, longitude: 108.2470 },
      { latitude: 16.0738, longitude: 108.2486 },
      { latitude: 16.0860, longitude: 108.2514 },
      { latitude: 16.0975, longitude: 108.2562 },
      { latitude: 16.1080, longitude: 108.2660 },
      { latitude: 16.1085, longitude: 108.2725 },
      { latitude: 16.1005, longitude: 108.2773 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '20:30', frequencyMinutes: 30 },
  },
  {
    routeNumber: 'DN04',
    name: 'Da Nang Central - Marble Mountains',
    origin: 'Da Nang Central',
    destination: 'Marble Mountains',
    distanceKm: 16,
    estimatedDurationMinutes: 35,
    fare: 20000,
    stops: [
      {
        name: 'Da Nang Central',
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
  {
    routeNumber: 'DN05',
    name: 'Da Nang Airport - My Khe Beach',
    origin: 'Da Nang International Airport',
    destination: 'My Khe Beach',
    distanceKm: 8,
    estimatedDurationMinutes: 22,
    fare: 15000,
    stops: [
      { name: 'Da Nang International Airport', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0544, longitude: 108.2022 },
      { name: 'Dragon Bridge', order: 2, estimatedOffsetMinutes: 9, latitude: 16.0614, longitude: 108.2272 },
      { name: 'An Thuong', order: 3, estimatedOffsetMinutes: 17, latitude: 16.0480, longitude: 108.2430 },
      { name: 'My Khe Beach', order: 4, estimatedOffsetMinutes: 22, latitude: 16.0544, longitude: 108.2478 },
    ],
    pathPoints: [
      { latitude: 16.0544, longitude: 108.2022 },
      { latitude: 16.0560, longitude: 108.2100 },
      { latitude: 16.0586, longitude: 108.2180 },
      { latitude: 16.0614, longitude: 108.2272 },
      { latitude: 16.0588, longitude: 108.2340 },
      { latitude: 16.0535, longitude: 108.2405 },
      { latitude: 16.0480, longitude: 108.2430 },
      { latitude: 16.0544, longitude: 108.2478 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '22:00', frequencyMinutes: 20 },
  },
  {
    routeNumber: 'DN06',
    name: 'Han Market - Son Tra Night Market',
    origin: 'Han Market',
    destination: 'Son Tra Night Market',
    distanceKm: 6,
    estimatedDurationMinutes: 18,
    fare: 10000,
    stops: [
      { name: 'Han Market', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0681, longitude: 108.2245 },
      { name: 'Han River Bridge', order: 2, estimatedOffsetMinutes: 5, latitude: 16.0712, longitude: 108.2240 },
      { name: 'Dragon Bridge East', order: 3, estimatedOffsetMinutes: 12, latitude: 16.0610, longitude: 108.2325 },
      { name: 'Son Tra Night Market', order: 4, estimatedOffsetMinutes: 18, latitude: 16.0590, longitude: 108.2355 },
    ],
    pathPoints: [
      { latitude: 16.0681, longitude: 108.2245 },
      { latitude: 16.0712, longitude: 108.2240 },
      { latitude: 16.0710, longitude: 108.2290 },
      { latitude: 16.0662, longitude: 108.2315 },
      { latitude: 16.0610, longitude: 108.2325 },
      { latitude: 16.0590, longitude: 108.2355 },
    ],
    operatingHours: { firstDeparture: '06:00', lastDeparture: '22:30', frequencyMinutes: 15 },
  },
  {
    routeNumber: 'DN07',
    name: 'Da Nang Central - University Village',
    origin: 'Da Nang Central',
    destination: 'University Village',
    distanceKm: 13,
    estimatedDurationMinutes: 32,
    fare: 15000,
    stops: [
      { name: 'Da Nang Central', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0667, longitude: 108.1690 },
      { name: 'Da Nang Airport', order: 2, estimatedOffsetMinutes: 12, latitude: 16.0544, longitude: 108.2022 },
      { name: 'Duy Tan University', order: 3, estimatedOffsetMinutes: 22, latitude: 16.0603, longitude: 108.2094 },
      { name: 'University Village', order: 4, estimatedOffsetMinutes: 32, latitude: 16.0475, longitude: 108.2175 },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0632, longitude: 108.1840 },
      { latitude: 16.0588, longitude: 108.1932 },
      { latitude: 16.0544, longitude: 108.2022 },
      { latitude: 16.0603, longitude: 108.2094 },
      { latitude: 16.0550, longitude: 108.2140 },
      { latitude: 16.0475, longitude: 108.2175 },
    ],
    operatingHours: { firstDeparture: '05:45', lastDeparture: '21:30', frequencyMinutes: 25 },
  },
  {
    routeNumber: 'DN08',
    name: 'Da Nang Central - Nam O Beach',
    origin: 'Da Nang Central',
    destination: 'Nam O Beach',
    distanceKm: 17,
    estimatedDurationMinutes: 40,
    fare: 20000,
    stops: [
      { name: 'Da Nang Central', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0667, longitude: 108.1690 },
      { name: 'Lien Chieu', order: 2, estimatedOffsetMinutes: 18, latitude: 16.0737, longitude: 108.1502 },
      { name: 'Hoa Khanh', order: 3, estimatedOffsetMinutes: 26, latitude: 16.0750, longitude: 108.1428 },
      { name: 'Nam O Beach', order: 4, estimatedOffsetMinutes: 40, latitude: 16.1147, longitude: 108.1307 },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0713, longitude: 108.1510 },
      { latitude: 16.0750, longitude: 108.1428 },
      { latitude: 16.0860, longitude: 108.1385 },
      { latitude: 16.0980, longitude: 108.1340 },
      { latitude: 16.1147, longitude: 108.1307 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '20:30', frequencyMinutes: 30 },
  },
  {
    routeNumber: 'DN09',
    name: 'Dragon Bridge - Hoa Xuan Stadium',
    origin: 'Dragon Bridge',
    destination: 'Hoa Xuan Stadium',
    distanceKm: 10,
    estimatedDurationMinutes: 26,
    fare: 15000,
    stops: [
      { name: 'Dragon Bridge', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0614, longitude: 108.2272 },
      { name: 'Asia Park', order: 2, estimatedOffsetMinutes: 9, latitude: 16.0386, longitude: 108.2264 },
      { name: 'Cam Le District', order: 3, estimatedOffsetMinutes: 18, latitude: 16.0175, longitude: 108.2125 },
      { name: 'Hoa Xuan Stadium', order: 4, estimatedOffsetMinutes: 26, latitude: 16.0172, longitude: 108.2298 },
    ],
    pathPoints: [
      { latitude: 16.0614, longitude: 108.2272 },
      { latitude: 16.0530, longitude: 108.2270 },
      { latitude: 16.0440, longitude: 108.2268 },
      { latitude: 16.0386, longitude: 108.2264 },
      { latitude: 16.0300, longitude: 108.2190 },
      { latitude: 16.0175, longitude: 108.2125 },
      { latitude: 16.0172, longitude: 108.2298 },
    ],
    operatingHours: { firstDeparture: '06:00', lastDeparture: '21:00', frequencyMinutes: 25 },
  },
  {
    routeNumber: 'DN10',
    name: 'Han Market - Tien Sa Port',
    origin: 'Han Market',
    destination: 'Tien Sa Port',
    distanceKm: 12,
    estimatedDurationMinutes: 32,
    fare: 20000,
    stops: [
      { name: 'Han Market', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0681, longitude: 108.2245 },
      { name: 'Thuan Phuoc Bridge East', order: 2, estimatedOffsetMinutes: 14, latitude: 16.0920, longitude: 108.2325 },
      { name: 'Son Tra District Center', order: 3, estimatedOffsetMinutes: 23, latitude: 16.1010, longitude: 108.2395 },
      { name: 'Tien Sa Port', order: 4, estimatedOffsetMinutes: 32, latitude: 16.1180, longitude: 108.2510 },
    ],
    pathPoints: [
      { latitude: 16.0681, longitude: 108.2245 },
      { latitude: 16.0760, longitude: 108.2255 },
      { latitude: 16.0845, longitude: 108.2290 },
      { latitude: 16.0920, longitude: 108.2325 },
      { latitude: 16.1010, longitude: 108.2395 },
      { latitude: 16.1100, longitude: 108.2460 },
      { latitude: 16.1180, longitude: 108.2510 },
    ],
    operatingHours: { firstDeparture: '06:00', lastDeparture: '20:00', frequencyMinutes: 35 },
  },
  {
    routeNumber: 'DN11',
    name: 'Airport - Hoa Cam',
    origin: 'Da Nang International Airport',
    destination: 'Hoa Cam',
    distanceKm: 9,
    estimatedDurationMinutes: 24,
    fare: 15000,
    stops: [
      { name: 'Da Nang International Airport', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0544, longitude: 108.2022 },
      { name: 'Nguyen Huu Tho', order: 2, estimatedOffsetMinutes: 8, latitude: 16.0405, longitude: 108.2056 },
      { name: 'Cam Le Bridge', order: 3, estimatedOffsetMinutes: 16, latitude: 16.0260, longitude: 108.2050 },
      { name: 'Hoa Cam', order: 4, estimatedOffsetMinutes: 24, latitude: 16.0121, longitude: 108.1795 },
    ],
    pathPoints: [
      { latitude: 16.0544, longitude: 108.2022 },
      { latitude: 16.0470, longitude: 108.2040 },
      { latitude: 16.0405, longitude: 108.2056 },
      { latitude: 16.0260, longitude: 108.2050 },
      { latitude: 16.0200, longitude: 108.1920 },
      { latitude: 16.0121, longitude: 108.1795 },
    ],
    operatingHours: { firstDeparture: '05:45', lastDeparture: '21:00', frequencyMinutes: 25 },
  },
  {
    routeNumber: 'DN12',
    name: 'Da Nang Central - APEC Park',
    origin: 'Da Nang Central',
    destination: 'APEC Park',
    distanceKm: 10,
    estimatedDurationMinutes: 25,
    fare: 15000,
    stops: [
      { name: 'Da Nang Central', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0667, longitude: 108.1690 },
      { name: 'Han Market', order: 2, estimatedOffsetMinutes: 10, latitude: 16.0681, longitude: 108.2245 },
      { name: 'Museum of Cham Sculpture', order: 3, estimatedOffsetMinutes: 18, latitude: 16.0603, longitude: 108.2232 },
      { name: 'APEC Park', order: 4, estimatedOffsetMinutes: 25, latitude: 16.0549, longitude: 108.2238 },
    ],
    pathPoints: [
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0630, longitude: 108.1840 },
      { latitude: 16.0645, longitude: 108.1985 },
      { latitude: 16.0670, longitude: 108.2120 },
      { latitude: 16.0681, longitude: 108.2245 },
      { latitude: 16.0603, longitude: 108.2232 },
      { latitude: 16.0549, longitude: 108.2238 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '22:00', frequencyMinutes: 20 },
  },
  {
    routeNumber: 'DN13',
    name: 'My Khe Beach - Non Nuoc Beach',
    origin: 'My Khe Beach',
    destination: 'Non Nuoc Beach',
    distanceKm: 11,
    estimatedDurationMinutes: 27,
    fare: 15000,
    stops: [
      { name: 'My Khe Beach', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0544, longitude: 108.2478 },
      { name: 'An Thuong', order: 2, estimatedOffsetMinutes: 7, latitude: 16.0480, longitude: 108.2430 },
      { name: 'Marble Mountains', order: 3, estimatedOffsetMinutes: 20, latitude: 16.0037, longitude: 108.2642 },
      { name: 'Non Nuoc Beach', order: 4, estimatedOffsetMinutes: 27, latitude: 15.9927, longitude: 108.2718 },
    ],
    pathPoints: [
      { latitude: 16.0544, longitude: 108.2478 },
      { latitude: 16.0480, longitude: 108.2430 },
      { latitude: 16.0380, longitude: 108.2490 },
      { latitude: 16.0260, longitude: 108.2560 },
      { latitude: 16.0037, longitude: 108.2642 },
      { latitude: 15.9927, longitude: 108.2718 },
    ],
    operatingHours: { firstDeparture: '06:00', lastDeparture: '21:30', frequencyMinutes: 20 },
  },
  {
    routeNumber: 'DN14',
    name: 'Han Market - Hoa Xuan',
    origin: 'Han Market',
    destination: 'Hoa Xuan',
    distanceKm: 12,
    estimatedDurationMinutes: 30,
    fare: 15000,
    stops: [
      { name: 'Han Market', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0681, longitude: 108.2245 },
      { name: 'Dragon Bridge', order: 2, estimatedOffsetMinutes: 8, latitude: 16.0614, longitude: 108.2272 },
      { name: 'Tran Thi Ly Bridge', order: 3, estimatedOffsetMinutes: 16, latitude: 16.0494, longitude: 108.2290 },
      { name: 'Hoa Xuan', order: 4, estimatedOffsetMinutes: 30, latitude: 16.0105, longitude: 108.2305 },
    ],
    pathPoints: [
      { latitude: 16.0681, longitude: 108.2245 },
      { latitude: 16.0614, longitude: 108.2272 },
      { latitude: 16.0540, longitude: 108.2280 },
      { latitude: 16.0494, longitude: 108.2290 },
      { latitude: 16.0360, longitude: 108.2298 },
      { latitude: 16.0220, longitude: 108.2302 },
      { latitude: 16.0105, longitude: 108.2305 },
    ],
    operatingHours: { firstDeparture: '05:45', lastDeparture: '21:00', frequencyMinutes: 25 },
  },
  {
    routeNumber: 'DN15',
    name: 'Hoa Khanh - Dragon Bridge',
    origin: 'Hoa Khanh',
    destination: 'Dragon Bridge',
    distanceKm: 15,
    estimatedDurationMinutes: 36,
    fare: 15000,
    stops: [
      { name: 'Hoa Khanh', order: 1, estimatedOffsetMinutes: 0, latitude: 16.0750, longitude: 108.1428 },
      { name: 'Lien Chieu', order: 2, estimatedOffsetMinutes: 10, latitude: 16.0737, longitude: 108.1502 },
      { name: 'Da Nang Central', order: 3, estimatedOffsetMinutes: 18, latitude: 16.0667, longitude: 108.1690 },
      { name: 'Dragon Bridge', order: 4, estimatedOffsetMinutes: 36, latitude: 16.0614, longitude: 108.2272 },
    ],
    pathPoints: [
      { latitude: 16.0750, longitude: 108.1428 },
      { latitude: 16.0737, longitude: 108.1502 },
      { latitude: 16.0667, longitude: 108.1690 },
      { latitude: 16.0655, longitude: 108.1840 },
      { latitude: 16.0640, longitude: 108.2000 },
      { latitude: 16.0625, longitude: 108.2140 },
      { latitude: 16.0614, longitude: 108.2272 },
    ],
    operatingHours: { firstDeparture: '05:30', lastDeparture: '21:30', frequencyMinutes: 25 },
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
    await Route.deleteMany({ routeNumber: /^DN-DEMO/i });

    for (const route of sampleRoutes) {
      await Route.updateOne(
        { routeNumber: route.routeNumber },
        { $set: route },
        { upsert: true }
      );
    }
  }

  static buildSearchQuery({ q, from, to }) {
    const andConditions = [
      { status: 'ACTIVE' },
      { routeNumber: { $not: /^DN-DEMO/i } },
    ];

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

  static buildManagedSearchQuery({ q, from, to }) {
    const andConditions = [{ status: 'PUBLISHED' }];

    if (q) {
      const searchRegex = new RegExp(q.trim(), 'i');
      andConditions.push({
        $or: [
          { routeCode: searchRegex },
          { routeName: searchRegex },
          { 'outboundRoute.orderedStops.stopName': searchRegex },
          { 'inboundRoute.orderedStops.stopName': searchRegex },
          { 'outboundRoute.startStation.stopName': searchRegex },
          { 'outboundRoute.endStation.stopName': searchRegex },
        ],
      });
    }

    if (from) {
      const fromRegex = new RegExp(from.trim(), 'i');
      andConditions.push({
        $or: [
          { 'outboundRoute.startStation.stopName': fromRegex },
          { 'outboundRoute.orderedStops.stopName': fromRegex },
        ],
      });
    }

    if (to) {
      const toRegex = new RegExp(to.trim(), 'i');
      andConditions.push({
        $or: [
          { 'outboundRoute.endStation.stopName': toRegex },
          { 'outboundRoute.orderedStops.stopName': toRegex },
        ],
      });
    }

    return { $and: andConditions };
  }

  static async searchRoutes(params) {
    await this.ensureSampleRoutes();

    const query = this.buildSearchQuery(params);
    const managedQuery = this.buildManagedSearchQuery(params);
    const [routes, managedRoutes] = await Promise.all([
      Route.find(query)
        .sort({ routeNumber: 1 })
        .limit(50)
        .lean(),
      BusRoute.find(managedQuery)
        .sort({ routeCode: 1 })
        .limit(50)
        .lean(),
    ]);

    return [
      ...managedRoutes.map((route) => this.formatManagedRoute(route)),
      ...routes.map((route) => this.formatRoute(route)),
    ];
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

  static formatManagedRoute(route) {
    const outboundStops = route.outboundRoute?.orderedStops || [];
    const startStation = route.outboundRoute?.startStation || outboundStops[0] || {};
    const endStation = route.outboundRoute?.endStation || outboundStops[outboundStops.length - 1] || {};

    return {
      id: route._id,
      routeNumber: route.routeCode,
      name: route.routeName,
      origin: startStation.stopName || '',
      destination: endStation.stopName || '',
      stops: outboundStops.map((stop, index) => ({
        name: stop.stopName,
        order: stop.stopOrder || index + 1,
        estimatedOffsetMinutes: stop.arrivalOffsetMinutes || index * 6,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
      distanceKm: route.outboundRoute?.estimatedDistanceKm || 0,
      estimatedDurationMinutes: route.outboundRoute?.estimatedDurationMinutes || 0,
      fare: route.fareConfig?.baseFare || 0,
      operatingHours: {
        firstDeparture: route.scheduleConfig?.firstDepartureTime || '05:30',
        lastDeparture: route.scheduleConfig?.lastDepartureTime || '21:00',
        frequencyMinutes: route.scheduleConfig?.frequencyMinutes || 30,
      },
      pathPoints: route.outboundRoute?.polylinePath || [],
      status: 'ACTIVE',
      source: 'MANAGED_ROUTE',
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

    const [legacyRoutes, managedRoutes] = await Promise.all([
      Route.find({ status: 'ACTIVE' }).sort({ routeNumber: 1 }).lean(),
      BusRoute.find({ status: 'PUBLISHED' }).sort({ routeCode: 1 }).lean(),
    ]);
    const routes = [
      ...managedRoutes.map((route) => this.formatManagedRoute(route)),
      ...legacyRoutes.map((route) => this.formatRoute(route)),
    ];
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
              id: route.id,
              routeNumber: route.routeNumber,
              name: route.name,
              origin: route.origin,
              destination: route.destination,
              distanceKm: route.distanceKm,
              estimatedDurationMinutes: route.estimatedDurationMinutes,
              fare: route.fare,
            },
          });

          suggestedRouteMap.set(String(route.id), route);
        }
      }
    }

    nearbyStops.sort((first, second) => first.distanceKm - second.distanceKm);

    const nearestStopByRoute = new Map();

    for (const stop of nearbyStops) {
      const routeId = String(stop.route.id);

      if (!nearestStopByRoute.has(routeId)) {
        nearestStopByRoute.set(routeId, stop);
      }
    }

    return {
      userLocation,
      radiusKm: maxDistanceKm,
      nearbyStops: Array.from(nearestStopByRoute.values()).slice(0, 10),
      routes: Array.from(suggestedRouteMap.values()),
    };
  }

  static findMatchingStop(route, keyword) {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return route.stops.find((stop) => (
      stop.name.toLowerCase().includes(normalizedKeyword)
    ));
  }

  static normalizePreference(preference) {
    const allowedPreferences = ['fastest', 'shortest', 'lowest-cost', 'least-traffic'];

    return allowedPreferences.includes(preference) ? preference : 'fastest';
  }

  static calculateBestRouteScore(route, startStop, endStop, preference = 'fastest') {
    const stopTravelMinutes = Math.max(
      endStop.estimatedOffsetMinutes - startStop.estimatedOffsetMinutes,
      0
    );
    const stopSpan = Math.max(endStop.order - startStop.order, 1);
    const routeStopCount = Math.max(route.stops.length - 1, 1);
    const estimatedDistanceKm = Number(
      ((route.distanceKm / routeStopCount) * stopSpan).toFixed(2)
    );
    const estimatedFare = Math.max(Math.round((route.fare / routeStopCount) * stopSpan), route.fare * 0.35);
    const travelTime = stopTravelMinutes || route.estimatedDurationMinutes;
    const distance = estimatedDistanceKm || route.distanceKm;
    const fareWeight = estimatedFare / 1000;
    const scoreMap = {
      fastest: travelTime + distance * 0.25 + fareWeight * 0.05,
      shortest: distance + travelTime * 0.08 + fareWeight * 0.03,
      'lowest-cost': fareWeight + distance * 0.12 + travelTime * 0.05,
      'least-traffic': travelTime * 0.85 + distance * 0.35 + route.stops.length * 1.5,
    };

    return {
      estimatedDurationMinutes: travelTime,
      estimatedDistanceKm: distance,
      estimatedFare,
      score: scoreMap[preference] || scoreMap.fastest,
    };
  }

  static async findBestRoute({ from, to, preference = 'fastest' }) {
    await this.ensureSampleRoutes();

    if (!from?.trim() || !to?.trim()) {
      throw new Error('Departure and destination are required');
    }

    const normalizedPreference = this.normalizePreference(preference);
    const [legacyRoutes, managedRoutes] = await Promise.all([
      Route.find({ status: 'ACTIVE' }).sort({ routeNumber: 1 }).lean(),
      BusRoute.find({ status: 'PUBLISHED' }).sort({ routeCode: 1 }).lean(),
    ]);
    const routes = [
      ...managedRoutes.map((route) => this.formatManagedRoute(route)),
      ...legacyRoutes.map((route) => this.formatRoute(route)),
    ];
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

      const optimization = this.calculateBestRouteScore(
        route,
        startStop,
        endStop,
        normalizedPreference
      );

      candidates.push({
        route: this.formatRoute(route),
        startStop,
        endStop,
        estimatedDurationMinutes: optimization.estimatedDurationMinutes,
        estimatedDistanceKm: optimization.estimatedDistanceKm,
        estimatedFare: optimization.estimatedFare,
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
        preference: normalizedPreference,
        optimizedBy: {
          fastest: 'shortest travel time',
          shortest: 'shortest distance',
          'lowest-cost': 'lowest estimated fare',
          'least-traffic': 'least traffic congestion',
        }[normalizedPreference],
      },
    };
  }

  static async suggestRouteOptions({ from, to, preference = 'fastest' }) {
    const result = await this.findBestRoute({ from, to, preference });
    const suggestions = [
      ...(result.bestRoute ? [{ ...result.bestRoute, isRecommended: true }] : []),
      ...result.alternatives.map((alternative) => ({
        ...alternative,
        isRecommended: false,
      })),
    ];

    return {
      departureLocation: from,
      destinationLocation: to,
      transportationType: 'bus',
      suggestions,
      count: suggestions.length,
      totalMatches: result.count,
      criteria: result.criteria,
      bestRoute: result.bestRoute,
      alternatives: result.alternatives,
    };
  }

  static interpolatePathPosition(pathPoints, progress) {
    const normalizedProgress = Math.max(0, Math.min(progress, 0.999));
    const segmentCount = Math.max(pathPoints.length - 1, 1);
    const rawIndex = normalizedProgress * segmentCount;
    const startIndex = Math.floor(rawIndex);
    const endIndex = Math.min(startIndex + 1, pathPoints.length - 1);
    const segmentProgress = rawIndex - startIndex;
    const start = pathPoints[startIndex];
    const end = pathPoints[endIndex];

    return {
      latitude: Number((start.latitude + (end.latitude - start.latitude) * segmentProgress).toFixed(6)),
      longitude: Number((start.longitude + (end.longitude - start.longitude) * segmentProgress).toFixed(6)),
    };
  }

  static findNextStop(route, progress) {
    const stops = route.stops || [];
    const stopCount = Math.max(stops.length - 1, 1);
    const nextStopIndex = Math.min(Math.ceil(progress * stopCount), stops.length - 1);

    return stops[nextStopIndex] || stops[stops.length - 1] || null;
  }

  static buildStopId(route, stop) {
    const normalizedName = stop.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${route.routeNumber}-${stop.order}-${normalizedName}`;
  }

  static calculateStopEtas(route, progress, status) {
    const duration = route.estimatedDurationMinutes || 30;
    const trafficMultiplier = status === 'Delayed' ? 1.25 : 1;

    return (route.stops || []).map((stop) => {
      const stopProgress = Math.min((stop.estimatedOffsetMinutes || 0) / duration, 1);
      const minutesUntilArrival = Math.round((stopProgress - progress) * duration * trafficMultiplier);
      const hasPassed = minutesUntilArrival < 0;
      const etaMinutes = hasPassed ? null : Math.max(minutesUntilArrival, 1);

      return {
        stopId: this.buildStopId(route, stop),
        stopName: stop.name,
        stopOrder: stop.order,
        etaMinutes,
        estimatedArrivalTime: etaMinutes ? `${etaMinutes} min` : 'Passed',
        status: hasPassed ? 'Passed' : status,
      };
    });
  }

  static calculateTripProgress(route, progress, busId, status) {
    const duration = route.estimatedDurationMinutes || 30;
    const stops = route.stops || [];
    const completedStops = stops.filter((stop) => (
      Math.min((stop.estimatedOffsetMinutes || 0) / duration, 1) <= progress
    ));
    const remainingStops = stops.filter((stop) => (
      Math.min((stop.estimatedOffsetMinutes || 0) / duration, 1) > progress
    ));
    const estimatedRemainingMinutes = Math.max(Math.round((1 - progress) * duration), 1);
    const progressPercent = Math.min(Math.round(progress * 100), 99);
    const tripStatus = progressPercent >= 97 ? 'Completed' : status;

    return {
      tripId: `${route.routeNumber}-TRIP-${busId.split('-').pop()}`,
      busId,
      routeId: String(route._id),
      progressPercent,
      completedStops: completedStops.map((stop) => ({
        stopId: this.buildStopId(route, stop),
        stopName: stop.name,
        stopOrder: stop.order,
      })),
      remainingStops: remainingStops.map((stop) => ({
        stopId: this.buildStopId(route, stop),
        stopName: stop.name,
        stopOrder: stop.order,
      })),
      tripStatus,
      estimatedRemainingMinutes,
      estimatedRemainingTime: `${estimatedRemainingMinutes} min`,
      currentStop: completedStops[completedStops.length - 1]?.name || route.origin,
      nextStop: remainingStops[0]?.name || route.destination,
    };
  }

  static async getLiveBusLocations(routeId) {
    await this.ensureSampleRoutes();

    let route = await Route.findOne({ routeNumber: routeId, status: 'ACTIVE' }).lean();

    if (!route) {
      try {
        route = await Route.findOne({ _id: routeId, status: 'ACTIVE' }).lean();
      } catch {
        route = null;
      }
    }

    if (!route) {
      throw new Error('Bus not found');
    }

    const pathPoints = route.pathPoints?.length ? route.pathPoints : route.stops;

    if (!pathPoints?.length || pathPoints.length < 2) {
      return {
        route: this.formatRoute(route),
        buses: [],
        message: 'Live location unavailable',
        refreshedAt: new Date().toISOString(),
      };
    }

    const now = Date.now();
    const cycleMs = Math.max(route.estimatedDurationMinutes || 30, 10) * 60 * 1000;
    const busOffsets = [0, 0.48];
    const buses = busOffsets.map((offset, index) => {
      const progress = ((now % cycleMs) / cycleMs + offset) % 1;
      const currentLocation = this.interpolatePathPosition(pathPoints, progress);
      const nextStop = this.findNextStop(route, progress);
      const status = index === 1 && progress > 0.82 ? 'Delayed' : 'Running';
      const busId = `${route.routeNumber}-BUS-${index + 1}`;
      const remainingMinutes = Math.max(
        Math.round((1 - progress) * (route.estimatedDurationMinutes || 30)),
        1
      );
      const arrivalToNextStopMinutes = nextStop
        ? Math.max(Math.round(((nextStop.estimatedOffsetMinutes || 0) / (route.estimatedDurationMinutes || 30) - progress) * (route.estimatedDurationMinutes || 30)), 1)
        : remainingMinutes;
      const stopEtas = this.calculateStopEtas(route, progress, status);
      const tripProgress = this.calculateTripProgress(route, progress, busId, status);
      const delayDurationMinutes = status === 'Delayed'
        ? Math.max(Math.round((progress - 0.82) * (route.estimatedDurationMinutes || 30)) + 5, 5)
        : 0;

      return {
        busId,
        routeId: String(route._id),
        routeNumber: route.routeNumber,
        currentLocation,
        estimatedArrivalTime: `${Math.max(arrivalToNextStopMinutes, 1)} min`,
        nextStop: nextStop?.name || route.destination,
        stopEtas,
        tripProgress,
        status,
        delay: status === 'Delayed' ? {
          delayDurationMinutes,
          delayReason: 'Traffic congestion',
          updatedEta: `${Math.max(arrivalToNextStopMinutes + delayDurationMinutes, 1)} min`,
        } : null,
        lastUpdated: new Date(now).toISOString(),
      };
    });
    const stopEtaSummary = (route.stops || []).map((stop) => {
      const activeEtas = buses
        .map((bus) => bus.stopEtas.find((eta) => eta.stopOrder === stop.order))
        .filter((eta) => eta && typeof eta.etaMinutes === 'number')
        .sort((first, second) => first.etaMinutes - second.etaMinutes);

      return {
        stopId: this.buildStopId(route, stop),
        stopName: stop.name,
        stopOrder: stop.order,
        nextBusId: activeEtas[0] ? buses.find((bus) => (
          bus.stopEtas.some((eta) => eta.stopId === activeEtas[0].stopId && eta.etaMinutes === activeEtas[0].etaMinutes)
        ))?.busId : null,
        etaMinutes: activeEtas[0]?.etaMinutes || null,
        estimatedArrivalTime: activeEtas[0]?.estimatedArrivalTime || 'ETA unavailable',
        status: activeEtas[0]?.status || 'Unavailable',
      };
    });
    const routeChange = this.getRouteChangeNotice(route);

    return {
      route: this.formatRoute(route),
      buses,
      stopEtaSummary,
      routeChange,
      count: buses.length,
      refreshedAt: new Date(now).toISOString(),
    };
  }

  static getRouteChangeNotice(route) {
    const routeChangeNotices = {
      DN03: {
        changeId: 'DN03-son-tra-maintenance',
        tripId: `${route.routeNumber}-TRIP-01`,
        reasonForChange: 'Road maintenance near Vo Nguyen Giap Beach Road',
        changedStops: [
          { stopName: 'Vo Nguyen Giap Beach Road', changeType: 'TEMPORARY_DELAY' },
          { stopName: 'Linh Ung Pagoda', changeType: 'UPDATED_ARRIVAL_PATH' },
        ],
        updatedRoutePath: 'Buses use the coastal road and may slow down near Son Tra during maintenance.',
        alternativeSuggestion: 'Board at Dragon Bridge or check ETA before going to Linh Ung Pagoda.',
        status: 'ACTIVE',
      },
      DN10: {
        changeId: 'DN10-port-event-detour',
        tripId: `${route.routeNumber}-TRIP-02`,
        reasonForChange: 'Temporary traffic control near Tien Sa Port',
        changedStops: [
          { stopName: 'Son Tra District Center', changeType: 'MODIFIED' },
          { stopName: 'Tien Sa Port', changeType: 'TEMPORARY_DELAY' },
        ],
        updatedRoutePath: 'Route may use a short detour near the port entrance during traffic control.',
        alternativeSuggestion: 'Use Son Tra District Center as the safer boarding point during the change.',
        status: 'ACTIVE',
      },
    };

    const notice = routeChangeNotices[route.routeNumber];

    if (!notice) {
      return null;
    }

    return {
      routeId: String(route._id),
      routeNumber: route.routeNumber,
      ...notice,
      detectedAt: new Date().toISOString(),
    };
  }

  static async getEstimatedArrivalTimes(routeId) {
    const liveResult = await this.getLiveBusLocations(routeId);

    return {
      route: liveResult.route,
      stopEtaSummary: liveResult.stopEtaSummary || [],
      buses: liveResult.buses || [],
      tripProgress: (liveResult.buses || []).map((bus) => bus.tripProgress),
      refreshedAt: liveResult.refreshedAt,
    };
  }
}

export default RouteService;
