import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import Promotion from './Promotion.js';
import PromotionUsage from './PromotionUsage.js';
import Route from '../routes/Route.js';
import SystemNotificationService from '../systemNotifications/systemNotification.service.js';
import logger from '../../utils/logger.js';

const appliedUsageMatch = { status: 'APPLIED' };

const toNumberOrDefault = (value, fallback) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const parsePagination = (query) => {
  const page = Math.max(toNumberOrDefault(query.page, PAGINATION.DEFAULT_PAGE), 1);
  const limit = Math.min(
    Math.max(toNumberOrDefault(query.limit, PAGINATION.DEFAULT_LIMIT), 1),
    PAGINATION.MAX_LIMIT
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const getActorId = (user) => user?.userId || user?._id || null;

const sanitizePromotionPayload = (payload) => {
  const sanitized = {};

  [
    'code',
    'name',
    'description',
    'discountType',
    'discountValue',
    'maxDiscountAmount',
    'minOrderAmount',
    'applicableTo',
    'routeIds',
    'startDate',
    'endDate',
    'usageLimit',
    'usagePerUser',
    'status',
    'notifyPassengers',
    'notificationScheduledAt',
    'notificationStatus',
    'notificationTarget',
  ].forEach((field) => {
    if (payload[field] !== undefined) {
      sanitized[field] = payload[field];
    }
  });

  if (sanitized.code) {
    sanitized.code = String(sanitized.code).trim().toUpperCase();
  }

  if (sanitized.name) {
    sanitized.name = String(sanitized.name).trim();
  }

  if (sanitized.description !== undefined) {
    sanitized.description = String(sanitized.description || '').trim();
  }

  if (sanitized.discountValue !== undefined) {
    sanitized.discountValue = Number(sanitized.discountValue);
  }

  if (sanitized.maxDiscountAmount === '') {
    sanitized.maxDiscountAmount = null;
  } else if (sanitized.maxDiscountAmount !== undefined && sanitized.maxDiscountAmount !== null) {
    sanitized.maxDiscountAmount = Number(sanitized.maxDiscountAmount);
  }

  if (sanitized.minOrderAmount !== undefined) {
    sanitized.minOrderAmount = Number(sanitized.minOrderAmount);
  }

  if (sanitized.usageLimit === '') {
    sanitized.usageLimit = null;
  } else if (sanitized.usageLimit !== undefined && sanitized.usageLimit !== null) {
    sanitized.usageLimit = Number(sanitized.usageLimit);
  }

  if (sanitized.usagePerUser !== undefined) {
    sanitized.usagePerUser = Number(sanitized.usagePerUser);
  }

  if (sanitized.startDate) {
    sanitized.startDate = new Date(sanitized.startDate);
  }

  if (sanitized.endDate) {
    sanitized.endDate = new Date(sanitized.endDate);
  }

  if (sanitized.notifyPassengers !== undefined) {
    sanitized.notifyPassengers = Boolean(sanitized.notifyPassengers);
  }

  if (sanitized.notificationScheduledAt === '' || sanitized.notificationScheduledAt === null) {
    sanitized.notificationScheduledAt = null;
  } else if (sanitized.notificationScheduledAt !== undefined) {
    sanitized.notificationScheduledAt = new Date(sanitized.notificationScheduledAt);
  }

  if (sanitized.notificationTarget && sanitized.notificationTarget !== 'all_passengers') {
    sanitized.notificationTarget = 'all_passengers';
  }

  if (sanitized.applicableTo !== 'SELECTED_ROUTES') {
    sanitized.routeIds = [];
  }

  return sanitized;
};

const buildEffectivePromotionStatus = (promotion, now = new Date()) => {
  if (promotion.status === 'EXPIRED' || promotion.endDate < now) return 'EXPIRED';
  if (promotion.status !== 'ACTIVE') return promotion.status;
  if (promotion.startDate > now) return 'SCHEDULED';
  return 'ACTIVE';
};

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

const buildPromotionFilter = (query) => {
  const filter = {};

  if (query.search) {
    const keyword = String(query.search).trim();
    filter.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
    ];
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.discountType) {
    filter.discountType = query.discountType;
  }

  if (query.applicableTo) {
    filter.applicableTo = query.applicableTo;
  }

  if (query.startDate || query.endDate) {
    filter.startDate = {};
    if (query.startDate) {
      filter.startDate.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      filter.startDate.$lte = new Date(query.endDate);
    }
  }

  return filter;
};

const buildUsageMatch = (query = {}, promotionId = null) => {
  const match = { ...appliedUsageMatch };

  if (promotionId) {
    match.promotionId = new mongoose.Types.ObjectId(promotionId);
  } else if (query.promotionId && mongoose.isValidObjectId(query.promotionId)) {
    match.promotionId = new mongoose.Types.ObjectId(query.promotionId);
  }

  if (query.routeId && mongoose.isValidObjectId(query.routeId)) {
    match.routeId = new mongoose.Types.ObjectId(query.routeId);
  }

  if (query.status) {
    match.status = query.status;
  }

  if (query.startDate || query.endDate) {
    match.usedAt = {};
    if (query.startDate) {
      match.usedAt.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      match.usedAt.$lte = new Date(query.endDate);
    }
  }

  return match;
};

const logAudit = async ({ action, actorId, promotionId, metadata = {} }) => {
  try {
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) {
      return;
    }

    await AuditLog.create({
      action,
      actorId,
      entityType: 'Promotion',
      entityId: promotionId,
      metadata,
      createdAt: new Date(),
    });
  } catch {
    // Audit logging should not fail the admin operation.
  }
};

const assertUniqueCode = async (code, excludedId = null) => {
  if (!code) return;

  const existing = await Promotion.findOne({
    code: String(code).trim().toUpperCase(),
    ...(excludedId ? { _id: { $ne: excludedId } } : {}),
  }).select('_id').lean();

  if (existing) {
    throw new CustomError('Promotion code already exists', HTTP_STATUS.CONFLICT);
  }
};

const assertRoutesExist = async (routeIds = []) => {
  if (!routeIds.length) return;

  const uniqueRouteIds = [...new Set(routeIds.map((routeId) => String(routeId)))];
  const existingCount = await Route.countDocuments({ _id: { $in: uniqueRouteIds } });
  if (existingCount !== uniqueRouteIds.length) {
    throw new CustomError('One or more applicable routes do not exist', HTTP_STATUS.BAD_REQUEST);
  }
};

const assertPromotionBusinessRules = async (promotion) => {
  if (promotion.startDate >= promotion.endDate) {
    throw new CustomError('Start date must be before end date', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.discountValue <= 0) {
    throw new CustomError('Discount value must be greater than 0', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.discountType === 'PERCENTAGE' && promotion.discountValue > 100) {
    throw new CustomError('Percentage discount cannot exceed 100', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.applicableTo === 'SELECTED_ROUTES' && promotion.routeIds.length === 0) {
    throw new CustomError('Route IDs are required for selected routes', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.applicableTo === 'SELECTED_ROUTES') {
    await assertRoutesExist(promotion.routeIds);
  }

  if (promotion.usageLimit && promotion.usedCount > promotion.usageLimit) {
    throw new CustomError('Usage limit cannot be lower than used count', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.status === 'ACTIVE' && promotion.endDate < new Date()) {
    throw new CustomError('Expired promotion cannot be activated', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.status === 'ACTIVE' && promotion.usageLimit && promotion.usedCount >= promotion.usageLimit) {
    throw new CustomError('Promotion usage limit has been reached', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.notifyPassengers) {
    if (!promotion.notificationScheduledAt) {
      throw new CustomError('Notification time is required', HTTP_STATUS.BAD_REQUEST);
    }

    const scheduledAt = new Date(promotion.notificationScheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new CustomError('Invalid notification time', HTTP_STATUS.BAD_REQUEST);
    }

    if (scheduledAt <= new Date() && promotion.notificationStatus !== 'sent') {
      throw new CustomError('Notification time cannot be in the past', HTTP_STATUS.BAD_REQUEST);
    }

    if (scheduledAt < promotion.startDate || scheduledAt > endOfDay(promotion.endDate)) {
      throw new CustomError('Notification time must be within promotion validity period', HTTP_STATUS.BAD_REQUEST);
    }
  }
};

const refreshExpiredPromotions = () => {
  return Promotion.updateMany(
    { status: 'ACTIVE', endDate: { $lt: new Date() } },
    { $set: { status: 'EXPIRED' } }
  );
};

const summarizeUsage = async (match) => {
  const [summary] = await PromotionUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRedemptions: { $sum: 1 },
        totalDiscountGiven: { $sum: '$discountAmount' },
        originalRevenue: { $sum: '$originalAmount' },
        finalRevenue: { $sum: '$finalAmount' },
      },
    },
  ]);

  return {
    totalRedemptions: summary?.totalRedemptions || 0,
    totalDiscountGiven: summary?.totalDiscountGiven || 0,
    revenueImpact: (summary?.originalRevenue || 0) - (summary?.finalRevenue || 0),
    originalRevenue: summary?.originalRevenue || 0,
    finalRevenue: summary?.finalRevenue || 0,
  };
};

const buildUpdateWarnings = async (existingPromotion, nextData) => {
  const successfulUses = await PromotionUsage.countDocuments({
    promotionId: existingPromotion._id,
    status: 'APPLIED',
  });

  if (!successfulUses) return [];

  const sensitiveFields = [
    'discountType',
    'discountValue',
    'applicableTo',
    'routeIds',
    'startDate',
    'endDate',
    'usageLimit',
  ];

  const changedFields = sensitiveFields.filter((field) => {
    if (nextData[field] === undefined) return false;
    return JSON.stringify(existingPromotion[field]) !== JSON.stringify(nextData[field]);
  });

  if (!changedFields.length) return [];

  return [
    `Promotion has ${successfulUses} successful use(s). Historical paid orders keep their stored discount snapshot.`,
    `Changed sensitive field(s): ${changedFields.join(', ')}.`,
  ];
};

const applyNotificationSchedulingState = (promotion, nextData = {}) => {
  if (!promotion.notifyPassengers) {
    if (promotion.notificationStatus !== 'sent') {
      promotion.notificationStatus = 'cancelled';
      promotion.notificationScheduledAt = null;
      promotion.notificationJobLastCheckedAt = null;
    }
    return;
  }

  promotion.notificationTarget = 'all_passengers';
  if (promotion.notificationStatus !== 'sent') {
    promotion.notificationStatus = 'pending';
    promotion.notificationSentAt = null;
  } else if (
    nextData.notificationScheduledAt !== undefined
    && String(new Date(nextData.notificationScheduledAt)) !== String(new Date(promotion.notificationScheduledAt))
  ) {
    throw new CustomError('Promotion notification has already been sent', HTTP_STATUS.CONFLICT);
  }
};

const getTopPromotionsByUsage = async (match, limit = 5) => {
  return PromotionUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$promotionId',
        usedCount: { $sum: 1 },
        totalDiscountGiven: { $sum: '$discountAmount' },
      },
    },
    { $sort: { usedCount: -1, totalDiscountGiven: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'promotions',
        localField: '_id',
        foreignField: '_id',
        as: 'promotion',
      },
    },
    { $unwind: { path: '$promotion', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        promotionId: '$_id',
        code: '$promotion.code',
        name: '$promotion.name',
        usedCount: 1,
        totalDiscountGiven: 1,
      },
    },
  ]);
};

const getUsageByDate = async (match) => {
  return PromotionUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$usedAt' } },
        redemptions: { $sum: 1 },
        totalDiscountGiven: { $sum: '$discountAmount' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        redemptions: 1,
        totalDiscountGiven: 1,
      },
    },
  ]);
};

const getUsageByRoute = async (match) => {
  return PromotionUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$routeId',
        redemptions: { $sum: 1 },
        totalDiscountGiven: { $sum: '$discountAmount' },
      },
    },
    { $sort: { redemptions: -1 } },
    {
      $project: {
        _id: 0,
        routeId: '$_id',
        routeLabel: {
          $cond: [{ $ifNull: ['$_id', false] }, { $toString: '$_id' }, 'Unassigned'],
        },
        redemptions: 1,
        totalDiscountGiven: 1,
      },
    },
  ]);
};

const getUsageByPaymentMethod = async (match) => {
  return PromotionUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$paymentMethod',
        redemptions: { $sum: 1 },
        totalDiscountGiven: { $sum: '$discountAmount' },
      },
    },
    { $sort: { redemptions: -1 } },
    {
      $project: {
        _id: 0,
        paymentMethod: { $ifNull: ['$_id', 'UNKNOWN'] },
        redemptions: 1,
        totalDiscountGiven: 1,
      },
    },
  ]);
};

export class PromotionService {
  static async createPromotion(payload, actor) {
    const data = sanitizePromotionPayload(payload);
    data.notificationStatus = data.notifyPassengers ? 'pending' : 'cancelled';
    data.notificationTarget = 'all_passengers';
    await assertUniqueCode(data.code);
    await assertPromotionBusinessRules({ ...data, usedCount: 0, routeIds: data.routeIds || [] });

    let promotion;
    try {
      promotion = await Promotion.create({
        ...data,
        createdBy: getActorId(actor),
        updatedBy: getActorId(actor),
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new CustomError('Promotion code already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }

    await logAudit({
      action: 'PROMOTION_CREATED',
      actorId: getActorId(actor),
      promotionId: promotion._id,
      metadata: { code: promotion.code },
    });

    return promotion.toObject();
  }

  static async getPromotions(query) {
    await refreshExpiredPromotions();

    const { page, limit, skip } = parsePagination(query);
    const filter = buildPromotionFilter(query);
    const sort = query.sortBy
      ? { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 }
      : { createdAt: -1 };

    const [items, total] = await Promise.all([
      Promotion.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Promotion.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        effectiveStatus: buildEffectivePromotionStatus(item),
        remainingUsage: item.usageLimit ? Math.max(Number(item.usageLimit) - Number(item.usedCount || 0), 0) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getPromotionById(id) {
    const promotion = await Promotion.findById(id).lean();

    if (!promotion) {
      throw new CustomError('Promotion not found', HTTP_STATUS.NOT_FOUND);
    }

    return {
      ...promotion,
      effectiveStatus: buildEffectivePromotionStatus(promotion),
      remainingUsage: promotion.usageLimit ? Math.max(Number(promotion.usageLimit) - Number(promotion.usedCount || 0), 0) : null,
    };
  }

  static async updatePromotion(id, payload, actor) {
    const existingPromotion = await Promotion.findById(id);

    if (!existingPromotion) {
      throw new CustomError('Promotion not found', HTTP_STATUS.NOT_FOUND);
    }

    const data = sanitizePromotionPayload(payload);
    await assertUniqueCode(data.code, id);
    const warnings = await buildUpdateWarnings(existingPromotion, data);
    Object.assign(existingPromotion, data, { updatedBy: getActorId(actor) });
    applyNotificationSchedulingState(existingPromotion, data);
    await assertPromotionBusinessRules(existingPromotion);
    try {
      await existingPromotion.save();
    } catch (error) {
      if (error?.code === 11000) {
        throw new CustomError('Promotion code already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }

    await logAudit({
      action: 'PROMOTION_UPDATED',
      actorId: getActorId(actor),
      promotionId: existingPromotion._id,
      metadata: { code: existingPromotion.code },
    });

    return {
      ...existingPromotion.toObject(),
      warnings,
      effectiveStatus: buildEffectivePromotionStatus(existingPromotion),
    };
  }

  static async updatePromotionStatus(id, status, actor) {
    const promotion = await Promotion.findById(id);

    if (!promotion) {
      throw new CustomError('Promotion not found', HTTP_STATUS.NOT_FOUND);
    }

    if (promotion.status === 'EXPIRED' && status === 'ACTIVE' && promotion.endDate < new Date()) {
      throw new CustomError('Expired promotion cannot be reactivated', HTTP_STATUS.BAD_REQUEST);
    }

    promotion.status = status;
    promotion.updatedBy = getActorId(actor);
    if (status !== 'ACTIVE' && promotion.notificationStatus === 'pending') {
      promotion.notificationStatus = 'cancelled';
    }
    await assertPromotionBusinessRules(promotion);
    await promotion.save();

    await logAudit({
      action: status === 'ACTIVE' ? 'PROMOTION_ACTIVATED' : 'PROMOTION_DEACTIVATED',
      actorId: getActorId(actor),
      promotionId: promotion._id,
      metadata: { code: promotion.code, status },
    });

    return {
      ...promotion.toObject(),
      effectiveStatus: buildEffectivePromotionStatus(promotion),
    };
  }

  static async getPromotionStatistics(id, query, actor) {
    const promotion = await Promotion.findById(id).lean();

    if (!promotion) {
      throw new CustomError('Promotion not found', HTTP_STATUS.NOT_FOUND);
    }

    const match = buildUsageMatch(query, id);
    const [summary, usageByDate, usageByRoute, usageByPaymentMethod] = await Promise.all([
      summarizeUsage(match),
      getUsageByDate(match),
      getUsageByRoute(match),
      getUsageByPaymentMethod(match),
    ]);

    await logAudit({
      action: 'PROMOTION_STATISTICS_VIEWED',
      actorId: getActorId(actor),
      promotionId: promotion._id,
      metadata: { scope: 'single' },
    });

    return {
      promotion,
      effectiveStatus: buildEffectivePromotionStatus(promotion),
      remainingUsage: promotion.usageLimit ? Math.max(Number(promotion.usageLimit) - Number(promotion.usedCount || 0), 0) : null,
      totalPromotions: 1,
      activePromotions: promotion.status === 'ACTIVE' ? 1 : 0,
      expiredPromotions: promotion.status === 'EXPIRED' ? 1 : 0,
      totalRedemptions: summary.totalRedemptions,
      totalDiscountGiven: summary.totalDiscountGiven,
      revenueImpact: summary.revenueImpact,
      redemptionRate: promotion.usageLimit
        ? Number(((summary.totalRedemptions / promotion.usageLimit) * 100).toFixed(2))
        : null,
      topPromotionsByUsage: [
        {
          promotionId: promotion._id,
          code: promotion.code,
          name: promotion.name,
          usedCount: summary.totalRedemptions,
          totalDiscountGiven: summary.totalDiscountGiven,
        },
      ],
      usageByDate,
      usageByRoute,
      usageByPaymentMethod,
    };
  }

  static async getOverviewStatistics(query, actor) {
    await refreshExpiredPromotions();

    const match = buildUsageMatch(query);
    const [
      totalPromotions,
      activePromotions,
      expiredPromotions,
      summary,
      topPromotionsByUsage,
      usageByDate,
      usageByRoute,
      usageByPaymentMethod,
    ] = await Promise.all([
      Promotion.countDocuments(),
      Promotion.countDocuments({ status: 'ACTIVE' }),
      Promotion.countDocuments({ status: 'EXPIRED' }),
      summarizeUsage(match),
      getTopPromotionsByUsage(match),
      getUsageByDate(match),
      getUsageByRoute(match),
      getUsageByPaymentMethod(match),
    ]);

    const limitSummary = await Promotion.aggregate([
      { $match: { usageLimit: { $ne: null } } },
      { $group: { _id: null, totalUsageLimit: { $sum: '$usageLimit' } } },
    ]);

    const totalUsageLimit = limitSummary[0]?.totalUsageLimit || 0;

    await logAudit({
      action: 'PROMOTION_STATISTICS_VIEWED',
      actorId: getActorId(actor),
      metadata: { scope: 'overview' },
    });

    return {
      totalPromotions,
      activePromotions,
      expiredPromotions,
      totalRedemptions: summary.totalRedemptions,
      totalDiscountGiven: summary.totalDiscountGiven,
      revenueImpact: summary.revenueImpact,
      redemptionRate: totalUsageLimit
        ? Number(((summary.totalRedemptions / totalUsageLimit) * 100).toFixed(2))
        : null,
      topPromotionsByUsage,
      usageByDate,
      usageByRoute,
      usageByPaymentMethod,
    };
  }

  static async dispatchDuePromotionNotifications({ io = null, now = new Date(), limit = 20 } = {}) {
    const todayStart = startOfDay(now);
    const duePromotions = await Promotion.find({
      notifyPassengers: true,
      notificationStatus: 'pending',
      notificationScheduledAt: { $lte: now },
      status: 'ACTIVE',
      startDate: { $lte: now },
      endDate: { $gte: todayStart },
    })
      .sort({ notificationScheduledAt: 1 })
      .limit(limit);

    let sent = 0;
    let failed = 0;

    for (const promotion of duePromotions) {
      // eslint-disable-next-line no-await-in-loop
      const claimedPromotion = await Promotion.findOneAndUpdate(
        {
          _id: promotion._id,
          notifyPassengers: true,
          notificationStatus: 'pending',
          notificationScheduledAt: { $lte: now },
          status: 'ACTIVE',
          startDate: { $lte: now },
          endDate: { $gte: todayStart },
        },
        { $set: { notificationJobLastCheckedAt: now } },
        { new: true }
      );

      if (!claimedPromotion) {
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        await SystemNotificationService.createPromotionNotificationOnce(claimedPromotion, io);
        claimedPromotion.notificationStatus = 'sent';
        claimedPromotion.notificationSentAt = now;
        claimedPromotion.notificationJobLastCheckedAt = now;
        // eslint-disable-next-line no-await-in-loop
        await claimedPromotion.save();
        sent += 1;
      } catch (error) {
        logger.error('Promotion notification dispatch failed:', error);
        claimedPromotion.notificationStatus = 'failed';
        claimedPromotion.notificationJobLastCheckedAt = now;
        // eslint-disable-next-line no-await-in-loop
        await claimedPromotion.save();
        failed += 1;
      }
    }

    const expiredPending = await Promotion.updateMany(
      {
        notifyPassengers: true,
        notificationStatus: 'pending',
        endDate: { $lt: todayStart },
      },
      {
        $set: {
          notificationStatus: 'cancelled',
          notificationJobLastCheckedAt: now,
        },
      }
    );

    return {
      checked: duePromotions.length,
      sent,
      failed,
      cancelledExpired: expiredPending.modifiedCount || 0,
    };
  }
}

export default PromotionService;
