import mongoose from 'mongoose';
import { HTTP_STATUS, PAGINATION } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import Promotion from './Promotion.js';
import PromotionUsage from './PromotionUsage.js';

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

  if (sanitized.applicableTo !== 'SELECTED_ROUTES') {
    sanitized.routeIds = [];
  }

  return sanitized;
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

const assertPromotionBusinessRules = (promotion) => {
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

  if (promotion.usageLimit && promotion.usedCount > promotion.usageLimit) {
    throw new CustomError('Usage limit cannot be lower than used count', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.status === 'ACTIVE' && promotion.endDate < new Date()) {
    throw new CustomError('Expired promotion cannot be activated', HTTP_STATUS.BAD_REQUEST);
  }

  if (promotion.status === 'ACTIVE' && promotion.usageLimit && promotion.usedCount >= promotion.usageLimit) {
    throw new CustomError('Promotion usage limit has been reached', HTTP_STATUS.BAD_REQUEST);
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
    assertPromotionBusinessRules({ ...data, usedCount: 0, routeIds: data.routeIds || [] });

    const promotion = await Promotion.create({
      ...data,
      createdBy: getActorId(actor),
      updatedBy: getActorId(actor),
    });

    await logAudit({
      action: 'PROMOTION_CREATED',
      actorId: getActorId(actor),
      promotionId: promotion._id,
      metadata: { code: promotion.code },
    });

    return promotion;
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
      items,
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

    return promotion;
  }

  static async updatePromotion(id, payload, actor) {
    const existingPromotion = await Promotion.findById(id);

    if (!existingPromotion) {
      throw new CustomError('Promotion not found', HTTP_STATUS.NOT_FOUND);
    }

    const data = sanitizePromotionPayload(payload);
    Object.assign(existingPromotion, data, { updatedBy: getActorId(actor) });
    assertPromotionBusinessRules(existingPromotion);
    await existingPromotion.save();

    await logAudit({
      action: 'PROMOTION_UPDATED',
      actorId: getActorId(actor),
      promotionId: existingPromotion._id,
      metadata: { code: existingPromotion.code },
    });

    return existingPromotion;
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
    assertPromotionBusinessRules(promotion);
    await promotion.save();

    await logAudit({
      action: status === 'ACTIVE' ? 'PROMOTION_ACTIVATED' : 'PROMOTION_DEACTIVATED',
      actorId: getActorId(actor),
      promotionId: promotion._id,
      metadata: { code: promotion.code, status },
    });

    return promotion;
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
}

export default PromotionService;
