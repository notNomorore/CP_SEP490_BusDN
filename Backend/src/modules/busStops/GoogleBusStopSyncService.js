import config from '../../config/environment.js';
import RouteStation from '../admin/RouteStation.js';

const GOOGLE_PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const DA_NANG_SEARCH_CENTERS = [
  { latitude: 16.0678, longitude: 108.2208 },
  { latitude: 16.0471, longitude: 108.2068 },
  { latitude: 16.0325, longitude: 108.2240 },
  { latitude: 16.0750, longitude: 108.1530 },
  { latitude: 16.0150, longitude: 108.2520 },
  { latitude: 15.9950, longitude: 108.1920 },
  { latitude: 16.1050, longitude: 108.2500 },
  { latitude: 16.0900, longitude: 108.1250 },
];

const normalizePlaceId = (name = '') => {
  const parts = String(name).split('/');
  return parts[parts.length - 1] || name;
};

const makeStationCode = (placeId) => {
  const compact = String(placeId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-10)
    .toUpperCase();

  return `GGM${compact || Date.now().toString().slice(-8)}`;
};

const pickPlaceAddress = (place) => (
  place.formattedAddress
  || place.shortFormattedAddress
  || place.displayName?.text
  || 'Da Nang'
);

const mapGooglePlaceToStation = (place) => {
  const googlePlaceId = normalizePlaceId(place.name || place.id);
  const latitude = Number(place.location?.latitude);
  const longitude = Number(place.location?.longitude);

  if (!googlePlaceId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    stationCode: makeStationCode(googlePlaceId),
    stationName: place.displayName?.text?.trim() || pickPlaceAddress(place),
    address: pickPlaceAddress(place),
    latitude,
    longitude,
    city: 'Da Nang',
    zone: '',
    isMainStation: false,
    isActive: true,
    googlePlaceId,
    source: 'GOOGLE_MAPS',
  };
};

const fetchNearbyStops = async ({ latitude, longitude, radiusMeters }) => {
  const response = await fetch(GOOGLE_PLACES_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googleMaps.apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.name',
        'places.displayName',
        'places.formattedAddress',
        'places.shortFormattedAddress',
        'places.location',
        'places.primaryType',
        'places.types',
      ].join(','),
    },
    body: JSON.stringify({
      includedTypes: ['bus_station', 'transit_station'],
      maxResultCount: 20,
      languageCode: 'vi',
      regionCode: 'VN',
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload.places || [];
};

export const syncGoogleBusStops = async ({ radiusMeters = 6500 } = {}) => {
  if (!config.googleMaps.apiKey) {
    const error = new Error('GOOGLE_MAPS_API_KEY is not configured');
    error.statusCode = 400;
    throw error;
  }

  const placeMap = new Map();

  for (const center of DA_NANG_SEARCH_CENTERS) {
    const places = await fetchNearbyStops({ ...center, radiusMeters });
    places.forEach((place) => {
      const station = mapGooglePlaceToStation(place);
      if (station) {
        placeMap.set(station.googlePlaceId, station);
      }
    });
  }

  const stations = [...placeMap.values()];
  let created = 0;
  let updated = 0;

  for (const station of stations) {
    const existing = await RouteStation.findOne({ googlePlaceId: station.googlePlaceId }).lean();

    await RouteStation.findOneAndUpdate(
      { googlePlaceId: station.googlePlaceId },
      {
        $set: {
          stationName: station.stationName,
          address: station.address,
          latitude: station.latitude,
          longitude: station.longitude,
          city: station.city,
          zone: station.zone,
          isActive: station.isActive,
          source: station.source,
        },
        $setOnInsert: {
          stationCode: station.stationCode,
          googlePlaceId: station.googlePlaceId,
          isMainStation: station.isMainStation,
        },
      },
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    totalFetched: stations.length,
    created,
    updated,
  };
};

export default {
  syncGoogleBusStops,
};
