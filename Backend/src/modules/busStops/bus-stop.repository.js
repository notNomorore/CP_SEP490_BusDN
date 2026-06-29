import RouteStation from '../admin/RouteStation.js';
import BusRoute from '../admin/BusRoute.js';
import BusStopSyncLog from './BusStopSyncLog.js';
import { areSimilarStopNames, haversineDistanceMeters } from './bus-stop.utils.js';

const stationSelect = '_id stationCode stationName address latitude longitude city zone district ward isMainStation isActive source sourceId googlePlaceId routeAssignments createdAt updatedAt';

export const findStations = async ({ search, district, source, isActive } = {}) => {
  const query = { city: /da nang/i };

  if (isActive !== undefined) {
    query.isActive = isActive;
  } else {
    query.isActive = { $ne: false };
  }

  if (district) {
    query.district = new RegExp(district, 'i');
  }

  if (source) {
    query.source = source;
  }

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { stationName: regex },
      { address: regex },
      { stationCode: regex },
      { district: regex },
      { ward: regex },
    ];
  }

  return RouteStation.find(query).select(stationSelect).sort({ stationName: 1 }).lean();
};

export const findStationById = (id) => (
  RouteStation.findById(id).select(stationSelect).lean()
);

export const findRouteIndexByStation = async () => {
  const routes = await BusRoute.find({ status: 'PUBLISHED' })
    .select('_id routeCode routeName outboundRoute inboundRoute status')
    .lean();

  const routeMapByStation = new Map();

  routes.forEach((route) => {
    const routeSummary = {
      id: String(route._id),
      routeId: String(route._id),
      routeCode: route.routeCode,
      routeName: route.routeName,
      status: route.status,
    };

    const collectStop = (stop, direction) => {
      const stationId = String(stop?.stationId || '').trim();
      if (!stationId) {
        return;
      }

      const current = routeMapByStation.get(stationId) || [];
      if (!current.some((item) => item.routeId === routeSummary.routeId && item.direction === direction)) {
        current.push({ ...routeSummary, direction });
      }
      routeMapByStation.set(stationId, current);
    };

    collectStop(route.outboundRoute?.startStation, 'OUTBOUND');
    collectStop(route.outboundRoute?.endStation, 'OUTBOUND');
    collectStop(route.inboundRoute?.startStation, 'INBOUND');
    collectStop(route.inboundRoute?.endStation, 'INBOUND');
    (route.outboundRoute?.orderedStops || []).forEach((stop) => collectStop(stop, 'OUTBOUND'));
    (route.inboundRoute?.orderedStops || []).forEach((stop) => collectStop(stop, 'INBOUND'));
  });

  return routeMapByStation;
};

export const findDuplicateStation = async (stop) => {
  const sourceQueries = [];
  if (stop.sourceId) {
    sourceQueries.push({ source: stop.source, sourceId: stop.sourceId });
  }
  if (stop.stationCode) {
    sourceQueries.push({ stationCode: stop.stationCode });
  }

  if (sourceQueries.length) {
    const exact = await RouteStation.findOne({ $or: sourceQueries }).lean();
    if (exact) {
      return exact;
    }
  }

  const nearby = await RouteStation.find({
    city: /da nang/i,
    latitude: { $gte: stop.latitude - 0.0003, $lte: stop.latitude + 0.0003 },
    longitude: { $gte: stop.longitude - 0.0003, $lte: stop.longitude + 0.0003 },
  }).lean();

  return nearby.find((station) => (
    haversineDistanceMeters(station, stop) <= 20
    && areSimilarStopNames(station.stationName, stop.stationName)
  )) || null;
};

export const createStation = (stop) => {
  const station = new RouteStation(stop);
  return station.save();
};

export const updateStation = (id, stop) => (
  RouteStation.findByIdAndUpdate(
    id,
    {
      $set: {
        stationName: stop.stationName,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        district: stop.district,
        ward: stop.ward,
        zone: stop.zone,
        city: 'Da Nang',
        isActive: stop.isActive,
        source: stop.source,
        sourceId: stop.sourceId,
      },
      $setOnInsert: {
        stationCode: stop.stationCode,
      },
    },
    { new: true, runValidators: true }
  ).lean()
);

export const createSyncLog = (log) => BusStopSyncLog.create(log);

export default {
  findStations,
  findStationById,
  findRouteIndexByStation,
  findDuplicateStation,
  createStation,
  updateStation,
  createSyncLog,
};
