import mongoose from 'mongoose';
import User from '../auth/User.js';
import { FEEDBACK_CATEGORIES } from './feedbackAnalytics.validators.js';

const RESOLVED_STATUSES = new Set(['RESOLVED', 'CLOSED']);
const UNRESOLVED_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'REJECTED']);
const DETAIL_LIMIT = 100;

const toId = (value) => (value ? String(value._id || value) : '');
const toNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const startOfDay = (value) => {
  const date = value ? new Date(value) : new Date(Date.now() - 30 * 86400000);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = value ? new Date(value) : new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const formatMonthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const formatWeekKey = (date) => {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const periodKey = (date, groupBy) => {
  if (groupBy === 'week') return formatWeekKey(date);
  if (groupBy === 'month') return formatMonthKey(date);
  return formatDateKey(date);
};

const collectionExists = async (name) => {
  if (!mongoose.connection.db) return false;
  const collections = await mongoose.connection.db.listCollections({ name }).toArray();
  return collections.length > 0;
};

const readCollection = async (name, query = {}, projection = {}) => {
  if (!(await collectionExists(name))) return [];
  return mongoose.connection.db.collection(name).find(query).project(projection).toArray();
};

const categoryMap = {
  DELAY: 'punctuality',
  PUNCTUALITY: 'punctuality',
  DRIVER_BEHAVIOR: 'driver_behavior',
  BUS_CLEANLINESS: 'bus_cleanliness',
  CLEANLINESS: 'bus_cleanliness',
  SAFETY: 'safety',
  OVERCROWDING: 'overcrowding',
  PAYMENT: 'ticketing',
  TICKETING: 'ticketing',
  ROUTE_INFORMATION: 'route_information',
  APP_EXPERIENCE: 'app_experience',
  SERVICE_QUALITY: 'other',
  LOST_ITEM: 'other',
  OTHER: 'other',
};

const normalizeCategory = (value) => {
  const key = String(value || 'other').trim().toUpperCase();
  const snake = key.toLowerCase();
  if (FEEDBACK_CATEGORIES.includes(snake)) return snake;
  return categoryMap[key] || 'other';
};

const sentimentFor = (rating, type) => {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  if (rating <= 2 && rating !== null) return 'negative';
  return type === 'COMPLAINT' ? 'negative' : 'unknown';
};

const normalizeStatus = (value) => String(value || 'OPEN').trim().toUpperCase();

const routeLabelFromDoc = (doc) => (
  doc.routeName || doc.name || doc.routeNumber || doc.routeCode || doc.routeId || doc.route || 'Unassigned route'
);

const vehicleLabelFromDoc = (doc) => (
  doc.busPlate || doc.plateNumber || doc.licensePlate || doc.busCode || doc.vehicleCode || doc.vehicleLabel || 'Unassigned vehicle'
);

const normalizeRecord = (doc, source) => {
  const type = String(doc.type || doc.caseType || source).trim().toUpperCase();
  const createdAt = new Date(doc.createdAt || doc.submittedAt || doc.reportedAt || doc.incidentAt || Date.now());
  const rawRating = toNumber(doc.rating ?? doc.score ?? doc.stars ?? doc.satisfactionRating);
  const rating = rawRating && rawRating >= 1 && rawRating <= 5 ? Math.round(rawRating) : null;
  const routeId = toId(doc.routeId || doc.route?._id);
  const driverId = toId(doc.driverId || doc.driver?._id || doc.assignedDriverId);
  const vehicleId = toId(doc.vehicleId || doc.busId || doc.vehicle?._id || doc.bus?._id);
  const status = normalizeStatus(doc.status);

  return {
    id: toId(doc._id),
    source,
    type: type === 'COMPLAINT' ? 'COMPLAINT' : 'FEEDBACK',
    title: doc.title || doc.subject || doc.summary || 'Passenger feedback',
    description: doc.description || doc.message || doc.comment || doc.content || '',
    category: normalizeCategory(doc.category || doc.feedbackCategory),
    rating,
    sentiment: sentimentFor(rating, type),
    status,
    routeId,
    routeName: routeLabelFromDoc(doc),
    driverId,
    driverName: doc.driverName || doc.driver?.fullName || '',
    vehicleId,
    vehicleLabel: vehicleLabelFromDoc(doc),
    tripCode: doc.tripCode || doc.tripId || '',
    passengerId: toId(doc.passenger || doc.passengerId || doc.userId || doc.user?._id),
    createdAt,
    incidentAt: doc.incidentAt || null,
    resolvedAt: doc.resolvedAt || null,
  };
};

const buildLabelMaps = async () => {
  const [routes, busRoutes, vehicles, fleetBuses, drivers] = await Promise.all([
    readCollection('routes', {}, { name: 1, routeNumber: 1, routeName: 1, routeCode: 1 }),
    readCollection('busroutes', {}, { routeName: 1, routeCode: 1 }),
    readCollection('vehicles', {}, { licensePlate: 1, plateNumber: 1, code: 1, vehicleCode: 1, name: 1 }),
    readCollection('fleetbuses', {}, { plateNumber: 1, busCode: 1 }),
    User.find({ role: 'DRIVER' }, { fullName: 1 }).lean(),
  ]);

  const routeMap = new Map();
  [...routes, ...busRoutes].forEach((route) => {
    routeMap.set(toId(route._id), route.routeName || route.name || route.routeCode || route.routeNumber || toId(route._id));
  });

  const vehicleMap = new Map();
  [...vehicles, ...fleetBuses].forEach((vehicle) => {
    vehicleMap.set(toId(vehicle._id), vehicle.plateNumber || vehicle.licensePlate || vehicle.busCode || vehicle.vehicleCode || vehicle.name || toId(vehicle._id));
  });

  const driverMap = new Map(drivers.map((driver) => [toId(driver._id), driver.fullName || toId(driver._id)]));

  return { routeMap, vehicleMap, driverMap };
};

const applyLabels = (records, maps) => records.map((record) => ({
  ...record,
  routeName: record.routeId ? maps.routeMap.get(record.routeId) || record.routeName : record.routeName,
  vehicleLabel: record.vehicleId ? maps.vehicleMap.get(record.vehicleId) || record.vehicleLabel : record.vehicleLabel,
  driverName: record.driverId ? maps.driverMap.get(record.driverId) || record.driverName : record.driverName,
}));

const loadFeedbackRecords = async (filters) => {
  const startDate = startOfDay(filters.from);
  const endDate = endOfDay(filters.to);
  const dateRange = { $gte: startDate, $lte: endDate };
  const query = {
    $or: [
      { createdAt: dateRange },
      { submittedAt: dateRange },
      { reportedAt: dateRange },
      { incidentAt: dateRange },
    ],
  };

  const [supportCases, feedbacks, complaints, maps] = await Promise.all([
    readCollection('supportcases', query),
    readCollection('feedbacks', query),
    readCollection('complaints', query),
    buildLabelMaps(),
  ]);

  const records = [
    ...supportCases
      .filter((item) => ['COMPLAINT', 'FEEDBACK', 'SERVICE_REPORT'].includes(String(item.type || '').toUpperCase()))
      .map((item) => normalizeRecord(item, 'support_case')),
    ...feedbacks.map((item) => normalizeRecord(item, 'feedback')),
    ...complaints.map((item) => normalizeRecord({ ...item, type: 'COMPLAINT' }, 'complaint')),
  ];

  return applyLabels(records, maps).filter((record) => {
    if (record.createdAt < startDate || record.createdAt > endDate) return false;
    if (filters.routeId && record.routeId !== String(filters.routeId)) return false;
    if (filters.driverId && record.driverId !== String(filters.driverId)) return false;
    if (filters.vehicleId && record.vehicleId !== String(filters.vehicleId)) return false;
    if (filters.category && record.category !== filters.category) return false;
    if (filters.rating && record.rating !== Number(filters.rating)) return false;
    return true;
  });
};

const emptyMetrics = () => ({
  totalFeedback: 0,
  ratingSum: 0,
  ratedCount: 0,
  averageRating: 0,
  positiveCount: 0,
  neutralCount: 0,
  negativeCount: 0,
  complaintCount: 0,
  resolvedComplaintCount: 0,
  unresolvedComplaintCount: 0,
  resolutionRate: 0,
});

const addRecord = (metrics, record) => {
  metrics.totalFeedback += 1;
  if (record.rating !== null) {
    metrics.ratingSum += record.rating;
    metrics.ratedCount += 1;
  }
  if (record.sentiment === 'positive') metrics.positiveCount += 1;
  if (record.sentiment === 'neutral') metrics.neutralCount += 1;
  if (record.sentiment === 'negative') metrics.negativeCount += 1;
  if (record.type === 'COMPLAINT') {
    metrics.complaintCount += 1;
    if (RESOLVED_STATUSES.has(record.status)) {
      metrics.resolvedComplaintCount += 1;
    } else if (UNRESOLVED_STATUSES.has(record.status)) {
      metrics.unresolvedComplaintCount += 1;
    }
  }
};

const finalizeMetrics = (metrics) => ({
  totalFeedback: metrics.totalFeedback,
  averageRating: metrics.ratedCount ? Number((metrics.ratingSum / metrics.ratedCount).toFixed(2)) : 0,
  positiveCount: metrics.positiveCount,
  neutralCount: metrics.neutralCount,
  negativeCount: metrics.negativeCount,
  complaintCount: metrics.complaintCount,
  resolvedComplaintCount: metrics.resolvedComplaintCount,
  unresolvedComplaintCount: metrics.unresolvedComplaintCount,
  resolutionRate: metrics.complaintCount
    ? Number(((metrics.resolvedComplaintCount / metrics.complaintCount) * 100).toFixed(2))
    : 0,
});

const groupKeyFor = (record, groupBy) => {
  if (['day', 'week', 'month'].includes(groupBy)) return periodKey(record.createdAt, groupBy);
  if (groupBy === 'route') return record.routeId || record.routeName || 'unassigned';
  if (groupBy === 'driver') return record.driverId || record.driverName || 'unassigned';
  if (groupBy === 'vehicle') return record.vehicleId || record.vehicleLabel || 'unassigned';
  if (groupBy === 'category') return record.category;
  if (groupBy === 'sentiment') return record.sentiment;
  return periodKey(record.createdAt, 'day');
};

const groupLabelFor = (record, groupBy, key) => {
  if (groupBy === 'route') return record.routeName || key;
  if (groupBy === 'driver') return record.driverName || key;
  if (groupBy === 'vehicle') return record.vehicleLabel || key;
  return key;
};

const buildGroups = (records, groupBy) => {
  const grouped = new Map();

  records.forEach((record) => {
    const key = groupKeyFor(record, groupBy);
    const current = grouped.get(key) || {
      key,
      label: groupLabelFor(record, groupBy, key),
      groupBy,
      metrics: emptyMetrics(),
      categoryCounts: new Map(),
    };

    addRecord(current.metrics, record);
    current.categoryCounts.set(record.category, (current.categoryCounts.get(record.category) || 0) + 1);
    grouped.set(key, current);
  });

  return [...grouped.values()].map((group) => ({
    key: group.key,
    label: group.label,
    groupBy: group.groupBy,
    ...finalizeMetrics(group.metrics),
    topCategories: [...group.categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3),
  })).sort((left, right) => String(left.key).localeCompare(String(right.key)));
};

const buildRankings = (records) => {
  const categoryCounts = new Map();
  const routes = new Map();
  const drivers = new Map();

  records.forEach((record) => {
    if (record.type === 'COMPLAINT') {
      categoryCounts.set(record.category, (categoryCounts.get(record.category) || 0) + 1);
    }

    if (record.routeId || record.routeName) {
      const key = record.routeId || record.routeName;
      const current = routes.get(key) || { routeId: record.routeId, routeName: record.routeName, total: 0, ratingSum: 0, ratedCount: 0, negativeCount: 0 };
      current.total += 1;
      if (record.rating !== null) {
        current.ratingSum += record.rating;
        current.ratedCount += 1;
      }
      if (record.sentiment === 'negative') current.negativeCount += 1;
      routes.set(key, current);
    }

    if (record.driverId || record.driverName) {
      const key = record.driverId || record.driverName;
      const current = drivers.get(key) || { driverId: record.driverId, driverName: record.driverName, total: 0, ratingSum: 0, ratedCount: 0, negativeCount: 0 };
      current.total += 1;
      if (record.rating !== null) {
        current.ratingSum += record.rating;
        current.ratedCount += 1;
      }
      if (record.sentiment === 'negative') current.negativeCount += 1;
      drivers.set(key, current);
    }
  });

  const scoreRows = (items, idField, labelField) => [...items.values()]
    .filter((item) => item.ratedCount > 0 || item.negativeCount > 0)
    .map((item) => ({
      [idField]: item[idField] || null,
      [labelField]: item[labelField] || 'Unassigned',
      totalFeedback: item.total,
      averageRating: item.ratedCount ? Number((item.ratingSum / item.ratedCount).toFixed(2)) : 0,
      negativeCount: item.negativeCount,
    }))
    .sort((left, right) => (
      left.averageRating - right.averageRating
      || right.negativeCount - left.negativeCount
      || right.totalFeedback - left.totalFeedback
    ))
    .slice(0, 5);

  return {
    topCategories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    lowestRatedRoutes: scoreRows(routes, 'routeId', 'routeName'),
    lowestRatedDrivers: scoreRows(drivers, 'driverId', 'driverName'),
    repeatedNegativeRoutes: [...routes.values()]
      .filter((route) => route.negativeCount >= 2)
      .map((route) => ({
        routeId: route.routeId || null,
        routeName: route.routeName || 'Unassigned route',
        negativeCount: route.negativeCount,
        totalFeedback: route.total,
      }))
      .sort((left, right) => right.negativeCount - left.negativeCount)
      .slice(0, 8),
  };
};

const matchesGroup = (record, groupBy, groupKey) => {
  if (!groupKey) return true;
  return groupKeyFor(record, groupBy) === String(groupKey);
};

const displayNameMap = async (records) => {
  const ids = [...new Set(records
    .map((record) => record.passengerId)
    .filter((id) => id && mongoose.isValidObjectId(id)))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids } }, { fullName: 1 }).lean();
  return new Map(users.map((user) => [toId(user._id), user.fullName || 'Passenger']));
};

const sanitizeRecord = (record, names) => ({
  id: record.id,
  type: record.type,
  title: record.title,
  description: record.description,
  category: record.category,
  rating: record.rating,
  sentiment: record.sentiment,
  status: record.status,
  routeId: record.routeId || null,
  routeName: record.routeName,
  driverId: record.driverId || null,
  driverName: record.driverName,
  vehicleId: record.vehicleId || null,
  vehicleLabel: record.vehicleLabel,
  tripCode: record.tripCode,
  passenger: record.passengerId ? { displayName: names.get(record.passengerId) || 'Passenger' } : null,
  createdAt: record.createdAt,
  incidentAt: record.incidentAt,
  resolvedAt: record.resolvedAt,
});

const logAudit = async ({ action, actorId, metadata }) => {
  try {
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) return;
    await AuditLog.create({
      action,
      actorId,
      entityType: 'FeedbackAnalytics',
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Analytics must not fail because optional audit logging is unavailable.
  }
};

export class FeedbackAnalyticsService {
  static async getFeedbackAnalytics(filters = {}, actor) {
    const groupBy = filters.groupBy || 'day';
    const records = await loadFeedbackRecords(filters);
    const metrics = emptyMetrics();
    records.forEach((record) => addRecord(metrics, record));
    const rankings = buildRankings(records);

    await logAudit({
      action: 'FEEDBACK_ANALYTICS_VIEWED',
      actorId: actor?.userId,
      metadata: { filters },
    });

    return {
      summary: {
        ...finalizeMetrics(metrics),
        topCategories: rankings.topCategories,
        lowestRatedRoutes: rankings.lowestRatedRoutes,
        lowestRatedDrivers: rankings.lowestRatedDrivers,
        repeatedNegativeRoutes: rankings.repeatedNegativeRoutes,
      },
      groups: buildGroups(records, groupBy),
    };
  }

  static async getFeedbackDetail(filters = {}, actor) {
    const groupBy = filters.groupBy || 'day';
    const records = (await loadFeedbackRecords(filters))
      .filter((record) => matchesGroup(record, groupBy, filters.groupKey))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, DETAIL_LIMIT);
    const names = await displayNameMap(records);

    await logAudit({
      action: 'FEEDBACK_ANALYTICS_DETAIL_VIEWED',
      actorId: actor?.userId,
      metadata: { filters },
    });

    return {
      groupBy,
      groupKey: filters.groupKey || null,
      total: records.length,
      items: records.map((record) => sanitizeRecord(record, names)),
    };
  }
}

export default FeedbackAnalyticsService;
