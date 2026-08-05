import mongoose from 'mongoose';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import User from '../auth/User.js';
import PromotionUsage from '../promotions/PromotionUsage.js';

const COMPLETED_STATUSES = new Set(['COMPLETED', 'SUCCESS', 'CONFIRMED', 'FINISHED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'CANCELED']);
const VALID_REVENUE_STATUSES = new Set(['COMPLETED', 'SUCCESS', 'PAID', 'CONFIRMED', 'APPLIED']);
const ON_TIME_THRESHOLD_MINUTES = Number(process.env.ROUTE_ON_TIME_THRESHOLD_MINUTES || 10);
const DEFAULT_VEHICLE_CAPACITY = Number(process.env.DEFAULT_BUS_CAPACITY || 40);

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeStatus = (value, fallback = '') => String(value || fallback).trim().toUpperCase();
const toId = (value) => (value ? String(value._id || value) : null);

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const validDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const dateWithClock = (dateValue, clockValue) => {
  const date = validDate(dateValue);
  const match = /^(\d{2}):(\d{2})$/.exec(String(clockValue || ''));
  if (!date || !match) return null;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
};

const minutesBetween = (start, end) => {
  const startDate = validDate(start);
  const endDate = validDate(end);
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  return (endDate.getTime() - startDate.getTime()) / 60000;
};

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const formatMonthKey = (date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatWeekKey = (date) => {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const periodKey = (date, groupBy) => {
  if (groupBy === 'week') {
    return formatWeekKey(date);
  }

  if (groupBy === 'month') {
    return formatMonthKey(date);
  }

  return formatDateKey(date);
};

const collectionExists = async (name) => {
  if (!mongoose.connection.db) {
    return false;
  }

  const collections = await mongoose.connection.db.listCollections({ name }).toArray();
  return collections.length > 0;
};

const readCollection = async (name, query = {}) => {
  if (!(await collectionExists(name))) {
    return [];
  }

  return mongoose.connection.db.collection(name).find(query).toArray();
};

const buildRouteMap = async () => {
  const routes = await readCollection('routes');
  return new Map(routes.map((route) => {
    const id = toId(route._id);
    const outboundStops = route.outboundRoute?.orderedStops || [];
    const startStation = route.outboundRoute?.startStation || outboundStops[0] || {};
    const endStation = route.outboundRoute?.endStation || outboundStops[outboundStops.length - 1] || {};
    return [id, {
      _id: id,
      name: route.routeName || route.name || route.routeCode || route.routeNumber || route.code || id,
      routeNumber: route.routeCode || route.routeNumber || route.code || '',
      distanceKm: toNumber(route.outboundRoute?.estimatedDistanceKm || route.distanceKm || route.distance || route.lengthKm),
      status: route.status || 'UNKNOWN',
      startPoint: startStation.stopName || route.startPoint || route.origin || route.from || '',
      endPoint: endStation.stopName || route.endPoint || route.destination || route.to || '',
    }];
  }));
};

const buildVehicleMap = async () => {
  const [vehicles, fleetBuses] = await Promise.all([
    readCollection('vehicles'),
    readCollection('fleetbuses'),
  ]);
  const allVehicles = [...vehicles, ...fleetBuses];
  return new Map(allVehicles.map((vehicle) => [
    toId(vehicle._id),
    {
      capacity: toNumber(vehicle.capacity || vehicle.seatCapacity || vehicle.totalSeats, DEFAULT_VEHICLE_CAPACITY),
      label: vehicle.licensePlate || vehicle.code || vehicle.name || toId(vehicle._id),
    },
  ]));
};

const buildScheduleMap = async () => {
  const [schedules, tripSchedules] = await Promise.all([
    readCollection('schedules'),
    readCollection('tripschedules'),
  ]);
  const allSchedules = [...schedules, ...tripSchedules];
  return new Map(allSchedules.map((schedule) => [
    toId(schedule._id),
    {
      scheduledStart: schedule.scheduledStart || schedule.startTime || dateWithClock(schedule.serviceDate, schedule.departureTime),
      scheduledEnd: schedule.scheduledEnd || schedule.endTime || dateWithClock(schedule.serviceDate, schedule.expectedArrivalTime || schedule.arrivalTime),
      durationMinutes: toNumber(schedule.durationMinutes || schedule.expectedDuration),
    },
  ]));
};

const readTravelHistory = async () => {
  const users = await User.find(
    { 'travelHistory.0': { $exists: true } },
    { travelHistory: 1 }
  ).lean();

  return users.flatMap((user) => user.travelHistory || []);
};

const buildSyntheticTrips = (travelHistory) => {
  const groups = new Map();

  travelHistory.forEach((entry) => {
    const date = validDate(entry.boardedAt);
    if (!date) {
      return;
    }

    const hourKey = date.toISOString().slice(0, 13);
    const routeKey = entry.routeId || entry.routeNumber || 'unassigned';
    const vehicleKey = entry.vehicleId || entry.vehicleLabel || 'unknown';
    const key = `${routeKey}-${vehicleKey}-${hourKey}`;
    const current = groups.get(key) || {
      _id: key,
      routeId: entry.routeId ? String(entry.routeId) : null,
      routeName: entry.routeName || entry.routeNumber || 'Unassigned route',
      vehicleId: entry.vehicleId ? String(entry.vehicleId) : null,
      driverId: entry.driverId ? String(entry.driverId) : null,
      status: 'COMPLETED',
      actualStart: date,
      actualEnd: new Date(date.getTime() + (toNumber(entry.travelTimeMinutes, 45) * 60000)),
      scheduledStart: date,
      scheduledEnd: new Date(date.getTime() + (toNumber(entry.scheduledTravelTimeMinutes, 40) * 60000)),
      passengerCount: 0,
      revenue: 0,
      synthetic: true,
    };

    current.passengerCount += 1;
    current.revenue += toNumber(entry.fare);
    groups.set(key, current);
  });

  return [...groups.values()];
};

const loadTrips = async ({ routeMap, vehicleMap, scheduleMap, travelHistory }) => {
  const [tripDocuments, tripSchedules] = await Promise.all([
    readCollection('trips'),
    readCollection('tripschedules'),
  ]);
  const linkedScheduleIds = new Set(tripDocuments.map((trip) => toId(trip.scheduleId)).filter(Boolean));
  const unlinkedSchedules = tripSchedules.filter((schedule) => !linkedScheduleIds.has(toId(schedule._id)));
  const storedTrips = [...tripDocuments, ...unlinkedSchedules];
  const sourceTrips = storedTrips.length ? storedTrips : buildSyntheticTrips(travelHistory);

  return sourceTrips.map((trip) => {
    const routeId = toId(trip.routeId || trip.route?._id);
    const vehicleId = toId(trip.vehicleId || trip.vehicle?.busId || trip.vehicle?._id);
    const driverId = toId(trip.driverId || trip.driver?.userId || trip.driver?._id);
    const schedule = scheduleMap.get(toId(trip.scheduleId)) || {};
    const vehicle = vehicleMap.get(vehicleId) || {};
    const route = routeMap.get(routeId) || {};
    const actualStart = validDate(trip.actualStart || trip.actualStartAt || trip.actualStartTime || trip.actualDepartureTime || trip.startedAt);
    const actualEnd = validDate(trip.actualEnd || trip.actualEndAt || trip.actualEndTime || trip.actualArrivalTime || trip.completedAt);
    const scheduledStart = validDate(
      trip.scheduledStart || trip.plannedStartTime || trip.scheduledDepartureTime || schedule.scheduledStart
      || dateWithClock(trip.serviceDate, trip.departureTime)
    );
    const scheduledEnd = validDate(
      trip.scheduledEnd || trip.plannedEndTime || trip.scheduledArrivalTime || schedule.scheduledEnd
      || dateWithClock(trip.serviceDate, trip.expectedArrivalTime)
    );
    const scheduledTravelTime = toNumber(
      trip.scheduledTravelTimeMinutes
      || trip.expectedDuration
      || schedule.durationMinutes
      || minutesBetween(scheduledStart, scheduledEnd)
    );
    const travelTime = toNumber(
      trip.travelTimeMinutes || trip.durationMinutes || minutesBetween(actualStart, actualEnd)
    );
    const delayMinutes = Math.max(
      0,
      toNumber(
        trip.delayMinutes
        || trip.delayTime
        || minutesBetween(scheduledStart, actualStart)
        || (travelTime && scheduledTravelTime ? travelTime - scheduledTravelTime : 0)
      )
    );

    return {
      _id: toId(trip._id),
      routeId,
      routeName: trip.routeName || trip.routeCode || trip.route?.name || route.name || 'Unassigned route',
      vehicleId,
      driverId,
      date: actualStart || scheduledStart || validDate(trip.createdAt),
      status: normalizeStatus(trip.status, 'COMPLETED'),
      passengerCount: toNumber(trip.passengerCount || trip.boardedPassengers),
      vehicleCapacity: toNumber(
        trip.vehicleCapacity || trip.capacity || trip.vehicle?.capacity || vehicle.capacity,
        DEFAULT_VEHICLE_CAPACITY
      ),
      travelTime,
      scheduledTravelTime,
      delayMinutes,
      distanceKm: toNumber(trip.distanceKm || route.distanceKm),
      revenue: toNumber(trip.revenue),
      cost: toNumber(trip.operatingCost || trip.cost),
    };
  }).filter((trip) => trip.date);
};

const loadPassengerCounts = async () => {
  const [boardingRecords, validations, tickets, walkInTickets] = await Promise.all([
    readCollection('boardingrecords'),
    readCollection('ticketvalidations'),
    readCollection('tickets'),
    readCollection('walkintickets'),
  ]);
  const validatedRecords = boardingRecords.length
    ? boardingRecords
    : validations.length
      ? validations
      : tickets.filter((ticket) => ['VALIDATED', 'USED', 'COMPLETED'].includes(normalizeStatus(ticket.status)));
  const records = [
    ...validatedRecords,
    ...walkInTickets.filter((ticket) => normalizeStatus(ticket.status) === 'COMPLETED'),
  ];
  const byTrip = new Map();

  records.forEach((record) => {
    const tripId = toId(record.tripId || record.trip?._id);
    if (!tripId) {
      return;
    }

    byTrip.set(tripId, (byTrip.get(tripId) || 0) + toNumber(record.passengerCount || record.passengerQuantity || record.quantity, 1));
  });

  return byTrip;
};

const loadRevenue = async (startDate, endDate) => {
  const transactions = await readCollection('transactions');
  const byTrip = new Map();
  const byRoute = new Map();

  if (transactions.length) {
    transactions.forEach((transaction) => {
      const status = normalizeStatus(transaction.status || transaction.paymentStatus);
      const transactionDate = validDate(
        transaction.completedAt || transaction.paidAt || transaction.createdAt
      );
      if (
        !VALID_REVENUE_STATUSES.has(status)
        || !transactionDate
        || transactionDate < startDate
        || transactionDate > endDate
      ) {
        return;
      }

      const amount = toNumber(
        transaction.finalAmount
        || transaction.netAmount
        || transaction.amount
        || transaction.totalAmount
      );
      const tripId = toId(transaction.tripId || transaction.trip?._id);
      const routeId = toId(transaction.routeId || transaction.route?._id || transaction.ticket?.routeId);
      if (tripId) {
        byTrip.set(tripId, (byTrip.get(tripId) || 0) + amount);
      } else if (routeId) {
        byRoute.set(routeId, (byRoute.get(routeId) || 0) + amount);
      }
    });

    return { byTrip, byRoute };
  }

  const usages = await PromotionUsage.find({
    status: 'APPLIED',
    usedAt: { $gte: startDate, $lte: endDate },
  }).lean();
  usages.forEach((usage) => {
    const routeId = toId(usage.routeId);
    if (routeId) {
      byRoute.set(routeId, (byRoute.get(routeId) || 0) + toNumber(usage.finalAmount));
    }
  });

  return { byTrip, byRoute };
};

const loadIncidents = async (startDate, endDate) => {
  const incidents = await readCollection('incidentreports');
  const byRoute = new Map();
  const byTrip = new Map();

  incidents.forEach((incident) => {
    const incidentDate = validDate(incident.reportedAt || incident.occurredAt || incident.createdAt);
    if (!incidentDate || incidentDate < startDate || incidentDate > endDate) {
      return;
    }

    const routeId = toId(incident.routeId || incident.route?._id);
    const tripId = toId(incident.tripId || incident.trip?._id);
    if (tripId) {
      byTrip.set(tripId, (byTrip.get(tripId) || 0) + 1);
    } else if (routeId) {
      byRoute.set(routeId, (byRoute.get(routeId) || 0) + 1);
    }
  });

  return { byRoute, byTrip };
};

const loadAnalyticsData = async (query) => {
  const startDate = startOfDay(query.startDate);
  const endDate = endOfDay(query.endDate);
  const [routeMap, vehicleMap, scheduleMap, travelHistory] = await Promise.all([
    buildRouteMap(),
    buildVehicleMap(),
    buildScheduleMap(),
    readTravelHistory(),
  ]);
  const [trips, passengerCounts, revenue, incidents] = await Promise.all([
    loadTrips({ routeMap, vehicleMap, scheduleMap, travelHistory }),
    loadPassengerCounts(),
    loadRevenue(startDate, endDate),
    loadIncidents(startDate, endDate),
  ]);

  const filteredTrips = trips.filter((trip) => {
    if (trip.date < startDate || trip.date > endDate) {
      return false;
    }
    if (query.routeId && trip.routeId !== String(query.routeId)) {
      return false;
    }
    if (query.vehicleId && trip.vehicleId !== String(query.vehicleId)) {
      return false;
    }
    if (query.driverId && trip.driverId !== String(query.driverId)) {
      return false;
    }
    return true;
  }).map((trip) => {
    const passengerCount = passengerCounts.get(trip._id) ?? trip.passengerCount;
    const tripRevenue = revenue.byTrip.get(trip._id) ?? trip.revenue;
    const hasCommercialActivity = passengerCount > 0 || tripRevenue > 0;

    return {
      ...trip,
      // A sold/validated ticket proves that this assignment was operated even
      // when its operational status was not closed correctly by the dispatcher.
      // Keep cancelled trips excluded under all circumstances.
      status: hasCommercialActivity && !CANCELLED_STATUSES.has(trip.status)
        ? 'COMPLETED'
        : trip.status,
      passengerCount,
      revenue: tripRevenue,
      incidentCount: incidents.byTrip.get(trip._id) || 0,
    };
  });

  return {
    routeMap,
    trips: filteredTrips,
    routeRevenue: revenue.byRoute,
    routeIncidents: incidents.byRoute,
  };
};

const aggregateRoutes = ({ routeMap, trips, routeRevenue, routeIncidents }) => {
  const grouped = new Map();

  trips.forEach((trip) => {
    const key = trip.routeId || trip.routeName;
    const route = routeMap.get(trip.routeId) || {};
    const current = grouped.get(key) || {
      routeId: trip.routeId,
      routeName: trip.routeName || route.name || 'Unassigned route',
      distanceKm: toNumber(route.distanceKm || trip.distanceKm),
      totalTrips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      totalPassengers: 0,
      totalRevenue: 0,
      totalTravelTime: 0,
      totalDelay: 0,
      onTimeTrips: 0,
      occupancyTotal: 0,
      cost: 0,
      incidentCount: 0,
    };

    current.totalTrips += 1;
    if (CANCELLED_STATUSES.has(trip.status)) {
      current.cancelledTrips += 1;
    } else if (COMPLETED_STATUSES.has(trip.status)) {
      current.completedTrips += 1;
      current.totalPassengers += trip.passengerCount;
      current.totalRevenue += trip.revenue;
      current.totalTravelTime += trip.travelTime;
      current.totalDelay += trip.delayMinutes;
      current.cost += trip.cost;
      current.incidentCount += trip.incidentCount;
      current.occupancyTotal += trip.vehicleCapacity
        ? clamp((trip.passengerCount / trip.vehicleCapacity) * 100)
        : 0;
      if (trip.delayMinutes <= ON_TIME_THRESHOLD_MINUTES) {
        current.onTimeTrips += 1;
      }
    }

    grouped.set(key, current);
  });

  grouped.forEach((route) => {
    if (route.routeId) {
      route.totalRevenue += routeRevenue.get(route.routeId) || 0;
      route.incidentCount += routeIncidents.get(route.routeId) || 0;
    }
  });

  const routes = [...grouped.values()];
  const maxRevenuePerKm = Math.max(
    ...routes.map((route) => {
      const operatedDistanceKm = route.distanceKm * route.completedTrips;
      return operatedDistanceKm ? route.totalRevenue / operatedDistanceKm : 0;
    }),
    1
  );
  const maxPassengers = Math.max(...routes.map((route) => route.totalPassengers), 1);

  return routes.map((route) => {
    const denominator = route.completedTrips || 1;
    const averageOccupancy = route.occupancyTotal / denominator;
    const onTimePerformance = (route.onTimeTrips / denominator) * 100;
    const operatedDistanceKm = route.distanceKm * route.completedTrips;
    const revenuePerKm = operatedDistanceKm ? route.totalRevenue / operatedDistanceKm : 0;
    const occupancyScore = clamp(averageOccupancy) * 0.3;
    const onTimeScore = clamp(onTimePerformance) * 0.3;
    const revenueScore = clamp((revenuePerKm / maxRevenuePerKm) * 100) * 0.15;
    const passengerScore = clamp((route.totalPassengers / maxPassengers) * 100) * 0.1;
    const incidentPenalty = clamp(route.incidentCount * 3, 0, 15);
    const efficiencyScore = clamp(
      occupancyScore + onTimeScore + revenueScore + passengerScore - incidentPenalty
    );

    return {
      ...route,
      operatedDistanceKm: Number(operatedDistanceKm.toFixed(2)),
      averageOccupancy: Number(averageOccupancy.toFixed(2)),
      onTimePerformance: Number(onTimePerformance.toFixed(2)),
      averageTravelTime: Number((route.totalTravelTime / denominator).toFixed(2)),
      averageDelayTime: Number((route.totalDelay / denominator).toFixed(2)),
      revenuePerKm: Number(revenuePerKm.toFixed(2)),
      costPerKm: route.distanceKm ? Number((route.cost / route.distanceKm).toFixed(2)) : null,
      efficiencyScore: Number(efficiencyScore.toFixed(2)),
      status: efficiencyScore >= 75 ? 'EFFICIENT' : efficiencyScore >= 50 ? 'AVERAGE' : 'LOW_PERFORMANCE',
    };
  }).sort((left, right) => right.efficiencyScore - left.efficiencyScore);
};

const buildTimeSeries = (trips, query) => {
  const groups = new Map();

  trips.filter((trip) => COMPLETED_STATUSES.has(trip.status)).forEach((trip) => {
    const key = query.groupBy === 'route'
      ? trip.routeName
      : periodKey(trip.date, query.groupBy || 'day');
    const current = groups.get(key) || {
      period: key,
      trips: 0,
      occupancyTotal: 0,
      onTimeTrips: 0,
      revenue: 0,
      distanceKm: 0,
      delayTotal: 0,
    };

    current.trips += 1;
    current.occupancyTotal += trip.vehicleCapacity
      ? clamp((trip.passengerCount / trip.vehicleCapacity) * 100)
      : 0;
    current.onTimeTrips += trip.delayMinutes <= ON_TIME_THRESHOLD_MINUTES ? 1 : 0;
    current.revenue += trip.revenue;
    current.distanceKm += trip.distanceKm;
    current.delayTotal += trip.delayMinutes;
    groups.set(key, current);
  });

  return [...groups.values()].map((group) => ({
    period: group.period,
    occupancyRate: Number((group.occupancyTotal / (group.trips || 1)).toFixed(2)),
    onTimePerformance: Number(((group.onTimeTrips / (group.trips || 1)) * 100).toFixed(2)),
    revenuePerKm: group.distanceKm
      ? Number((group.revenue / group.distanceKm).toFixed(2))
      : 0,
    averageDelayTime: Number((group.delayTotal / (group.trips || 1)).toFixed(2)),
  })).sort((left, right) => left.period.localeCompare(right.period));
};

const buildOverview = (data, query) => {
  const routes = aggregateRoutes(data);
  const completedTrips = data.trips.filter((trip) => COMPLETED_STATUSES.has(trip.status));
  const timeSeries = buildTimeSeries(data.trips, query);
  const totalPassengers = routes.reduce((total, route) => total + route.totalPassengers, 0);
  const totalRevenue = routes.reduce((total, route) => total + route.totalRevenue, 0);
  const average = (field) => routes.length
    ? routes.reduce((total, route) => total + toNumber(route[field]), 0) / routes.length
    : 0;
  const totalOperatedDistanceKm = routes.reduce(
    (total, route) => total + toNumber(route.operatedDistanceKm),
    0
  );

  return {
    totalRoutes: routes.length,
    totalTrips: data.trips.length,
    totalPassengers,
    totalRevenue,
    averageOccupancyRate: Number(average('averageOccupancy').toFixed(2)),
    averageDelayTime: Number(average('averageDelayTime').toFixed(2)),
    onTimePerformanceRate: Number(average('onTimePerformance').toFixed(2)),
    averageTravelTime: Number(average('averageTravelTime').toFixed(2)),
    revenuePerKm: totalOperatedDistanceKm
      ? Number((totalRevenue / totalOperatedDistanceKm).toFixed(2))
      : 0,
    costPerKm: routes.some((route) => route.costPerKm !== null)
      ? Number(average('costPerKm').toFixed(2))
      : null,
    routeEfficiencyScore: Number(average('efficiencyScore').toFixed(2)),
    occupancyRateOverTime: timeSeries.map((item) => ({
      period: item.period,
      occupancyRate: item.occupancyRate,
    })),
    onTimePerformanceOverTime: timeSeries.map((item) => ({
      period: item.period,
      onTimePerformance: item.onTimePerformance,
    })),
    revenuePerKmOverTime: timeSeries.map((item) => ({
      period: item.period,
      revenuePerKm: item.revenuePerKm,
      averageDelayTime: item.averageDelayTime,
    })),
    routePerformanceTable: routes,
    topEfficientRoutes: routes.slice(0, 5),
    lowPerformanceRoutes: [...routes]
      .sort((left, right) => left.efficiencyScore - right.efficiencyScore)
      .slice(0, 5),
    completedOperationalTrips: completedTrips.length,
  };
};

const buildRouteDetail = (data, routeId, query) => {
  const overview = buildOverview(data, query);
  const route = overview.routePerformanceTable.find((item) => item.routeId === String(routeId));

  if (!route) {
    throw new CustomError('Route analytics not found', HTTP_STATUS.NOT_FOUND);
  }

  const routeInfo = data.routeMap.get(String(routeId)) || {
    _id: String(routeId),
    name: route.routeName,
    distanceKm: route.distanceKm,
  };
  const routeTrips = data.trips.filter((trip) => trip.routeId === String(routeId));
  const peakGroups = new Map();

  routeTrips.filter((trip) => COMPLETED_STATUSES.has(trip.status)).forEach((trip) => {
    const hour = `${String(trip.date.getHours()).padStart(2, '0')}:00`;
    peakGroups.set(hour, (peakGroups.get(hour) || 0) + trip.passengerCount);
  });

  return {
    routeInfo,
    totalTrips: route.totalTrips,
    completedTrips: route.completedTrips,
    cancelledTrips: route.cancelledTrips,
    averageTravelTime: route.averageTravelTime,
    averageDelayTime: route.averageDelayTime,
    passengerVolume: route.totalPassengers,
    occupancyRate: route.averageOccupancy,
    totalRevenue: route.totalRevenue,
    revenuePerKm: route.revenuePerKm,
    peakHourDemand: [...peakGroups.entries()]
      .map(([hour, passengerCount]) => ({ hour, passengerCount }))
      .sort((left, right) => right.passengerCount - left.passengerCount)
      .slice(0, 5),
    incidentCount: route.incidentCount,
    efficiencyScore: route.efficiencyScore,
    performanceTrend: buildTimeSeries(routeTrips, query),
  };
};

const logAudit = async ({ action, actorId, metadata }) => {
  try {
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) {
      return;
    }

    await AuditLog.create({
      action,
      actorId,
      entityType: 'RouteEfficiencyAnalytics',
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Analytics remain available if optional audit logging fails.
  }
};

export class RouteEfficiencyService {
  static async getRouteEfficiency(query, actor) {
    const data = await loadAnalyticsData(query);
    const analytics = buildOverview(data, query);

    await logAudit({
      action: 'ROUTE_EFFICIENCY_ANALYTICS_VIEWED',
      actorId: actor?.userId,
      metadata: { filters: query },
    });

    return analytics;
  }

  static async getRouteEfficiencyDetail(routeId, query, actor) {
    const data = await loadAnalyticsData({ ...query, routeId });
    const analytics = buildRouteDetail(data, routeId, query);

    await logAudit({
      action: 'ROUTE_EFFICIENCY_DETAIL_VIEWED',
      actorId: actor?.userId,
      metadata: { routeId, filters: query },
    });

    return analytics;
  }
}

export default RouteEfficiencyService;
