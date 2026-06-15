import User from '../auth/User.js';
import BusRoute from './BusRoute.js';
import FleetBus from './FleetBus.js';
import RouteStation from './RouteStation.js';
import TripSchedule from './TripSchedule.js';
import DriverShiftAssignment from '../shifts/DriverShiftAssignment.js';

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

const buildActivityReport = (type, message, actorId) => ({
  type,
  message,
  actorId,
  createdAt: new Date(),
});

const toMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const isTimeRangeInsideShift = ({ departureTime, expectedArrivalTime }, shift) => {
  const departure = toMinutes(departureTime);
  const arrival = toMinutes(expectedArrivalTime || departureTime);
  const shiftStart = toMinutes(shift?.startTime);
  const shiftEnd = toMinutes(shift?.endTime);
  return departure !== null
    && arrival !== null
    && shiftStart !== null
    && shiftEnd !== null
    && departure >= shiftStart
    && arrival <= shiftEnd
    && departure <= arrival;
};

const scheduleTimesOverlap = (first, second) => {
  const firstStart = toMinutes(first.departureTime);
  const firstEnd = toMinutes(first.expectedArrivalTime || first.departureTime);
  const secondStart = toMinutes(second.departureTime);
  const secondEnd = toMinutes(second.expectedArrivalTime || second.departureTime);
  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) return false;
  return firstStart < secondEnd && secondStart < firstEnd;
};

const getDateBounds = (value) => {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
};

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
    if (phone) conditions.push({ phoneNumber: phone });
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
    const completedTripSummary = await TripSchedule.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $project: {
          staffIds: {
            $setUnion: [
              [{ $ifNull: ['$driver.userId', null] }],
              [{ $ifNull: ['$assistant.userId', null] }],
            ],
          },
        },
      },
      { $unwind: '$staffIds' },
      { $match: { staffIds: { $ne: null } } },
      { $group: { _id: null, totalCompletedTrips: { $sum: 1 } } },
      { $project: { _id: 0 } },
    ]);
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

    const userSummary = summary[0] || { staffCount: 0, totalCompletedTrips: 0, totalIncidents: 0, averageOnTimeRate: 0 };
    if (completedTripSummary[0]?.totalCompletedTrips) {
      userSummary.totalCompletedTrips = completedTripSummary[0].totalCompletedTrips;
    }
    return userSummary;
  }

  static async findStaffPerformanceUsers() {
    const staffMembers = await User.find({ role: { $in: PERFORMANCE_ROLES } })
      .select(baseUserSelectFields)
      .sort({ 'staffMetrics.performanceScore': -1, fullName: 1 })
      .lean();

    if (!staffMembers.length) return [];

    const staffIds = staffMembers.map((member) => member._id);
    const tripStats = await TripSchedule.aggregate([
      {
        $match: {
          $or: [
            { 'driver.userId': { $in: staffIds } },
            { 'assistant.userId': { $in: staffIds } },
          ],
        },
      },
      {
        $project: {
          routeId: 1,
          routeCode: 1,
          routeName: 1,
          status: 1,
          serviceDate: 1,
          staffIds: {
            $setUnion: [
              [{ $ifNull: ['$driver.userId', null] }],
              [{ $ifNull: ['$assistant.userId', null] }],
            ],
          },
        },
      },
      { $unwind: '$staffIds' },
      { $match: { staffIds: { $in: staffIds } } },
      {
        $group: {
          _id: '$staffIds',
          completedTrips: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          assignedTrips: { $sum: { $cond: [{ $in: ['$status', ['PLANNED', 'ASSIGNED', 'IN_PROGRESS']] }, 1, 0] } },
          assignedRoutes: {
            $addToSet: {
              routeId: '$routeId',
              routeCode: '$routeCode',
              routeName: '$routeName',
            },
          },
        },
      },
    ]);

    const statsByUserId = new Map(tripStats.map((stats) => [String(stats._id), stats]));
    return staffMembers.map((member) => {
      const stats = statsByUserId.get(String(member._id));
      return {
        ...member,
        staffMetrics: {
          ...(member.staffMetrics || {}),
          completedTrips: stats?.completedTrips ?? member.staffMetrics?.completedTrips ?? 0,
          assignedTrips: stats?.assignedTrips ?? 0,
          delayedTrips: member.staffMetrics?.delayedTrips ?? 0,
          incidents: member.staffMetrics?.incidents ?? 0,
        },
        assignedRoutes: (stats?.assignedRoutes || []).filter((route) => route.routeId),
      };
    });
  }

  static async lockUserById(userId, { reason, lockedUntil, actorId }) {
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
          activityReports: buildActivityReport('STATUS_UPDATED', lockReason, actorId),
        },
      },
      { new: true }
    ).select(baseUserSelectFields).lean();
  }

  static async unlockUserById(userId, { actorId } = {}) {
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
          activityReports: buildActivityReport('STATUS_UPDATED', 'Account unlocked by administrator.', actorId),
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

  static async deactivateRouteById(routeId, payload = {}) {
    return this.updateRouteById(routeId, {
      status: 'SUSPENDED',
      updatedBy: payload.updatedBy,
      ...(payload.reason ? { description: `${payload.reason}` } : {}),
    });
  }

  static async findRouteDeactivationBlockers(routeId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return TripSchedule.find({
      routeId,
      $or: [
        { status: 'IN_PROGRESS' },
        {
          status: { $in: ['PLANNED', 'ASSIGNED'] },
          serviceDate: { $gte: today },
        },
      ],
    })
      .select('scheduleCode serviceDate departureTime status routeCode routeName')
      .sort({ serviceDate: 1, departureTime: 1 })
      .limit(10)
      .lean();
  }

  static async deleteRouteById(routeId) {
    return this.deactivateRouteById(routeId);
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
    const staff = await User.find({
      role: { $in: ['DRIVER', 'CONDUCTOR', 'BUS_ASSISTANT'] },
      status: 'ACTIVE',
    })
      .select(baseUserSelectFields)
      .sort({ fullName: 1 })
      .lean();

    return {
      drivers: staff.filter((user) => user.role === 'DRIVER'),
      assistantStaff: staff.filter((user) => ['CONDUCTOR', 'BUS_ASSISTANT'].includes(user.role)),
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
    if (query.startDate || query.endDate) {
      const start = new Date(query.startDate || query.endDate);
      const end = new Date(query.endDate || query.startDate);
      end.setDate(end.getDate() + 1);
      filters.serviceDate = { $gte: start, $lt: end };
    } else if (query.serviceDate) {
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
    const [scheduleDocuments, total] = await Promise.all([
      TripSchedule.find(options.filters)
        .populate('vehicle.busId', 'busCode plateNumber busType capacity')
        .populate('driver.userId', 'fullName phoneNumber role')
        .populate('assistant.userId', 'fullName phoneNumber role')
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit)
        .lean(),
      TripSchedule.countDocuments(options.filters),
    ]);
    const schedules = scheduleDocuments.map((schedule) => {
      const populatedVehicle = schedule.vehicle?.busId;
      const populatedDriver = schedule.driver?.userId;
      const populatedAssistant = schedule.assistant?.userId;
      return {
        ...schedule,
        vehicle: {
          ...schedule.vehicle,
          busId: populatedVehicle?._id || populatedVehicle,
          busCode: schedule.vehicle?.busCode || populatedVehicle?.busCode || '',
          plateNumber: schedule.vehicle?.plateNumber || populatedVehicle?.plateNumber || '',
          busType: schedule.vehicle?.busType || populatedVehicle?.busType || '',
          capacity: schedule.vehicle?.capacity || populatedVehicle?.capacity || 0,
        },
        driver: {
          ...schedule.driver,
          userId: populatedDriver?._id || populatedDriver,
          fullName: schedule.driver?.fullName || populatedDriver?.fullName || '',
          phone: schedule.driver?.phone || populatedDriver?.phoneNumber || '',
          role: schedule.driver?.role || populatedDriver?.role || '',
        },
        assistant: {
          ...schedule.assistant,
          userId: populatedAssistant?._id || populatedAssistant,
          fullName: schedule.assistant?.fullName || populatedAssistant?.fullName || '',
          phone: schedule.assistant?.phone || populatedAssistant?.phoneNumber || '',
          role: schedule.assistant?.role || populatedAssistant?.role || '',
        },
      };
    });

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
    const dateBounds = getDateBounds(payload.serviceDate);
    const filters = {
      serviceDate: dateBounds ? { $gte: dateBounds.start, $lt: dateBounds.end } : payload.serviceDate,
      status: { $ne: 'CANCELLED' },
      ...(excludeScheduleId ? { _id: { $ne: excludeScheduleId } } : {}),
    };
    const orConditions = [];
    if (payload.vehicle?.busId) orConditions.push({ 'vehicle.busId': payload.vehicle.busId });
    if (payload.driver?.userId) orConditions.push({ 'driver.userId': payload.driver.userId });
    if (payload.assistant?.userId) orConditions.push({ 'assistant.userId': payload.assistant.userId });
    if (!orConditions.length) return [];
    const schedules = await TripSchedule.find({ ...filters, $or: orConditions })
      .select('scheduleCode routeCode departureTime expectedArrivalTime vehicle driver assistant')
      .lean();
    return schedules.filter((schedule) => scheduleTimesOverlap(payload, schedule));
  }

  static async findEligibleDriverShiftAssignment(payload) {
    const driverId = payload.driver?.userId;
    if (!driverId || !payload.serviceDate || !payload.departureTime || !payload.expectedArrivalTime) return null;
    const dateBounds = getDateBounds(payload.serviceDate);
    const assignments = await DriverShiftAssignment.find({
      driverId,
      workDate: dateBounds ? { $gte: dateBounds.start, $lt: dateBounds.end } : payload.serviceDate,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
    })
      .populate('shiftId')
      .lean();

    return assignments.find((assignment) => (
      assignment.shiftId
      && assignment.shiftId.status === 'ACTIVE'
      && isTimeRangeInsideShift(payload, assignment.shiftId)
    )) || null;
  }

  static async createTripSchedule(payload) {
    const schedule = new TripSchedule(payload);
    await schedule.save();
    return schedule.toObject();
  }

  static async findTripScheduleById(scheduleId) {
    return TripSchedule.findById(scheduleId).lean();
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

  static async deleteTripScheduleById(scheduleId) {
    return TripSchedule.findByIdAndDelete(scheduleId).lean();
  }
}
