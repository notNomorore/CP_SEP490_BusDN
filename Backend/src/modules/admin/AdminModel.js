import User from '../auth/User.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const SORT_FIELDS = new Set(['createdAt', 'fullName', 'email', 'role', 'status', 'lastLoginAt']);
const PERFORMANCE_ROLES = ['DRIVER', 'CONDUCTOR', 'STAFF'];

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
    return User.findByIdAndUpdate(
      userId,
      {
        status: 'LOCKED',
        accountLock: {
          isLocked: true,
          reason: reason || 'Locked by administrator',
          lockedUntil: lockedUntil || null,
        },
        $push: {
          activityReports: buildActivityReport('STATUS_UPDATED', reason || 'Account locked by administrator.'),
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
}
