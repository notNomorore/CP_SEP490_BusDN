import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import BusRoute from '../admin/BusRoute.js';
import TripSchedule from '../admin/TripSchedule.js';
import Route from '../routes/Route.js';
import AssistantShiftAssignment from '../shifts/AssistantShiftAssignment.js';
import Shift from '../shifts/Shift.js';
import ShiftAssignment from '../scheduleOperations/ShiftAssignment.js';
import Trip from '../fleetOperations/Trip.js';
import User from '../auth/User.js';
import WalkInTicket from '../walkInTickets/WalkInTicket.js';
import { createAuditLog } from '../systemMonitoring/auditLogger.js';
import BoardingRecord from './BoardingRecord.js';
import RevenueSummary from './RevenueSummary.js';
import Ticket from './Ticket.js';
import Transaction from './Transaction.js';

const ACTIVE_TICKET_STATUSES = ['ACTIVE', 'VALID', 'PAID', 'CONFIRMED'];
const USED_TICKET_STATUSES = ['USED', 'BOARDED', 'CONSUMED'];
const ACTIVE_ROUTE_STATUSES = ['ACTIVE', 'PUBLISHED'];
const ACTIVE_TRIP_STATUSES = ['scheduled', 'active', 'paused', 'delayed', 'PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
const COMPLETED_TRANSACTION_STATUSES = ['COMPLETED'];
const E_PAYMENT_METHODS = ['QR', 'E_WALLET'];

const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const idText = (value) => value ? String(value._id || value) : '';
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const todayRange = (value = new Date()) => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const createCode = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

const isSameId = (left, right) => {
  if (!left || !right) return false;
  return idText(left) === idText(right);
};

const routeInfo = (route) => route ? {
  _id: route._id,
  routeCode: route.routeCode || route.routeNumber || route.code || '',
  routeName: route.routeName || route.name || '',
  name: route.routeName || route.name || route.routeCode || route.routeNumber || '',
  status: route.status,
} : null;

const tripInfo = (trip) => trip ? {
  _id: trip._id,
  routeId: trip.routeId,
  vehicleId: trip.vehicleId || trip.vehicle?.busId || null,
  status: trip.status,
  departureTime: trip.departureTime || trip.plannedStartTime || trip.actualStartTime || null,
} : null;

const formatTicket = (ticket) => ticket ? {
  _id: ticket._id,
  ticketCode: ticket.ticketCode || ticket.code || '',
  qrCode: ticket.qrCode || '',
  ticketType: ticket.ticketType || ticket.type || 'E_TICKET',
  passengerType: ticket.passengerType || '',
  passengerQuantity: number(ticket.passengerQuantity || ticket.passengerCount || ticket.quantity, 1),
  status: ticket.status,
  amount: number(ticket.amount || ticket.totalAmount || ticket.finalAmount),
  expiresAt: ticket.expiresAt || ticket.validUntil || null,
  usedAt: ticket.usedAt || null,
} : null;

const passengerInfo = async (ticket) => {
  const passengerId = ticket?.passengerId || ticket?.userId || ticket?.customerId;
  const user = passengerId && mongoose.isValidObjectId(passengerId)
    ? await User.findById(passengerId).select('fullName email phoneNumber phone role').lean()
    : null;
  return {
    _id: user?._id || passengerId || null,
    fullName: user?.fullName || ticket?.passengerName || ticket?.customerName || '',
    email: user?.email || ticket?.passengerEmail || '',
    phone: user?.phoneNumber || user?.phone || ticket?.passengerPhone || '',
  };
};

const findRoute = async (routeId) => {
  if (!mongoose.isValidObjectId(routeId)) return null;
  return (await BusRoute.findById(routeId).lean()) || (await Route.findById(routeId).lean());
};

const findTrip = async (tripId) => {
  if (!mongoose.isValidObjectId(tripId)) return null;
  return (await Trip.findById(tripId).lean()) || (await TripSchedule.findById(tripId).lean());
};

const assertActiveRoute = async (routeId) => {
  const route = await findRoute(routeId);
  if (!route || !ACTIVE_ROUTE_STATUSES.includes(route.status)) {
    throw new CustomError('Route is not active', HTTP_STATUS.BAD_REQUEST);
  }
  return route;
};

const assertActiveTrip = async (tripId) => {
  const trip = await findTrip(tripId);
  if (!trip || !ACTIVE_TRIP_STATUSES.includes(trip.status)) {
    throw new CustomError('Trip is not active', HTTP_STATUS.BAD_REQUEST);
  }
  return trip;
};

const findAssistantShift = async ({ assistantId, shiftId, tripId, date }) => {
  if (shiftId) {
    const assignment = await AssistantShiftAssignment.findOne({
      assistantId,
      shiftId,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
    }).populate('shiftId').lean();
    if (assignment) return { shiftId: assignment.shiftId?._id || assignment.shiftId, assignment, shift: assignment.shiftId };

    const shift = await Shift.findById(shiftId).lean();
    const scheduleAssignment = await ShiftAssignment.findOne({
      busAssistant: assistantId,
      ...(shift?.shiftCode ? { shiftCode: shift.shiftCode } : { _id: null }),
      ...(tripId ? { trip: tripId } : {}),
      shiftStatus: { $in: ['ASSIGNED', 'CONFIRMED', 'COMPLETED'] },
    }).lean();
    if (scheduleAssignment) return { shiftId, assignment: scheduleAssignment, shift };
  }

  if (tripId) {
    const scheduleAssignment = await ShiftAssignment.findOne({
      busAssistant: assistantId,
      trip: tripId,
      shiftStatus: { $in: ['ASSIGNED', 'CONFIRMED', 'COMPLETED'] },
    }).lean();
    if (scheduleAssignment) {
      const shift = await Shift.findOne({ shiftCode: scheduleAssignment.shiftCode }).lean();
      return { shiftId: shift?._id || null, assignment: scheduleAssignment, shift };
    }
  }

  const { start, end } = todayRange(date);
  const assignment = await AssistantShiftAssignment.findOne({
    assistantId,
    workDate: { $gte: start, $lte: end },
    status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
  }).populate('shiftId').sort({ updatedAt: -1 }).lean();

  if (!assignment) return null;
  return { shiftId: assignment.shiftId?._id || assignment.shiftId, assignment, shift: assignment.shiftId };
};

const assertAssignedShift = async ({ assistantId, shiftId, tripId, date }) => {
  const shiftContext = await findAssistantShift({ assistantId, shiftId, tripId, date });
  if (!shiftContext || (shiftId && !isSameId(shiftContext.shiftId, shiftId))) {
    throw new CustomError('Shift not found or not assigned to this bus assistant', HTTP_STATUS.FORBIDDEN);
  }
  return shiftContext;
};

const calculateFare = (route, passengerType, submittedAmount, passengerQuantity) => {
  const fareConfig = route?.fareConfig || {};
  const normalizedType = String(passengerType || '').toUpperCase();
  const baseFare = number(
    normalizedType === 'STUDENT' ? fareConfig.studentFare : normalizedType === 'CHILD' ? fareConfig.childFare : fareConfig.baseFare,
    number(route?.fare)
  );
  const calculated = baseFare > 0 ? baseFare * passengerQuantity : number(submittedAmount);
  return {
    farePerPassenger: passengerQuantity ? calculated / passengerQuantity : calculated,
    totalAmount: calculated,
    discountAmount: Math.max(number(submittedAmount) - calculated, 0),
  };
};

const transactionFilter = ({ assistantId, shiftId, routeId, date }) => {
  const filter = {
    busAssistantId: assistantId,
    status: { $in: COMPLETED_TRANSACTION_STATUSES },
  };
  if (shiftId) filter.shiftId = toObjectId(shiftId);
  if (routeId) filter.routeId = toObjectId(routeId);
  if (date) {
    const { start, end } = todayRange(date);
    filter.completedAt = { $gte: start, $lte: end };
  }
  return filter;
};

const buildRevenue = async ({ assistantId, shiftId, routeId, date, limit = 10 }) => {
  const transactions = await Transaction.find(transactionFilter({ assistantId, shiftId, routeId, date }))
    .sort({ completedAt: -1 })
    .lean();
  const boardingCount = await BoardingRecord.countDocuments({
    busAssistantId: assistantId,
    validationStatus: 'VALIDATED',
    ...(shiftId ? { shiftId } : {}),
    ...(routeId ? { routeId } : {}),
  });

  const breakdown = new Map();
  const methodBreakdown = new Map();
  transactions.forEach((item) => {
    const ticketType = item.ticketType || 'WALK_IN';
    const byType = breakdown.get(ticketType) || { ticketType, tickets: 0, revenue: 0, discountAmount: 0 };
    byType.tickets += 1;
    byType.revenue += number(item.finalAmount || item.amount);
    byType.discountAmount += number(item.discountAmount);
    breakdown.set(ticketType, byType);

    const method = item.paymentMethod || 'CASH';
    const byMethod = methodBreakdown.get(method) || { paymentMethod: method, transactions: 0, amount: 0 };
    byMethod.transactions += 1;
    byMethod.amount += number(item.finalAmount || item.amount);
    methodBreakdown.set(method, byMethod);
  });

  const totalRevenue = transactions.reduce((total, item) => total + number(item.finalAmount || item.amount), 0);
  const cashCollected = transactions
    .filter((item) => item.paymentMethod === 'CASH')
    .reduce((total, item) => total + number(item.finalAmount || item.amount), 0);
  const ePaymentAmount = transactions
    .filter((item) => E_PAYMENT_METHODS.includes(item.paymentMethod))
    .reduce((total, item) => total + number(item.finalAmount || item.amount), 0);
  const discountAmount = transactions.reduce((total, item) => total + number(item.discountAmount), 0);

  return {
    totalTicketsSold: transactions.length,
    totalRevenue,
    cashCollected,
    ePaymentAmount,
    discountAmount,
    validatedETickets: boardingCount,
    revenueBreakdown: [...breakdown.values()],
    paymentMethodBreakdown: [...methodBreakdown.values()],
    recentTransactions: transactions.slice(0, limit).map((item) => ({
      _id: item._id,
      transactionCode: item.transactionCode,
      ticketType: item.ticketType,
      paymentMethod: item.paymentMethod,
      amount: number(item.finalAmount || item.amount),
      status: item.status,
      completedAt: item.completedAt,
    })),
  };
};

export class BusAssistantService {
  static async validateETicket(payload, actor, req) {
    const trip = await assertActiveTrip(payload.tripId);
    const route = await findRoute(trip.routeId);
    const shiftContext = await assertAssignedShift({
      assistantId: actor.userId,
      tripId: payload.tripId,
    });

    const ticket = await Ticket.findOne({
      $or: [
        { qrCode: String(payload.qrCode).trim() },
        { ticketCode: String(payload.qrCode).trim() },
        { code: String(payload.qrCode).trim() },
      ],
    });

    if (!ticket) throw new CustomError('Ticket not found', HTTP_STATUS.NOT_FOUND);

    const status = String(ticket.status || '').toUpperCase();
    if (USED_TICKET_STATUSES.includes(status) || ticket.usedAt) {
      throw new CustomError('Ticket already used', HTTP_STATUS.CONFLICT);
    }
    if (!ACTIVE_TICKET_STATUSES.includes(status)) {
      throw new CustomError('Ticket is not active', HTTP_STATUS.BAD_REQUEST);
    }

    const expiry = ticket.expiresAt || ticket.validUntil;
    if (expiry && new Date(expiry) < new Date()) {
      throw new CustomError('Ticket expired', HTTP_STATUS.BAD_REQUEST);
    }

    if (ticket.tripId && !isSameId(ticket.tripId, payload.tripId)) {
      throw new CustomError('Ticket does not match this trip', HTTP_STATUS.BAD_REQUEST);
    }
    if (ticket.routeId && trip.routeId && !isSameId(ticket.routeId, trip.routeId)) {
      throw new CustomError('Ticket does not match this route', HTTP_STATUS.BAD_REQUEST);
    }

    ticket.status = 'USED';
    ticket.usedAt = new Date();
    ticket.validatedBy = actor.userId;
    await ticket.save();

    const boardingRecord = await BoardingRecord.create({
      ticketId: ticket._id,
      ticketCode: ticket.ticketCode || ticket.code || '',
      qrCode: ticket.qrCode || payload.qrCode,
      passengerId: ticket.passengerId || ticket.userId || null,
      busAssistantId: actor.userId,
      routeId: ticket.routeId || trip.routeId || null,
      tripId: payload.tripId,
      vehicleId: payload.vehicleId,
      shiftId: shiftContext.shiftId || null,
      validationStatus: 'VALIDATED',
    });

    await createAuditLog({
      req,
      user: actor,
      action: 'VALIDATE_E_TICKET',
      module: 'BUS_ASSISTANT',
      description: 'Bus assistant validated an E-ticket QR code.',
      resourceType: 'Ticket',
      resourceId: ticket._id,
      metadata: { tripId: payload.tripId, vehicleId: payload.vehicleId, boardingRecordId: boardingRecord._id },
    });

    return {
      validationStatus: 'VALIDATED',
      ticketInfo: formatTicket(ticket),
      passengerInfo: await passengerInfo(ticket),
      routeInfo: routeInfo(route),
      message: 'E-ticket validated successfully',
    };
  }

  static async createWalkInTicket(payload, actor, req) {
    const passengerQuantity = number(payload.passengerQuantity);
    if (passengerQuantity <= 0) {
      throw new CustomError('Invalid passenger quantity', HTTP_STATUS.BAD_REQUEST);
    }

    const [route, trip] = await Promise.all([
      assertActiveRoute(payload.routeId),
      assertActiveTrip(payload.tripId),
    ]);
    if (trip.routeId && !isSameId(trip.routeId, payload.routeId)) {
      throw new CustomError('Trip does not belong to this route', HTTP_STATUS.BAD_REQUEST);
    }

    const shiftContext = await assertAssignedShift({
      assistantId: actor.userId,
      tripId: payload.tripId,
    });
    const fare = calculateFare(route, payload.passengerType, payload.amount, passengerQuantity);

    const ticket = await WalkInTicket.create({
      ticketCode: createCode('WI'),
      busAssistantId: actor.userId,
      routeId: payload.routeId,
      tripId: payload.tripId,
      shiftId: shiftContext.shiftId || null,
      passengerCount: passengerQuantity,
      farePerPassenger: fare.farePerPassenger,
      totalAmount: fare.totalAmount,
      collectedAmount: fare.totalAmount,
      paymentMethod: payload.paymentMethod,
      status: 'COMPLETED',
      notes: `fromStopId=${payload.fromStopId}; toStopId=${payload.toStopId}; passengerType=${payload.passengerType}; ticketType=${payload.ticketType}; nonRefundable=true`,
    });

    const transaction = await Transaction.create({
      transactionCode: createCode('TXN'),
      walkInTicketId: ticket._id,
      busAssistantId: actor.userId,
      routeId: payload.routeId,
      tripId: payload.tripId,
      shiftId: shiftContext.shiftId || null,
      ticketType: 'WALK_IN',
      paymentMethod: payload.paymentMethod,
      amount: fare.totalAmount,
      discountAmount: fare.discountAmount,
      finalAmount: fare.totalAmount,
      status: 'COMPLETED',
      completedAt: new Date(),
      source: 'BUS_ASSISTANT',
      nonRefundable: true,
    });

    ticket.transactionId = transaction._id;
    await ticket.save();

    await createAuditLog({
      req,
      user: actor,
      action: 'CREATE_WALKIN_TICKET',
      module: 'BUS_ASSISTANT',
      description: 'Bus assistant created a walk-in ticket.',
      resourceType: 'WalkInTicket',
      resourceId: ticket._id,
      metadata: { transactionId: transaction._id, totalAmount: fare.totalAmount },
    });

    return {
      ticketData: ticket.toObject(),
      transactionData: transaction.toObject(),
      totalAmount: fare.totalAmount,
      message: 'Walk-in ticket created successfully',
    };
  }

  static async getShiftRevenue(query, actor, req) {
    const shiftContext = await assertAssignedShift({
      assistantId: actor.userId,
      shiftId: query.shiftId,
      date: query.date,
    });
    const revenue = await buildRevenue({
      assistantId: actor.userId,
      shiftId: shiftContext.shiftId,
      routeId: query.routeId,
      date: query.date,
    });

    await createAuditLog({
      req,
      user: actor,
      action: 'VIEW_SHIFT_REVENUE',
      module: 'BUS_ASSISTANT',
      description: 'Bus assistant viewed shift revenue.',
      metadata: { shiftId: shiftContext.shiftId, routeId: query.routeId || null, date: query.date || null },
    });

    return {
      shiftInfo: {
        _id: shiftContext.shiftId,
        shiftCode: shiftContext.shift?.shiftCode || shiftContext.assignment?.shiftCode || '',
        shiftName: shiftContext.shift?.shiftName || '',
        status: shiftContext.shift?.status || shiftContext.assignment?.status || shiftContext.assignment?.shiftStatus || '',
        workDate: shiftContext.shift?.workDate || shiftContext.assignment?.workDate || null,
      },
      ...revenue,
    };
  }

  static async submitRevenueSummary(payload, actor, req) {
    const shiftContext = await assertAssignedShift({
      assistantId: actor.userId,
      shiftId: payload.shiftId,
    });

    const existing = await RevenueSummary.findOne({
      shiftId: payload.shiftId,
      busAssistantId: actor.userId,
    }).lean();
    if (existing) {
      throw new CustomError('Revenue summary already submitted', HTTP_STATUS.CONFLICT);
    }

    const revenue = await buildRevenue({
      assistantId: actor.userId,
      shiftId: shiftContext.shiftId,
    });
    const actualCollectedAmount = number(payload.actualCollectedAmount);
    const differenceAmount = actualCollectedAmount - revenue.totalRevenue;
    const summary = await RevenueSummary.create({
      shiftId: shiftContext.shiftId,
      busAssistantId: actor.userId,
      systemAmount: revenue.totalRevenue,
      actualCollectedAmount,
      differenceAmount,
      reconciliationStatus: differenceAmount === 0 ? 'MATCHED' : 'DISCREPANCY',
      note: payload.note || '',
      attachmentUrls: payload.attachmentUrls || [],
    });

    await Promise.all([
      Shift.findByIdAndUpdate(shiftContext.shiftId, { status: 'SUMMARY_SUBMITTED', updatedBy: actor.userId }),
      AssistantShiftAssignment.updateMany(
        { shiftId: shiftContext.shiftId, assistantId: actor.userId },
        { status: 'COMPLETED', updatedBy: actor.userId }
      ),
      ShiftAssignment.updateMany(
        { busAssistant: actor.userId, ...(shiftContext.assignment?.trip ? { trip: shiftContext.assignment.trip } : {}) },
        { shiftStatus: 'COMPLETED' }
      ),
    ]);

    await createAuditLog({
      req,
      user: actor,
      action: 'SUBMIT_REVENUE_SUMMARY',
      module: 'BUS_ASSISTANT',
      description: 'Bus assistant submitted end-of-shift revenue summary.',
      resourceType: 'RevenueSummary',
      resourceId: summary._id,
      riskLevel: summary.reconciliationStatus === 'DISCREPANCY' ? 'MEDIUM' : 'LOW',
      metadata: { shiftId: shiftContext.shiftId, systemAmount: revenue.totalRevenue, actualCollectedAmount, differenceAmount },
    });

    return {
      summary: summary.toObject(),
      systemAmount: revenue.totalRevenue,
      actualCollectedAmount,
      differenceAmount,
      reconciliationStatus: summary.reconciliationStatus,
      message: 'Revenue summary submitted successfully',
    };
  }
}

export default BusAssistantService;
