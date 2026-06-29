import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import User from '../auth/User.js';
import { createAuditLog } from '../systemMonitoring/auditLogger.js';
import PassengerRestriction from './PassengerRestriction.js';
import PassengerViolation from './PassengerViolation.js';

const number = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const safeUser = (user) => user ? {
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  status: user.status,
} : null;

const buildViolationFilter = (query) => {
  const filter = {};
  ['violationType', 'severity', 'status'].forEach((field) => {
    if (query[field]) filter[field] = query[field];
  });
  ['passengerId', 'routeId'].forEach((field) => {
    if (query[field]) filter[field] = new mongoose.Types.ObjectId(query[field]);
  });
  if (query.startDate || query.endDate) {
    filter.reportedAt = {};
    if (query.startDate) filter.reportedAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.reportedAt.$lte = endOfDay(query.endDate);
  }
  return filter;
};

const expireRestrictions = async () => {
  const now = new Date();
  const expired = await PassengerRestriction.find({
    status: 'ACTIVE',
    endDate: { $lt: now },
  }).select('_id passengerId restrictionType').lean();
  if (!expired.length) return;

  await PassengerRestriction.updateMany(
    { _id: { $in: expired.map((item) => item._id) } },
    { $set: { status: 'EXPIRED' } }
  );
  const accountPassengerIds = [...new Set(
    expired
      .filter((item) => item.restrictionType === 'ACCOUNT_SUSPENSION')
      .map((item) => String(item.passengerId))
  )];
  await Promise.all(accountPassengerIds.map((passengerId) => syncAccountLock(passengerId)));
};

const syncAccountLock = async (passengerId) => {
  const now = new Date();
  const suspension = await PassengerRestriction.findOne({
    passengerId,
    restrictionType: 'ACCOUNT_SUSPENSION',
    status: 'ACTIVE',
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ endDate: -1 });
  const user = await User.findById(passengerId);
  if (!user) return;

  if (suspension) {
    user.status = 'LOCKED';
    user.accountLock = {
      isLocked: true,
      lockedUntil: suspension.endDate,
      reason: `Passenger restriction ${suspension._id}`,
    };
  } else if (String(user.accountLock?.reason || '').startsWith('Passenger restriction ')) {
    user.status = 'ACTIVE';
    user.accountLock = { isLocked: false, lockedUntil: null, reason: '' };
  }
  await user.save();
};

const relatedCollection = async (names, id) => {
  if (!id || !mongoose.connection.db) return null;
  for (const name of names) {
    const exists = await mongoose.connection.db.listCollections({ name }).hasNext();
    if (exists) {
      const document = await mongoose.connection.db.collection(name).findOne({
        _id: new mongoose.Types.ObjectId(id),
      });
      if (document) return document;
    }
  }
  return null;
};

const routeSummary = (route) => route ? {
  _id: route._id,
  routeNumber: route.routeNumber || route.routeCode || route.code || '',
  name: route.name || route.routeName || route.routeNumber || route.routeCode || route.code,
} : null;

const tripSummary = (trip) => trip ? {
  _id: trip._id,
  status: trip.status,
  departureTime: trip.departureTime || trip.scheduledStart || trip.startTime,
} : null;

export const assertPassengerCanPurchase = async ({ passengerId, routeId = null, at = new Date() }) => {
  if (!passengerId || !mongoose.isValidObjectId(passengerId)) return;
  await expireRestrictions();
  const restrictions = await PassengerRestriction.find({
    passengerId,
    status: 'ACTIVE',
    startDate: { $lte: at },
    endDate: { $gte: at },
    restrictionType: { $in: ['TEMPORARY_SUSPENSION', 'ROUTE_BAN', 'ACCOUNT_SUSPENSION'] },
  }).lean();

  const blocking = restrictions.find((restriction) => (
    restriction.restrictionType !== 'ROUTE_BAN'
    || (routeId && String(restriction.routeId) === String(routeId))
  ));
  if (blocking) {
    throw new CustomError(
      `Ticket purchase is blocked by an active ${blocking.restrictionType.toLowerCase().replaceAll('_', ' ')}`,
      HTTP_STATUS.FORBIDDEN,
      { restrictionId: blocking._id, endDate: blocking.endDate }
    );
  }
};

export class PassengerComplianceService {
  static async listViolations(query, actor, req) {
    await expireRestrictions();
    const page = number(query.page, PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(number(query.limit, PAGINATION.DEFAULT_LIMIT), PAGINATION.MAX_LIMIT);
    const filter = buildViolationFilter(query);
    const [violations, total, statistics] = await Promise.all([
      PassengerViolation.find(filter)
        .populate('passengerId', 'fullName email avatar role status')
        .populate('reporterId', 'fullName avatar role')
        .sort({ reportedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PassengerViolation.countDocuments(filter),
      Promise.all([
        PassengerViolation.countDocuments(),
        PassengerViolation.countDocuments({ severity: 'CRITICAL' }),
        PassengerRestriction.countDocuments({
          status: 'ACTIVE',
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        }),
        PassengerRestriction.distinct('passengerId', {
          status: 'ACTIVE',
          restrictionType: { $in: ['TEMPORARY_SUSPENSION', 'ACCOUNT_SUSPENSION'] },
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        }),
      ]),
    ]);

    await createAuditLog({
      req,
      user: actor,
      action: 'VIEW_PASSENGER_VIOLATION',
      module: 'PASSENGER_COMPLIANCE',
      description: 'Admin viewed passenger violation records.',
      metadata: { filters: query, resultCount: total },
    });

    return {
      violations: violations.map((item) => ({
        ...item,
        passenger: safeUser(item.passengerId),
        passengerId: item.passengerId?._id || item.passengerId,
        reporter: safeUser(item.reporterId),
        reporterId: item.reporterId?._id || item.reporterId,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      statistics: {
        totalViolations: statistics[0],
        criticalViolations: statistics[1],
        activeRestrictions: statistics[2],
        suspendedPassengers: statistics[3].length,
      },
    };
  }

  static async getViolation(id, actor, req) {
    await expireRestrictions();
    const violation = await PassengerViolation.findById(id)
      .populate('passengerId', 'fullName email phoneNumber avatar role status createdAt')
      .populate('reporterId', 'fullName avatar role')
      .lean();
    if (!violation) throw new CustomError('Passenger violation not found', HTTP_STATUS.NOT_FOUND);

    const [route, trip, history] = await Promise.all([
      relatedCollection(['routes', 'busroutes'], violation.routeId),
      relatedCollection(['trips', 'tripschedules'], violation.tripId),
      PassengerRestriction.find({ passengerId: violation.passengerId._id })
        .populate('appliedBy', 'fullName role')
        .populate('violationId', 'violationType severity reportedAt')
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    await createAuditLog({
      req,
      user: actor,
      action: 'VIEW_PASSENGER_VIOLATION',
      module: 'PASSENGER_COMPLIANCE',
      description: 'Admin viewed a passenger violation detail.',
      resourceType: 'PassengerViolation',
      resourceId: violation._id,
    });

    return {
      ...violation,
      passenger: safeUser(violation.passengerId),
      passengerId: violation.passengerId._id,
      reporter: safeUser(violation.reporterId),
      reporterId: violation.reporterId?._id || violation.reporterId,
      route: routeSummary(route),
      trip: tripSummary(trip),
      evidence: violation.evidenceUrls,
      history,
      recommendedRestriction: violation.severity === 'CRITICAL' ? 'ACCOUNT_SUSPENSION' : null,
    };
  }

  static async applyRestriction(payload, actor, req) {
    const [passenger, violation] = await Promise.all([
      User.findById(payload.passengerId),
      PassengerViolation.findById(payload.violationId),
    ]);
    if (!passenger || passenger.role !== 'PASSENGER') {
      throw new CustomError('Passenger not found', HTTP_STATUS.NOT_FOUND);
    }
    if (!violation) throw new CustomError('Passenger violation not found', HTTP_STATUS.NOT_FOUND);
    if (String(violation.passengerId) !== String(passenger._id)) {
      throw new CustomError('Restriction passenger must match the referenced violation', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (payload.restrictionType === 'ROUTE_BAN' && !violation.routeId) {
      throw new CustomError('Route ban requires a violation associated with a route', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    const overlapping = await PassengerRestriction.findOne({
      passengerId: passenger._id,
      violationId: violation._id,
      restrictionType: payload.restrictionType,
      status: 'ACTIVE',
      startDate: { $lte: new Date(payload.endDate) },
      endDate: { $gte: new Date(payload.startDate) },
    });
    if (overlapping) {
      throw new CustomError(
        'An overlapping active restriction already exists for this violation',
        HTTP_STATUS.CONFLICT
      );
    }

    const restriction = await PassengerRestriction.create({
      passengerId: passenger._id,
      violationId: violation._id,
      routeId: payload.restrictionType === 'ROUTE_BAN' ? violation.routeId : null,
      restrictionType: payload.restrictionType,
      reason: String(payload.reason).trim(),
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      status: 'ACTIVE',
      appliedBy: actor.userId,
    });
    if (!['RESOLVED', 'DISMISSED'].includes(violation.status)) {
      violation.status = 'UNDER_REVIEW';
      await violation.save();
    }
    if (restriction.restrictionType === 'ACCOUNT_SUSPENSION') {
      await syncAccountLock(passenger._id);
    }

    await createAuditLog({
      req,
      user: actor,
      action: 'APPLY_PASSENGER_RESTRICTION',
      module: 'PASSENGER_COMPLIANCE',
      description: 'Admin applied a passenger restriction.',
      resourceType: 'PassengerRestriction',
      resourceId: restriction._id,
      riskLevel: restriction.restrictionType === 'ACCOUNT_SUSPENSION' ? 'HIGH' : 'MEDIUM',
      metadata: {
        passengerId: passenger._id,
        violationId: violation._id,
        restrictionType: restriction.restrictionType,
      },
    });
    return PassengerRestriction.findById(restriction._id)
      .populate('passengerId', 'fullName email avatar status')
      .populate('violationId', 'violationType severity reportedAt')
      .populate('appliedBy', 'fullName role');
  }

  static async updateRestriction(id, payload, actor, req) {
    await expireRestrictions();
    const restriction = await PassengerRestriction.findById(id);
    if (!restriction) throw new CustomError('Passenger restriction not found', HTTP_STATUS.NOT_FOUND);
    if (payload.status === 'ACTIVE' && restriction.endDate < new Date()) {
      throw new CustomError('Expired restriction cannot be reactivated', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    const previousStatus = restriction.status;
    restriction.status = payload.status;
    await restriction.save();
    if (restriction.restrictionType === 'ACCOUNT_SUSPENSION') {
      await syncAccountLock(restriction.passengerId);
    }
    await createAuditLog({
      req,
      user: actor,
      action: 'UPDATE_PASSENGER_RESTRICTION',
      module: 'PASSENGER_COMPLIANCE',
      description: 'Admin updated passenger restriction status.',
      resourceType: 'PassengerRestriction',
      resourceId: restriction._id,
      riskLevel: 'MEDIUM',
      metadata: { previousStatus, status: restriction.status },
    });
    return PassengerRestriction.findById(restriction._id)
      .populate('passengerId', 'fullName email avatar status')
      .populate('violationId', 'violationType severity reportedAt')
      .populate('appliedBy', 'fullName role');
  }

  static async listRestrictions(query) {
    await expireRestrictions();
    const filter = {};
    ['status', 'restrictionType'].forEach((field) => {
      if (query[field]) filter[field] = query[field];
    });
    if (query.passengerId) filter.passengerId = query.passengerId;
    const history = await PassengerRestriction.find(filter)
      .populate('passengerId', 'fullName email avatar status')
      .populate('violationId', 'violationType severity reportedAt routeId')
      .populate('appliedBy', 'fullName role')
      .sort({ createdAt: -1 })
      .lean();
    const now = new Date();
    return {
      activeRestrictions: history.filter((item) => (
        item.status === 'ACTIVE' && item.startDate <= now && item.endDate >= now
      )),
      expiredRestrictions: history.filter((item) => item.status === 'EXPIRED'),
      restrictionHistory: history,
    };
  }
}

export default PassengerComplianceService;
