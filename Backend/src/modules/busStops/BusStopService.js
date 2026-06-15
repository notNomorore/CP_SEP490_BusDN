import axios from 'axios';
import { config } from '../../config/environment.js';
import RouteStation from '../admin/RouteStation.js';
import {
  createStation,
  createSyncLog,
  findDuplicateStation,
  findRouteIndexByStation,
  findStationById,
  findStations,
  updateStation,
} from './bus-stop.repository.js';
import { extractStopArray, mapExternalStopToStation, mapStationToBusStop } from './bus-stop.mapper.js';
import { csvEscape } from './bus-stop.utils.js';
import { validateImportedStop, validateListQuery } from './bus-stop.schema.js';

const normalizeRouteId = (value) => String(value || '').trim();
const normalizeSource = (value) => {
  const source = String(value || 'DANABUS').trim().toUpperCase();
  return ['DANABUS', 'ECOBUS', 'PUBLIC_API', 'MANUAL'].includes(source) ? source : 'PUBLIC_API';
};

const buildRoutesForStation = (station, routeMapByStation) => {
  const indexedRoutes = routeMapByStation.get(String(station._id)) || [];
  const assignedRoutes = (station.routeAssignments || [])
    .map((assignment) => ({
      id: String(assignment.routeId || ''),
      routeId: String(assignment.routeId || ''),
      routeCode: assignment.routeCode,
      routeName: assignment.routeName,
      direction: assignment.direction,
    }))
    .filter((route) => route.routeId);
  const routes = [...indexedRoutes];

  assignedRoutes.forEach((route) => {
    if (!routes.some((item) => item.routeId === route.routeId && item.direction === route.direction)) {
      routes.push(route);
    }
  });

  return routes;
};

export const listBusStops = async (query = {}) => {
  const filters = validateListQuery(query);
  const [stations, routeMapByStation] = await Promise.all([
    findStations(filters),
    findRouteIndexByStation(),
  ]);
  const routeFilter = normalizeRouteId(filters.routeId).toLowerCase();

  return stations
    .map((station) => mapStationToBusStop(station, buildRoutesForStation(station, routeMapByStation)))
    .filter((stop) => {
      if (!routeFilter) {
        return true;
      }

      return stop.routes.some((route) => (
        route.routeId?.toLowerCase() === routeFilter
        || route.routeCode?.toLowerCase() === routeFilter
      ));
    });
};

export const getBusStopById = async (id) => {
  const [station, routeMapByStation] = await Promise.all([
    findStationById(id),
    findRouteIndexByStation(),
  ]);

  if (!station) {
    const error = new Error('Bus stop not found');
    error.statusCode = 404;
    throw error;
  }

  return mapStationToBusStop(station, buildRoutesForStation(station, routeMapByStation));
};

const geocodeAddress = async (address) => {
  if (!config.googleMaps.apiKey) {
    const error = new Error('GOOGLE_MAPS_API_KEY is missing. Enter latitude and longitude manually or configure the API key.');
    error.statusCode = 400;
    throw error;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', `${address}, Da Nang, Vietnam`);
  url.searchParams.set('key', config.googleMaps.apiKey);
  url.searchParams.set('language', 'vi');
  url.searchParams.set('region', 'vn');

  const response = await fetch(url);
  const payload = await response.json();
  const location = payload.results?.[0]?.geometry?.location;

  if (!response.ok || payload.status !== 'OK' || !location) {
    const error = new Error(`Unable to geocode address: ${payload.error_message || payload.status || response.statusText}`);
    error.statusCode = 400;
    throw error;
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
  };
};

const parseGoogleAddressComponent = (components, types) => components.find((component) => (
  types.some((type) => component.types?.includes(type))
))?.long_name || '';

export const searchStopAddresses = async (query) => {
  const text = String(query || '').trim();
  if (text.length < 3) return [];

  if (config.googleMaps.apiKey) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', `${text}, Đà Nẵng, Việt Nam`);
    url.searchParams.set('key', config.googleMaps.apiKey);
    url.searchParams.set('language', 'vi');
    url.searchParams.set('region', 'vn');
    url.searchParams.set('bounds', '15.95,107.95|16.25,108.35');
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const payload = await response.json();
    if (!response.ok || !['OK', 'ZERO_RESULTS'].includes(payload.status)) {
      throw Object.assign(new Error(payload.error_message || 'Không thể tìm kiếm địa chỉ.'), { statusCode: 502 });
    }
    return (payload.results || []).slice(0, 6).map((result) => ({
      id: result.place_id,
      displayName: result.formatted_address,
      address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      district: parseGoogleAddressComponent(result.address_components || [], ['administrative_area_level_2']),
      ward: parseGoogleAddressComponent(result.address_components || [], ['sublocality_level_1', 'administrative_area_level_3']),
      source: 'GOOGLE',
    }));
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${text}, Đà Nẵng, Việt Nam`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'vn');
  url.searchParams.set('viewbox', '107.95,16.25,108.35,15.95');
  url.searchParams.set('bounded', '1');
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BusDN/1.0 (admin stop address search)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Object.assign(new Error('Không thể tìm kiếm địa chỉ trên bản đồ.'), { statusCode: 502 });
  const payload = await response.json();
  return payload.map((result) => ({
    id: String(result.place_id),
    displayName: result.display_name,
    address: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    district: result.address?.city_district || result.address?.district || result.address?.county || '',
    ward: result.address?.suburb || result.address?.quarter || result.address?.neighbourhood || result.address?.village || '',
    source: 'OPENSTREETMAP',
  }));
};

const resolveRouteAssignment = async ({ routeId, direction }) => {
  if (!routeId) {
    return [];
  }

  const BusRoute = (await import('../admin/BusRoute.js')).default;
  const route = await BusRoute.findById(routeId).select('_id routeCode routeName').lean();
  if (!route) {
    const error = new Error('Route not found for bus stop assignment');
    error.statusCode = 400;
    throw error;
  }

  return [{
    routeId: route._id,
    routeCode: route.routeCode,
    routeName: route.routeName,
    direction: direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
  }];
};

const normalizeStopPayload = async (payload) => {
  const name = payload.name || payload.stopName || payload.stationName;
  const address = payload.address;
  let latitude = Number(payload.latitude);
  let longitude = Number(payload.longitude);

  if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && address) {
    const geocoded = await geocodeAddress(address);
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
  }

  const validation = validateImportedStop({
    stationCode: payload.stationCode
      || payload.stopCode
      || `STOP${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    stationName: name,
    address,
    latitude,
    longitude,
    district: payload.district || '',
    ward: payload.ward || '',
    zone: payload.zone || '',
    source: payload.source || 'MANUAL',
    sourceId: payload.sourceId,
    isActive: payload.isActive,
  });

  if (!validation.success) {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.errors = validation.errors;
    throw error;
  }

  return {
    ...validation.data,
    routeAssignments: await resolveRouteAssignment({
      routeId: payload.routeId,
      direction: payload.direction,
    }),
  };
};

export const createBusStop = async (payload) => {
  const stop = await normalizeStopPayload(payload);
  const station = new RouteStation(stop);
  await station.save();
  return station.toObject();
};

export const updateBusStop = async (stopId, payload) => {
  const existing = await RouteStation.findById(stopId).lean();
  if (!existing) {
    const error = new Error('Bus stop not found');
    error.statusCode = 404;
    throw error;
  }

  const stop = await normalizeStopPayload({
    stationCode: existing.stationCode,
    stationName: existing.stationName,
    address: existing.address,
    latitude: existing.latitude,
    longitude: existing.longitude,
    district: existing.district,
    ward: existing.ward,
    zone: existing.zone,
    source: existing.source,
    sourceId: existing.sourceId,
    isActive: existing.isActive,
    ...payload,
  });

  if (!payload.routeId) {
    stop.routeAssignments = existing.routeAssignments || [];
  }

  const updated = await RouteStation.findByIdAndUpdate(
    stopId,
    { $set: stop },
    { new: true, runValidators: true }
  ).lean();

  return updated;
};

export const deleteBusStop = async (stopId) => {
  const deleted = await RouteStation.findByIdAndDelete(stopId).lean();
  if (!deleted) {
    const error = new Error('Bus stop not found');
    error.statusCode = 404;
    throw error;
  }
  return deleted;
};

const hasStationChanged = (existing, stop) => (
  existing.stationName !== stop.stationName
  || existing.address !== stop.address
  || Number(existing.latitude) !== Number(stop.latitude)
  || Number(existing.longitude) !== Number(stop.longitude)
  || (existing.district || '') !== (stop.district || '')
  || (existing.ward || '') !== (stop.ward || '')
);

const fetchConfiguredStops = async (apiUrl) => {
  if (!apiUrl) {
    const error = new Error('DANABUS_STOP_API_URL is not configured. Set it to the DanaBus/EcoBus public stop endpoint.');
    error.statusCode = 400;
    throw error;
  }

  try {
    if (/GetListBusStop/i.test(apiUrl)) {
      const pageSize = 200;
      const stops = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;

      while (stops.length < total) {
        const response = await axios.get(apiUrl, {
          timeout: config.danabus.requestTimeoutMs,
          headers: {
            Accept: 'application/json',
          },
          params: {
            page,
            size: pageSize,
            search: '',
          },
        });
        const pageStops = extractStopArray(response.data);

        if (!pageStops.length) {
          break;
        }

        stops.push(...pageStops);
        total = Number(response.data?.meta?.count_all || stops.length);
        page += 1;
      }

      return stops;
    }

    const response = await axios.get(apiUrl, {
      timeout: config.danabus.requestTimeoutMs,
      headers: {
        Accept: 'application/json',
      },
    });

    return extractStopArray(response.data);
  } catch (error) {
    const serviceError = new Error(`DanaBus/EcoBus API is unavailable: ${error.response?.status || error.code || error.message}`);
    serviceError.statusCode = 502;
    throw serviceError;
  }
};

export const importBusStops = async ({
  stops,
  apiUrl = config.danabus.stopApiUrl,
  source = 'DANABUS',
} = {}) => {
  const startedAt = new Date();
  const normalizedSource = normalizeSource(source);
  let rawStops = [];
  try {
    rawStops = Array.isArray(stops) ? stops : await fetchConfiguredStops(apiUrl);
  } catch (error) {
    await createSyncLog({
      source: normalizedSource,
      sourceUrl: apiUrl || '',
      status: 'FAILED',
      totalFetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [{ index: 0, message: error.message }],
      startedAt,
      finishedAt: new Date(),
    });
    throw error;
  }
  const result = {
    totalFetched: rawStops.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, rawStop] of rawStops.entries()) {
    try {
      const mappedStop = mapExternalStopToStation(rawStop, normalizedSource);
      if (!mappedStop.sourceId && mappedStop.stationCode?.startsWith('DNB')) {
        mappedStop.stationCode = `DNB${String(index + 1).padStart(5, '0')}`;
      }
      const validation = validateImportedStop(mappedStop);

      if (!validation.success) {
        result.skipped += 1;
        result.errors.push({
          index: index + 1,
          sourceId: mappedStop.sourceId || '',
          stopCode: mappedStop.stationCode || '',
          message: Object.values(validation.errors).join('; '),
        });
        continue;
      }

      const stop = validation.data;
      const duplicate = await findDuplicateStation(stop);

      if (duplicate) {
        if (hasStationChanged(duplicate, stop)) {
          await updateStation(duplicate._id, stop);
          result.updated += 1;
        } else {
          result.skipped += 1;
        }
        continue;
      }

      await createStation(stop);
      result.created += 1;
    } catch (error) {
      result.skipped += 1;
      result.errors.push({
        index: index + 1,
        sourceId: rawStop?.id || rawStop?.sourceId || rawStop?.stopId || '',
        stopCode: rawStop?.stopCode || rawStop?.code || '',
        message: error.message,
      });
    }
  }

  const status = result.errors.length === result.totalFetched && result.totalFetched > 0
    ? 'FAILED'
    : result.errors.length
      ? 'PARTIAL_SUCCESS'
      : 'SUCCESS';

  await createSyncLog({
    source: normalizedSource,
    sourceUrl: apiUrl || '',
    status,
    ...result,
    startedAt,
    finishedAt: new Date(),
  });

  return result;
};

export const exportBusStopsCsv = async (query = {}) => {
  const stops = await listBusStops(query);
  const rows = [
    ['stop_code', 'stop_name', 'address', 'latitude', 'longitude', 'district', 'ward', 'routes', 'source'],
    ...stops.map((stop) => [
      stop.stopCode,
      stop.stopName,
      stop.address,
      stop.latitude,
      stop.longitude,
      stop.district,
      stop.ward,
      (stop.routes || []).map((route) => route.routeCode || route.routeName).filter(Boolean).join('|'),
      stop.source,
    ]),
  ];

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
};

export default {
  listBusStops,
  getBusStopById,
  createBusStop,
  updateBusStop,
  deleteBusStop,
  importBusStops,
  exportBusStopsCsv,
};
