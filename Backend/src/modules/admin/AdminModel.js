import User from '../auth/User.js';
import BusRoute from './BusRoute.js';
import FleetBus from './FleetBus.js';
import RouteStation from './RouteStation.js';
import TripSchedule from './TripSchedule.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const SORT_FIELDS = new Set(['createdAt', 'fullName', 'email', 'role', 'status', 'lastLoginAt']);
const PERFORMANCE_ROLES = ['DRIVER', 'BUS_ASSISTANT'];
const ROUTE_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'routeCode', 'routeName', 'status']);
const SCHEDULE_SORT_FIELDS = new Set(['serviceDate', 'departureTime', 'updatedAt', 'scheduleCode', 'status']);

const defaultSummary = {
  totalUsers: 0,
  activeUsers: 0,
  lockedUsers: 0,
  pendingUsers: 0,
  verifiedUsers: 0,
};

const baseUserSelectFields = [
  '_id',
  'email',
  'phone',
  'fullName',
  'avatar',
  'role',
  'status',
  'isVerified',
  'isFirstLogin',
  'walletBalance',
  'isPriorityGroup',
  'priorityStatus',
  'priorityProfile',
  'accountLock',
  'lastLoginAt',
  'lastLoginIp',
  'staffMetrics',
  'activityReports',
  'createdAt',
  'updatedAt',
  'preferences',
].join(' ');

const escapeRegex = (value) => String(value).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

const normalizePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
};

const buildUserFilters = (query = {}) => {
  const filters = {};
  const search = query.search?.trim();
  const role = query.role?.trim();
  const status = query.status?.trim();

  if (role && role !== 'ALL') filters.role = role;
  if (status && status !== 'ALL') filters.status = status;

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    filters.$or = [{ fullName: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
  }

  return filters;
};

const buildActivityReport = (type, message) => ({ type, message, createdAt: new Date() });

export default class AdminModel {
  static buildUserQueryOptions(query = {}) {
    const page = normalizePositiveInt(query.page, DEFAULT_PAGE);
    const limit = Math.min(normalizePositiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const sortBy = SORT_FIELDS.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    return { filters: buildUserFilters(query), page, limit, skip: (page - 1) * limit, sort: { [sortBy]: sortOrder } };
  }

  static async findUsers(options) {
    const [users, total, summary] = await Promise.all([
      User.find(options.filters).select(baseUserSelectFields).sort(options.sort).skip(options.skip).limit(options.limit).lean(),
      User.countDocuments(options.filters),
      this.getUserSummary(),
    ]);

    return {
      users,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
      summary,
    };
  }

  static async getUserSummary() {
    const summary = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          lockedUsers: { $sum: { $cond: [{ $eq: ['$status', 'LOCKED'] }, 1, 0] } },
          pendingUsers: { $sum: { $cond: [{ $eq: ['$status', 'PENDING_ACTIVATION'] }, 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return summary[0] || defaultSummary;
  }

  static async findUserById(userId) {
    return User.findById(userId).select(baseUserSelectFields).lean();
  }

  static async findUserByIdentifier({ email, phone }) {
    const conditions = [];
    if (email) conditions.push({ email: email.toLowerCase() });
    if (phone) conditions.push({ phone });
    if (!conditions.length) return null;
    return User.findOne({ $or: conditions }).select(baseUserSelectFields).lean();
  }

  static async createManagedUser(payload) {
    const user = new User(payload);
    await user.save();
    return this.findUserById(user._id);
  }

  static async deleteUserById(userId) {
    return User.findByIdAndDelete(userId).lean();
  }

  static async getStaffPerformanceSummary() {
    const summary = await User.aggregate([
      { $match: { role: { $in: PERFORMANCE_ROLES } } },
      {
        $group: {
          _id: null,
          staffCount: { $sum: 1 },
          totalCompletedTrips: { $sum: { $ifNull: ['$staffMetrics.completedTrips', 0] } },
          totalIncidents: { $sum: { $ifNull: ['$staffMetrics.incidents', 0] } },
          averageOnTimeRate: { $avg: { $ifNull: ['$staffMetrics.onTimeRate', 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return summary[0] || { staffCount: 0, totalCompletedTrips: 0, totalIncidents: 0, averageOnTimeRate: 0 };
  }

  static async findStaffPerformanceUsers() {
    return User.find({ role: { $in: PERFORMANCE_ROLES } })
      .select(baseUserSelectFields)
      .sort({ 'staffMetrics.performanceScore': -1, fullName: 1 })
      .lean();
  }

  static async lockUserById(userId, { reason, lockedUntil }) {
    const lockReason = reason || 'Kh\u00f3a b\u1edfi qu\u1ea3n tr\u1ecb vi\u00ean';
    return User.findByIdAndUpdate(
      userId,
      {
        status: 'LOCKED',
        accountLock: {
          isLocked: true,
          reason: lockReason,
          lockedUntil: lockedUntil || null,
        },
        $push: {
          activityReports: buildActivityReport('STATUS_UPDATED', lockReason),
        },
      },
      { new: true }
    ).select(baseUserSelectFields).lean();
  }

  static async unlockUserById(userId) {
    return User.findByIdAndUpdate(
      userId,
      {
        status: 'ACTIVE',
        accountLock: {
          isLocked: false,
          reason: '',
          lockedUntil: null,
        },
        $push: {
          activityReports: buildActivityReport('STATUS_UPDATED', 'Account unlocked by administrator.'),
        },
      },
      { new: true }
    ).select(baseUserSelectFields).lean();
  }

  static buildRouteQueryOptions(query = {}) {
    const page = normalizePositiveInt(query.page, DEFAULT_PAGE);
    const limit = Math.min(normalizePositiveInt(query.limit, 20), 100);
    const sortBy = ROUTE_SORT_FIELDS.has(query.sortBy) ? query.sortBy : 'updatedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const filters = {};

    if (query.status && query.status !== 'ALL') {
      filters.status = query.status;
    }

    const search = query.search?.trim();
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filters.$or = [
        { routeCode: searchRegex },
        { routeName: searchRegex },
        { operator: searchRegex },
        { 'outboundRoute.startStation.stopName': searchRegex },
        { 'outboundRoute.endStation.stopName': searchRegex },
        { 'inboundRoute.startStation.stopName': searchRegex },
        { 'inboundRoute.endStation.stopName': searchRegex },
      ];
    }

    if (query.origin?.trim()) {
      const originRegex = new RegExp(escapeRegex(query.origin.trim()), 'i');
      filters.$and = [
        ...(filters.$and || []),
        {
          $or: [
            { 'outboundRoute.startStation.stopName': originRegex },
            { 'inboundRoute.startStation.stopName': originRegex },
          ],
        },
      ];
    }

    if (query.destination?.trim()) {
      const destinationRegex = new RegExp(escapeRegex(query.destination.trim()), 'i');
      filters.$and = [
        ...(filters.$and || []),
        {
          $or: [
            { 'outboundRoute.endStation.stopName': destinationRegex },
            { 'inboundRoute.endStation.stopName': destinationRegex },
          ],
        },
      ];
    }

    return { filters, page, limit, skip: (page - 1) * limit, sort: { [sortBy]: sortOrder } };
  }

  static async findRoutes(options) {
    const [routes, total, summary] = await Promise.all([
      BusRoute.find(options.filters).sort(options.sort).skip(options.skip).limit(options.limit).lean(),
      BusRoute.countDocuments(options.filters),
      this.getRouteSummary(),
    ]);

    return {
      routes,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
      summary,
    };
  }

  static async getRouteSummary() {
    const summary = await BusRoute.aggregate([
      {
        $group: {
          _id: null,
          totalRoutes: { $sum: 1 },
          publishedRoutes: { $sum: { $cond: [{ $eq: ['$status', 'PUBLISHED'] }, 1, 0] } },
          draftRoutes: { $sum: { $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0] } },
          pendingRoutes: { $sum: { $cond: [{ $eq: ['$status', 'PENDING_APPROVAL'] }, 1, 0] } },
          suspendedRoutes: { $sum: { $cond: [{ $eq: ['$status', 'SUSPENDED'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return summary[0] || {
      totalRoutes: 0,
      publishedRoutes: 0,
      draftRoutes: 0,
      pendingRoutes: 0,
      suspendedRoutes: 0,
    };
  }

  static async findRouteById(routeId) {
    return BusRoute.findById(routeId).lean();
  }

  static async createRoute(payload) {
    const route = new BusRoute(payload);
    await route.save();
    await this.syncRouteStationAssignments(route);
    return this.findRouteById(route._id);
  }

  static async updateRouteById(routeId, payload) {
    const route = await BusRoute.findByIdAndUpdate(routeId, { $set: payload }, {
      new: true,
      runValidators: true,
    });
    if (!route) return null;
    await this.syncRouteStationAssignments(route);
    return route.toObject();
  }

  static async suspendRouteById(routeId, payload = {}) {
    return this.updateRouteById(routeId, {
      status: 'SUSPENDED',
      description: payload.reason ? `${payload.reason}` : undefined,
    });
  }

  static async deleteRouteById(routeId) {
    const route = await BusRoute.findByIdAndDelete(routeId).lean();
    if (route) {
      await RouteStation.updateMany(
        { 'routeAssignments.routeId': route._id },
        { $pull: { routeAssignments: { routeId: route._id } } }
      );
    }
    return route;
  }

  static async syncRouteStationAssignments(route) {
    const routeId = route._id;
    await RouteStation.updateMany(
      { 'routeAssignments.routeId': routeId },
      { $pull: { routeAssignments: { routeId } } }
    );

    if (route.status !== 'PUBLISHED') {
      return;
    }

    const assignments = [];
    const collect = (direction, label) => {
      direction?.orderedStops?.forEach((stop) => {
        if (!stop.stationId) return;
        assignments.push({
          stationId: stop.stationId,
          assignment: {
            routeId,
            routeCode: route.routeCode,
            routeName: route.routeName,
            direction: label,
          },
        });
      });
    };

    collect(route.outboundRoute, 'OUTBOUND');
    collect(route.inboundRoute, 'INBOUND');

    await Promise.all(assignments.map(({ stationId, assignment }) => (
      RouteStation.findByIdAndUpdate(stationId, { $addToSet: { routeAssignments: assignment } })
    )));
  }

  static async findStations(query = {}) {
    const limit = Math.min(normalizePositiveInt(query.limit, 1000), 2000);
    const filters = {};
    if (query.source && query.source !== 'ALL') filters.source = query.source;
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filters.$or = [{ stationCode: searchRegex }, { stationName: searchRegex }, { address: searchRegex }];
    }
    return RouteStation.find(filters).sort({ stationName: 1 }).limit(limit).lean();
  }

  static async createStation(payload) {
    const station = new RouteStation(payload);
    await station.save();
    return station.toObject();
  }

  static async findBuses() {
    return FleetBus.find({}).sort({ busCode: 1 }).lean();
  }

  static async createBus(payload) {
    const bus = new FleetBus(payload);
    await bus.save();
    return bus.toObject();
  }

  static async updateBusById(busId, payload) {
    return FleetBus.findByIdAndUpdate(busId, { $set: payload }, {
      new: true,
      runValidators: true,
    }).lean();
  }

  static async findRouteStaff() {
    const staff = await User.find({ role: { $in: ['DRIVER', 'CONDUCTOR', 'STAFF', 'BUS_ASSISTANT', 'BUS ASSISTANT'] } })
      .select(baseUserSelectFields)
      .sort({ fullName: 1 })
      .lean();

    return {
      drivers: staff.filter((user) => user.role === 'DRIVER'),
      assistantStaff: staff.filter((user) => ['CONDUCTOR', 'STAFF', 'BUS_ASSISTANT', 'BUS ASSISTANT'].includes(user.role)),
    };
  }

  static buildScheduleQueryOptions(query = {}) {
    const page = normalizePositiveInt(query.page, DEFAULT_PAGE);
    const limit = Math.min(normalizePositiveInt(query.limit, 50), 100);
    const sortBy = SCHEDULE_SORT_FIELDS.has(query.sortBy) ? query.sortBy : 'serviceDate';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
    const filters = {};

    if (query.routeId) filters.routeId = query.routeId;
    if (query.status && query.status !== 'ALL') filters.status = query.status;
    if (query.serviceDate) {
      const date = new Date(query.serviceDate);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      filters.serviceDate = { $gte: date, $lt: nextDate };
    }
    if (query.search?.trim()) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
      filters.$or = [
        { scheduleCode: searchRegex },
        { routeCode: searchRegex },
        { routeName: searchRegex },
        { 'vehicle.busCode': searchRegex },
        { 'vehicle.plateNumber': searchRegex },
        { 'driver.fullName': searchRegex },
        { 'assistant.fullName': searchRegex },
      ];
    }

    return { filters, page, limit, skip: (page - 1) * limit, sort: { [sortBy]: sortOrder, departureTime: 1 } };
  }

  static async findTripSchedules(options) {
    const [schedules, total] = await Promise.all([
      TripSchedule.find(options.filters).sort(options.sort).skip(options.skip).limit(options.limit).lean(),
      TripSchedule.countDocuments(options.filters),
    ]);

    return {
      schedules,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
    };
  }

  static async findScheduleAssignmentConflicts(payload, excludeScheduleId) {
    const filters = {
      serviceDate: payload.serviceDate,
      departureTime: payload.departureTime,
      status: { $nin: ['CANCELLED', 'COMPLETED'] },
      ...(excludeScheduleId ? { _id: { $ne: excludeScheduleId } } : {}),
    };
    const orConditions = [];
    if (payload.vehicle?.busId) orConditions.push({ 'vehicle.busId': payload.vehicle.busId });
    if (payload.driver?.userId) orConditions.push({ 'driver.userId': payload.driver.userId });
    if (payload.assistant?.userId) orConditions.push({ 'assistant.userId': payload.assistant.userId });
    if (!orConditions.length) return [];
    return TripSchedule.find({ ...filters, $or: orConditions }).select('scheduleCode routeCode departureTime').lean();
  }

  static async createTripSchedule(payload) {
    const schedule = new TripSchedule(payload);
    await schedule.save();
    return schedule.toObject();
  }

  static async updateTripScheduleById(scheduleId, payload, { emergencyReason, changedBy } = {}) {
    const current = await TripSchedule.findById(scheduleId);
    if (!current) return null;

    if (emergencyReason) {
      current.emergencyHistory.push({
        reason: emergencyReason,
        changedBy,
        previousVehicle: current.vehicle,
        previousDriver: current.driver,
        previousAssistant: current.assistant,
      });
    }

    Object.assign(current, payload);
    await current.save();
    return current.toObject();
  }
}
