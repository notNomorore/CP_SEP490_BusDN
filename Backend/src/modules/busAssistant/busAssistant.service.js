import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
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
import QRCode from 'qrcode';
import PayOSService from '../tickets/PayOSService.js';
import { config } from '../../config/environment.js';

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
  return Route.findById(routeId).lean();
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

    // Các màn vận hành hiện lấy phân công trực tiếp từ TripSchedule. Vì vậy
    // việc bán/kiểm tra vé phải công nhận cùng nguồn phân công này, thay vì
    // chỉ dựa vào các bản ghi ShiftAssignment kiểu cũ.
    const tripSchedule = await TripSchedule.findOne({
      _id: tripId,
      'assistant.userId': assistantId,
      status: { $ne: 'CANCELLED' },
    }).lean();

    if (tripSchedule) {
      const { start, end } = todayRange(tripSchedule.serviceDate || date);
      const assistantShift = await AssistantShiftAssignment.findOne({
        assistantId,
        workDate: { $gte: start, $lte: end },
        status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
      }).populate('shiftId').sort({ updatedAt: -1 }).lean();

      return {
        shiftId: assistantShift?.shiftId?._id || assistantShift?.shiftId || null,
        assignment: assistantShift || tripSchedule,
        shift: assistantShift?.shiftId || null,
      };
    }
  }

  const { start, end } = todayRange(date);
  const assignment = await AssistantShiftAssignment.findOne({
    assistantId,
    workDate: { $gte: start, $lte: end },
    status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
  }).populate('shiftId').sort({ updatedAt: -1 }).lean();

  if (!assignment) {
    // TripSchedule is the current source of truth for bus-assistant assignments.
    // Revenue requests only provide a date, so accept a direct trip assignment
    // for that service date even when no legacy shift record exists.
    const directTripAssignment = await TripSchedule.findOne({
      'assistant.userId': assistantId,
      serviceDate: { $gte: start, $lte: end },
      status: { $ne: 'CANCELLED' },
    }).sort({ departureTime: 1 }).lean();

    if (!directTripAssignment) return null;
    return {
      shiftId: null,
      assignment: directTripAssignment,
      shift: null,
    };
  }
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
  const boardingDateFilter = date ? todayRange(date) : null;
  const boardingCount = await BoardingRecord.countDocuments({
    busAssistantId: assistantId,
    validationStatus: 'VALIDATED',
    ...(shiftId ? { shiftId } : {}),
    ...(routeId ? { routeId } : {}),
    ...(boardingDateFilter ? { boardedAt: { $gte: boardingDateFilter.start, $lte: boardingDateFilter.end } } : {}),
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
    let shiftContext = await findAssistantShift({
      assistantId: actor.userId,
      tripId: payload.tripId,
      date: trip.serviceDate,
    });

    // TripSchedule là nguồn phân công chính của màn vận hành. Một chuyến có
    // đúng assistant.userId phải được phép kiểm tra vé kể cả khi dữ liệu ca cũ
    // chưa được đồng bộ sang AssistantShiftAssignment/ShiftAssignment.
    if (!shiftContext && isSameId(trip.assistant?.userId, actor.userId)) {
      shiftContext = { shiftId: null, assignment: trip, shift: null };
    }

    if (!shiftContext) {
      throw new CustomError('Trip is not assigned to this bus assistant', HTTP_STATUS.FORBIDDEN);
    }

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

    let shiftContext = await findAssistantShift({
      assistantId: actor.userId,
      tripId: payload.tripId,
      date: trip.serviceDate,
    });

    if (!shiftContext && isSameId(trip.assistant?.userId, actor.userId)) {
      shiftContext = { shiftId: null, assignment: trip, shift: null };
    }

    if (!shiftContext) {
      throw new CustomError('Trip is not assigned to this bus assistant', HTTP_STATUS.FORBIDDEN);
    }
    const fare = calculateFare(route, payload.passengerType, payload.amount, passengerQuantity);
    const cashReceived = number(payload.cashReceived);
    if (payload.paymentMethod === 'CASH' && cashReceived < fare.totalAmount) {
      throw new CustomError('Cash received is less than the ticket total', HTTP_STATUS.BAD_REQUEST);
    }
    const changeAmount = payload.paymentMethod === 'CASH' ? cashReceived - fare.totalAmount : 0;

    const ticketCode = createCode('WI');
    const isBankTransfer = payload.paymentMethod === 'BANK_TRANSFER';
    // Validate PayOS before creating pending ticket/transaction records. This also
    // prevents crypto.createHmac from receiving an undefined checksum key.
    if (isBankTransfer) PayOSService.assertConfigured();
    const ticket = await WalkInTicket.create({
      ticketCode,
      busAssistantId: actor.userId,
      routeId: payload.routeId,
      tripId: payload.tripId,
      shiftId: shiftContext.shiftId || null,
      passengerCount: passengerQuantity,
      farePerPassenger: fare.farePerPassenger,
      totalAmount: fare.totalAmount,
      collectedAmount: isBankTransfer ? 0 : fare.totalAmount,
      paymentMethod: payload.paymentMethod,
      status: isBankTransfer ? 'PENDING' : 'COMPLETED',
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
      paymentMethod: isBankTransfer ? 'QR' : 'CASH',
      amount: fare.totalAmount,
      discountAmount: fare.discountAmount,
      finalAmount: fare.totalAmount,
      status: isBankTransfer ? 'PENDING' : 'COMPLETED',
      completedAt: isBankTransfer ? null : new Date(),
      source: 'BUS_ASSISTANT',
      nonRefundable: true,
      cashReceived: isBankTransfer ? null : cashReceived,
      changeAmount: isBankTransfer ? 0 : changeAmount,
    });

    ticket.transactionId = transaction._id;
    await ticket.save();

    let payment = null;
    let qrCodeImage = null;
    if (isBankTransfer) {
      const orderCode = Number(String(Date.now()).slice(-10));
      payment = await PayOSService.createPaymentLink({
        orderCode,
        amount: Math.round(fare.totalAmount),
        description: `BusDN ${ticketCode}`,
        returnUrl: `${config.frontend.url}/bus-assistant/walkin-ticket?payment=success`,
        cancelUrl: `${config.frontend.url}/bus-assistant/walkin-ticket?payment=cancelled`,
      });
      qrCodeImage = payment.qrCode ? await QRCode.toDataURL(payment.qrCode, { width: 360, margin: 2 }) : null;
      transaction.set({ orderCode, checkoutUrl: payment.checkoutUrl, paymentQrCode: payment.qrCode });
      await transaction.save();
    }

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
      qrCodeImage,
      checkoutUrl: payment?.checkoutUrl || null,
      requiresPaymentConfirmation: isBankTransfer,
      cashReceived: isBankTransfer ? null : cashReceived,
      changeAmount: isBankTransfer ? 0 : changeAmount,
      message: 'Walk-in ticket created successfully',
    };
  }

  static async confirmWalkInPayment(ticketId, actor, req) {
    if (!mongoose.isValidObjectId(ticketId)) throw new CustomError('Invalid walk-in ticket identifier', HTTP_STATUS.BAD_REQUEST);
    const ticket = await WalkInTicket.findOne({ _id: ticketId, busAssistantId: actor.userId });
    if (!ticket) throw new CustomError('Walk-in ticket not found', HTTP_STATUS.NOT_FOUND);
    if (ticket.status === 'COMPLETED') {
      return { ticketData: ticket.toObject(), message: 'Walk-in ticket payment was already confirmed' };
    }
    const transaction = await Transaction.findOne({ walkInTicketId: ticket._id, busAssistantId: actor.userId });
    if (!transaction?.orderCode) {
      throw new CustomError('Payment order was not found', HTTP_STATUS.NOT_FOUND);
    }
    const paymentInfo = await PayOSService.getPaymentLinkInformation(transaction.orderCode);
    if (String(paymentInfo?.status || '').toUpperCase() !== 'PAID') {
      throw new CustomError('Bank transfer has not been completed', HTTP_STATUS.CONFLICT);
    }
    ticket.status = 'COMPLETED';
    ticket.collectedAmount = ticket.totalAmount;
    await ticket.save();
    if (transaction) {
      transaction.status = 'COMPLETED';
      transaction.completedAt = new Date();
      await transaction.save();
    }
    await createAuditLog({
      req,
      user: actor,
      action: 'CONFIRM_WALKIN_PAYMENT',
      module: 'BUS_ASSISTANT',
      description: 'Bus assistant confirmed a walk-in bank transfer payment.',
      resourceType: 'WalkInTicket',
      resourceId: ticket._id,
      metadata: { transactionId: transaction?._id, totalAmount: ticket.totalAmount },
    });
    return { ticketData: ticket.toObject(), transactionData: transaction?.toObject(), message: 'Walk-in payment confirmed successfully' };
  }

  static async getWalkInTicketHistory(query, actor) {
    const selectedDate = query.date ? new Date(`${query.date}T00:00:00`) : new Date();
    if (Number.isNaN(selectedDate.getTime())) {
      throw new CustomError('Invalid history date', HTTP_STATUS.BAD_REQUEST);
    }
    const { start, end } = todayRange(selectedDate);
    const tickets = await WalkInTicket.find({
      busAssistantId: actor.userId,
      issuedAt: { $gte: start, $lte: end },
    })
      .populate('routeId', 'routeCode routeName name')
      .populate('transactionId', 'checkoutUrl paymentQrCode orderCode status')
      .sort({ issuedAt: -1 })
      .limit(200)
      .lean();

    return {
      date: start.toISOString().slice(0, 10),
      count: tickets.length,
      totalRevenue: tickets.filter((ticket) => ticket.status === 'COMPLETED').reduce((sum, ticket) => sum + number(ticket.collectedAmount), 0),
      tickets: tickets.map((ticket) => ({
        _id: ticket._id,
        ticketCode: ticket.ticketCode,
        issuedAt: ticket.issuedAt,
        routeCode: ticket.routeId?.routeCode || '',
        routeName: ticket.routeId?.routeName || ticket.routeId?.name || '',
        tripId: ticket.tripId,
        passengerCount: ticket.passengerCount,
        paymentMethod: ticket.paymentMethod,
        totalAmount: ticket.totalAmount,
        collectedAmount: ticket.collectedAmount,
        status: ticket.status,
        canResumePayment: ticket.status === 'PENDING' && ticket.paymentMethod === 'BANK_TRANSFER' && Boolean(ticket.transactionId?.checkoutUrl),
      })),
    };
  }

  static async resumeWalkInPayment(ticketId, actor) {
    if (!mongoose.isValidObjectId(ticketId)) throw new CustomError('Invalid walk-in ticket identifier', HTTP_STATUS.BAD_REQUEST);
    const ticket = await WalkInTicket.findOne({ _id: ticketId, busAssistantId: actor.userId });
    if (!ticket) throw new CustomError('Walk-in ticket not found', HTTP_STATUS.NOT_FOUND);
    const transaction = await Transaction.findOne({ walkInTicketId: ticket._id, busAssistantId: actor.userId });
    if (!transaction?.orderCode || !transaction?.checkoutUrl || !transaction?.paymentQrCode) {
      throw new CustomError('Payment QR is no longer available', HTTP_STATUS.NOT_FOUND);
    }

    const paymentInfo = await PayOSService.getPaymentLinkInformation(transaction.orderCode);
    if (String(paymentInfo?.status || '').toUpperCase() === 'PAID') {
      ticket.status = 'COMPLETED';
      ticket.collectedAmount = ticket.totalAmount;
      transaction.status = 'COMPLETED';
      transaction.completedAt = new Date();
      await Promise.all([ticket.save(), transaction.save()]);
      return {
        ticketData: ticket.toObject(),
        totalAmount: ticket.totalAmount,
        requiresPaymentConfirmation: false,
        paymentCompleted: true,
        message: 'Walk-in payment completed successfully',
      };
    }

    return {
      ticketData: ticket.toObject(),
      totalAmount: ticket.totalAmount,
      qrCodeImage: await QRCode.toDataURL(transaction.paymentQrCode, { width: 360, margin: 2 }),
      checkoutUrl: transaction.checkoutUrl,
      requiresPaymentConfirmation: true,
      resumed: true,
      message: 'Walk-in payment resumed successfully',
    };
  }

  static async getShiftRevenue(query, actor, req) {
    // Revenue belongs to the authenticated assistant and can be safely queried
    // by date. Do not reject the request when legacy shift records are missing:
    // current assignments are stored on TripSchedule and completed transactions
    // remain valid even after the assigned trip/shift has ended.
    const shiftContext = await findAssistantShift({
      assistantId: actor.userId,
      shiftId: query.shiftId,
      date: query.date,
    });
    const revenue = await buildRevenue({
      assistantId: actor.userId,
      shiftId: query.shiftId || shiftContext?.shiftId || null,
      routeId: query.routeId,
      date: query.date,
    });

    await createAuditLog({
      req,
      user: actor,
      action: 'VIEW_SHIFT_REVENUE',
      module: 'BUS_ASSISTANT',
      description: 'Bus assistant viewed shift revenue.',
      metadata: { shiftId: query.shiftId || shiftContext?.shiftId || null, routeId: query.routeId || null, date: query.date || null },
    });

    return {
      shiftInfo: {
        _id: query.shiftId || shiftContext?.shiftId || null,
        shiftCode: shiftContext?.shift?.shiftCode || shiftContext?.assignment?.shiftCode || '',
        shiftName: shiftContext?.shift?.shiftName || '',
        status: shiftContext?.shift?.status || shiftContext?.assignment?.status || shiftContext?.assignment?.shiftStatus || '',
        workDate: shiftContext?.shift?.workDate || shiftContext?.assignment?.workDate || query.date || null,
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
