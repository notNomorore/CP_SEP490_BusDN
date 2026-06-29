import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import User from '../auth/User.js';
import FareMatrix from './FareMatrix.js';
import MonthlyPassPricing from './MonthlyPassPricing.js';
import PriorityDiscount from './PriorityDiscount.js';
import { assertPassengerCanPurchase } from '../passengerCompliance/passengerCompliance.service.js';

const getActorId = (actor) => actor?.userId || actor?._id || null;
const normalizeNullableNumber = (value) => (value === '' || value === undefined ? null : value);
const normalizeRouteId = (routeId) => (routeId ? new mongoose.Types.ObjectId(routeId) : null);

const activeAtQuery = (date = new Date()) => ({
  status: 'ACTIVE',
  effectiveFrom: { $lte: date },
  $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: date } }],
});

const overlapQuery = ({ effectiveFrom, effectiveTo }) => ({
  effectiveFrom: { $lte: effectiveTo ? new Date(effectiveTo) : new Date('9999-12-31') },
  $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: new Date(effectiveFrom) } }],
});

const buildListFilter = (query = {}) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const pattern = new RegExp(String(query.search).trim(), 'i');
    filter.$or = [{ routeName: pattern }, { routeCode: pattern }, { note: pattern }];
  }

  return filter;
};

const paginate = async (model, filter, query = {}, populateRoute = true) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  let findQuery = model.find(filter).sort({ status: 1, effectiveFrom: -1, createdAt: -1 }).skip(skip).limit(limit).lean();
  if (populateRoute) {
    findQuery = findQuery.populate('routeId', 'routeNumber name distanceKm fare');
  }

  const [items, total] = await Promise.all([findQuery, model.countDocuments(filter)]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const assertNoActiveFareConflict = async (payload, ignoredId = null) => {
  if (payload.status && payload.status !== 'ACTIVE') {
    return;
  }

  const query = {
    status: 'ACTIVE',
    pricingType: payload.pricingType,
    ...overlapQuery(payload),
  };

  if (ignoredId) {
    query._id = { $ne: ignoredId };
  }

  if (payload.pricingType === 'ROUTE_BASED') {
    query.routeId = normalizeRouteId(payload.routeId);
  } else if (payload.pricingType === 'DEFAULT') {
    query.pricingType = 'DEFAULT';
  } else {
    const min = payload.minDistanceKm ?? 0;
    const max = payload.maxDistanceKm ?? Number.MAX_SAFE_INTEGER;
    query.$and = [
      {
        $or: [
          { minDistanceKm: null },
          { minDistanceKm: { $lte: max } },
        ],
      },
      {
        $or: [
          { maxDistanceKm: null },
          { maxDistanceKm: { $gte: min } },
        ],
      },
    ];
  }

  const existing = await FareMatrix.findOne(query).lean();
  if (existing) {
    throw new CustomError('An active fare rule already conflicts with this policy', HTTP_STATUS.CONFLICT);
  }
};

const assertNoActiveMonthlyConflict = async (payload, ignoredId = null) => {
  if (payload.status && payload.status !== 'ACTIVE') {
    return;
  }

  const query = {
    status: 'ACTIVE',
    passType: payload.passType,
    routeId: payload.passType === 'ROUTE_PASS' ? normalizeRouteId(payload.routeId) : null,
    ...overlapQuery(payload),
  };

  if (ignoredId) {
    query._id = { $ne: ignoredId };
  }

  const existing = await MonthlyPassPricing.findOne(query).lean();
  if (existing) {
    throw new CustomError('An active monthly pass pricing rule already conflicts with this policy', HTTP_STATUS.CONFLICT);
  }
};

const assertNoActiveDiscountConflict = async (payload, ignoredId = null) => {
  if (payload.status && payload.status !== 'ACTIVE') {
    return;
  }

  const query = {
    status: 'ACTIVE',
    priorityType: payload.priorityType,
    ...overlapQuery(payload),
  };

  if (ignoredId) {
    query._id = { $ne: ignoredId };
  }

  const existing = await PriorityDiscount.findOne(query).lean();
  if (existing) {
    throw new CustomError('An active priority discount already conflicts with this policy', HTTP_STATUS.CONFLICT);
  }
};

const mapPriorityType = (profileType) => {
  const normalized = String(profileType || '').toUpperCase();
  if (normalized === 'SENIOR') return 'ELDERLY';
  if (normalized === 'DISABLED') return 'DISABILITY';
  if (['STUDENT', 'ELDERLY', 'DISABILITY'].includes(normalized)) return normalized;
  return normalized ? 'OTHER' : null;
};

const getActivePriorityDiscount = async (passengerId, baseAmount, date = new Date()) => {
  if (!passengerId) {
    return { discountAmount: 0, discount: null, priorityType: null };
  }

  const passenger = await User.findById(passengerId).select('priorityStatus priorityProfile').lean();
  const approvedProfile = passenger?.priorityStatus === 'APPROVED' && passenger?.priorityProfile?.status === 'APPROVED';
  if (!approvedProfile) {
    return { discountAmount: 0, discount: null, priorityType: null };
  }

  const priorityType = mapPriorityType(passenger.priorityProfile.profileType);
  if (!priorityType) {
    return { discountAmount: 0, discount: null, priorityType: null };
  }

  const discount = await PriorityDiscount.findOne({
    ...activeAtQuery(date),
    priorityType,
  }).sort({ effectiveFrom: -1 }).lean();

  if (!discount) {
    return { discountAmount: 0, discount: null, priorityType };
  }

  const percentageAmount = Math.round((Number(baseAmount) * Number(discount.discountPercent)) / 100);
  const discountAmount = discount.maxDiscountAmount
    ? Math.min(percentageAmount, Number(discount.maxDiscountAmount))
    : percentageAmount;

  return { discountAmount, discount, priorityType };
};

export class FareOperationsService {
  static listFareMatrix(query) {
    return paginate(FareMatrix, buildListFilter(query), query);
  }

  static async createFareMatrix(payload, actor) {
    const data = {
      ...payload,
      routeId: payload.routeId || null,
      baseFare: Number(payload.baseFare),
      minDistanceKm: normalizeNullableNumber(payload.minDistanceKm),
      maxDistanceKm: normalizeNullableNumber(payload.maxDistanceKm),
      currency: payload.currency || 'VND',
      status: payload.status || 'ACTIVE',
      createdBy: getActorId(actor),
      updatedBy: getActorId(actor),
    };
    await assertNoActiveFareConflict(data);
    return FareMatrix.create(data);
  }

  static async updateFareMatrix(id, payload, actor) {
    const existing = await FareMatrix.findById(id);
    if (!existing) {
      throw new CustomError('Fare matrix rule not found', HTTP_STATUS.NOT_FOUND);
    }

    const data = {
      ...payload,
      routeId: payload.routeId || null,
      baseFare: Number(payload.baseFare),
      minDistanceKm: normalizeNullableNumber(payload.minDistanceKm),
      maxDistanceKm: normalizeNullableNumber(payload.maxDistanceKm),
      currency: payload.currency || 'VND',
      updatedBy: getActorId(actor),
    };
    await assertNoActiveFareConflict(data, id);
    Object.assign(existing, data);
    await existing.save();
    return existing;
  }

  static async updateFareMatrixStatus(id, status, actor) {
    const existing = await FareMatrix.findById(id);
    if (!existing) throw new CustomError('Fare matrix rule not found', HTTP_STATUS.NOT_FOUND);
    await assertNoActiveFareConflict({ ...existing.toObject(), status }, id);
    existing.status = status;
    existing.updatedBy = getActorId(actor);
    await existing.save();
    return existing;
  }

  static async deleteFareMatrix(id, actor) {
    return this.updateFareMatrixStatus(id, 'INACTIVE', actor);
  }

  static listMonthlyPassPricing(query) {
    return paginate(MonthlyPassPricing, buildListFilter(query), query);
  }

  static async createMonthlyPassPricing(payload) {
    const data = {
      ...payload,
      routeId: payload.passType === 'ROUTE_PASS' ? payload.routeId : null,
      price: Number(payload.price),
      validityDays: Number(payload.validityDays) || 30,
      currency: payload.currency || 'VND',
      status: payload.status || 'ACTIVE',
    };
    await assertNoActiveMonthlyConflict(data);
    return MonthlyPassPricing.create(data);
  }

  static async updateMonthlyPassPricing(id, payload) {
    const existing = await MonthlyPassPricing.findById(id);
    if (!existing) throw new CustomError('Monthly pass pricing rule not found', HTTP_STATUS.NOT_FOUND);

    const data = {
      ...payload,
      routeId: payload.passType === 'ROUTE_PASS' ? payload.routeId : null,
      price: Number(payload.price),
      validityDays: Number(payload.validityDays) || 30,
      currency: payload.currency || 'VND',
    };
    await assertNoActiveMonthlyConflict(data, id);
    Object.assign(existing, data);
    await existing.save();
    return existing;
  }

  static async updateMonthlyPassPricingStatus(id, status) {
    const existing = await MonthlyPassPricing.findById(id);
    if (!existing) throw new CustomError('Monthly pass pricing rule not found', HTTP_STATUS.NOT_FOUND);
    await assertNoActiveMonthlyConflict({ ...existing.toObject(), status }, id);
    existing.status = status;
    await existing.save();
    return existing;
  }

  static async deleteMonthlyPassPricing(id) {
    return this.updateMonthlyPassPricingStatus(id, 'INACTIVE');
  }

  static listPriorityDiscounts(query) {
    const filter = buildListFilter(query);
    if (query.priorityType) {
      filter.priorityType = query.priorityType;
    }
    return paginate(PriorityDiscount, filter, query, false);
  }

  static async createPriorityDiscount(payload) {
    const data = {
      ...payload,
      discountPercent: Number(payload.discountPercent),
      maxDiscountAmount: normalizeNullableNumber(payload.maxDiscountAmount),
      status: payload.status || 'ACTIVE',
      requiredApproval: payload.requiredApproval ?? true,
    };
    await assertNoActiveDiscountConflict(data);
    return PriorityDiscount.create(data);
  }

  static async updatePriorityDiscount(id, payload) {
    const existing = await PriorityDiscount.findById(id);
    if (!existing) throw new CustomError('Priority discount policy not found', HTTP_STATUS.NOT_FOUND);

    const data = {
      ...payload,
      discountPercent: Number(payload.discountPercent),
      maxDiscountAmount: normalizeNullableNumber(payload.maxDiscountAmount),
      requiredApproval: payload.requiredApproval ?? true,
    };
    await assertNoActiveDiscountConflict(data, id);
    Object.assign(existing, data);
    await existing.save();
    return existing;
  }

  static async updatePriorityDiscountStatus(id, status) {
    const existing = await PriorityDiscount.findById(id);
    if (!existing) throw new CustomError('Priority discount policy not found', HTTP_STATUS.NOT_FOUND);
    await assertNoActiveDiscountConflict({ ...existing.toObject(), status }, id);
    existing.status = status;
    await existing.save();
    return existing;
  }

  static async deletePriorityDiscount(id) {
    return this.updatePriorityDiscountStatus(id, 'INACTIVE');
  }

  static async calculateOneWayFare({ routeId, distanceKm, passengerId, purchaseDate = new Date() }) {
    const date = new Date(purchaseDate);
    await assertPassengerCanPurchase({ passengerId, routeId, at: date });
    const routeObjectId = routeId && mongoose.isValidObjectId(routeId) ? new mongoose.Types.ObjectId(routeId) : null;
    const active = activeAtQuery(date);

    let rule = routeObjectId
      ? await FareMatrix.findOne({ ...active, pricingType: 'ROUTE_BASED', routeId: routeObjectId }).sort({ effectiveFrom: -1 }).lean()
      : null;

    if (!rule && distanceKm !== undefined && distanceKm !== null) {
      const distance = Number(distanceKm);
      rule = await FareMatrix.findOne({
        ...active,
        pricingType: 'DISTANCE_BASED',
        $and: [
          { $or: [{ minDistanceKm: null }, { minDistanceKm: { $lte: distance } }] },
          { $or: [{ maxDistanceKm: null }, { maxDistanceKm: { $gte: distance } }] },
        ],
      }).sort({ effectiveFrom: -1 }).lean();
    }

    if (!rule) {
      rule = await FareMatrix.findOne({ ...active, pricingType: 'DEFAULT' }).sort({ effectiveFrom: -1 }).lean();
    }

    if (!rule) {
      throw new CustomError('No active fare rule is available for this trip', HTTP_STATUS.NOT_FOUND);
    }

    const baseFare = Number(rule.baseFare);
    const priority = await getActivePriorityDiscount(passengerId, baseFare, date);
    const finalFare = Math.max(baseFare - priority.discountAmount, 0);

    return {
      baseFare,
      discountAmount: priority.discountAmount,
      finalFare,
      currency: rule.currency,
      fareRule: rule,
      priorityDiscount: priority.discount,
      priorityType: priority.priorityType,
    };
  }

  static async calculateMonthlyPassPrice({ routeId, passType, passengerId, purchaseDate = new Date() }) {
    const date = new Date(purchaseDate);
    await assertPassengerCanPurchase({ passengerId, routeId, at: date });
    const active = activeAtQuery(date);
    const normalizedPassType = passType || 'ROUTE_PASS';
    const routeObjectId = routeId && mongoose.isValidObjectId(routeId) ? new mongoose.Types.ObjectId(routeId) : null;

    const query = {
      ...active,
      passType: normalizedPassType,
      routeId: normalizedPassType === 'ROUTE_PASS' ? routeObjectId : null,
    };

    const rule = await MonthlyPassPricing.findOne(query).sort({ effectiveFrom: -1 }).lean();
    if (!rule) {
      throw new CustomError('No active monthly pass pricing rule is available', HTTP_STATUS.NOT_FOUND);
    }

    const basePrice = Number(rule.price);
    const priority = await getActivePriorityDiscount(passengerId, basePrice, date);
    const finalPrice = Math.max(basePrice - priority.discountAmount, 0);

    return {
      basePrice,
      discountAmount: priority.discountAmount,
      finalPrice,
      currency: rule.currency,
      pricingRule: rule,
      priorityDiscount: priority.discount,
      priorityType: priority.priorityType,
      validityDays: rule.validityDays,
    };
  }
}

export const calculateOneWayFare = FareOperationsService.calculateOneWayFare;
export const calculateMonthlyPassPrice = FareOperationsService.calculateMonthlyPassPrice;

export default FareOperationsService;
