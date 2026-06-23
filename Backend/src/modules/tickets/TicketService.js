import crypto from 'crypto';
import mongoose from 'mongoose';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import RouteService from '../routes/RouteService.js';
import Ticket from './Ticket.js';
import MonthlyPass from './MonthlyPass.js';

const PAYMENT_METHODS = new Set(['CREDIT_CARD', 'E_WALLET', 'CASHLESS']);
const MONTHLY_PASS_PAYMENT_METHODS = new Set(['CREDIT_CARD', 'E_WALLET', 'ONLINE_BANKING']);
const MONTHLY_PASS_PRICES = {
  STANDARD: 250000,
  STUDENT: 120000,
  PRIORITY: 0,
};

const normalizeDate = (value) => {
  const rawValue = String(value || '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? new Date(`${rawValue}T00:00:00.000Z`)
    : value
      ? new Date(value)
      : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new CustomError('Service date is invalid', HTTP_STATUS.BAD_REQUEST);
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const buildTicketCode = () => `TKT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
const buildPassCode = () => `MP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();

const buildServiceDateTime = (serviceDate, time = '23:59') => {
  const date = new Date(serviceDate);
  const datePart = date.toISOString().slice(0, 10);
  const normalizedTime = /^\d{2}:\d{2}$/.test(String(time)) ? time : '23:59';
  return new Date(`${datePart}T${normalizedTime}:00+07:00`);
};

const getTicketExpiryDate = (ticket) => new Date(
  buildServiceDateTime(ticket.serviceDate, ticket.departureTime || '23:59').getTime()
  + 3 * 60 * 60 * 1000
);

export class TicketService {
  static async findRoute(routeId) {
    await RouteService.ensureSampleRoutes();

    try {
      return await Route.findOne({ _id: routeId, status: 'ACTIVE' }).lean();
    } catch {
      return null;
    }
  }

  static findStop(route, stopName) {
    return (route.stops || []).find((stop) => (
      stop.name.toLowerCase() === String(stopName || '').trim().toLowerCase()
    ));
  }

  static calculatePrice(route, startStop, endStop) {
    const routeStopCount = Math.max((route.stops || []).length - 1, 1);
    const stopSpan = Math.max(endStop.order - startStop.order, 1);
    return Math.max(Math.round((route.fare / routeStopCount) * stopSpan), Math.round(route.fare * 0.35));
  }

  static async purchaseOneWayTicket(userId, payload) {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const route = await this.findRoute(payload.routeId);
    if (!route) {
      throw new CustomError('Selected trip or route does not exist', HTTP_STATUS.NOT_FOUND);
    }

    const startStop = this.findStop(route, payload.departureLocation) || route.stops?.[0];
    const endStop = this.findStop(route, payload.destinationLocation) || route.stops?.[route.stops.length - 1];

    if (!startStop || !endStop || startStop.order >= endStop.order) {
      throw new CustomError('Invalid departure or destination for this one-way ticket', HTTP_STATUS.BAD_REQUEST);
    }

    const seatNumber = String(payload.seatNumber || '').trim().toUpperCase();
    if (!/^[A-Z]?\d{1,2}$/.test(seatNumber)) {
      throw new CustomError('Seat number is required and must be valid', HTTP_STATUS.BAD_REQUEST);
    }

    const paymentMethod = String(payload.paymentMethod || '').trim().toUpperCase();
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      throw new CustomError('Invalid payment method', HTTP_STATUS.BAD_REQUEST);
    }

    if (String(payload.paymentReference || '').trim().toUpperCase() === 'FAIL') {
      throw new CustomError('Payment processing failed. Please try again.', HTTP_STATUS.BAD_REQUEST);
    }

    const serviceDate = normalizeDate(payload.serviceDate);
    const departureTime = payload.departureTime || route.operatingHours?.firstDeparture || '05:30';
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) {
      throw new CustomError('Departure time is invalid', HTTP_STATUS.BAD_REQUEST);
    }
    const tripId = payload.tripId?.trim() || `${route.routeNumber}-${serviceDate.toISOString().slice(0, 10)}-${departureTime}`;

    const existingSeat = await Ticket.findOne({
      routeId: route._id,
      tripId,
      serviceDate,
      seatNumber,
      bookingStatus: { $in: ['PENDING', 'SUCCESS'] },
    }).lean();

    if (existingSeat) {
      throw new CustomError('Selected seat is already booked. Please choose another seat.', HTTP_STATUS.CONFLICT);
    }

    const ticketPrice = this.calculatePrice(route, startStop, endStop);
    const ticketCode = buildTicketCode();
    const qrPayload = JSON.stringify({
      ticketCode,
      routeNumber: route.routeNumber,
      tripId,
      seatNumber,
      passengerId: String(user._id),
    });

    const ticket = await Ticket.create({
      ticketCode,
      passenger: user._id,
      routeId: route._id,
      routeNumber: route.routeNumber,
      tripId,
      departureLocation: startStop.name,
      destinationLocation: endStop.name,
      seatNumber,
      ticketPrice,
      paymentMethod,
      paymentStatus: 'PAID',
      bookingStatus: 'SUCCESS',
      ticketStatus: 'ACTIVE',
      serviceDate,
      departureTime,
      digitalTicket: {
        qrPayload,
        issuedAt: new Date(),
      },
    });

    const boardedAt = buildServiceDateTime(serviceDate, departureTime);
    user.travelHistory.push({
      routeNumber: route.routeNumber,
      tripId,
      ticketCode,
      ticketType: 'ONE_WAY',
      fromStop: startStop.name,
      toStop: endStop.name,
      boardedAt,
      arrivedAt: new Date(boardedAt.getTime() + (route.estimatedDurationMinutes || 0) * 60 * 1000),
      durationMinutes: route.estimatedDurationMinutes || 0,
      fare: ticketPrice,
      vehicleLabel: payload.vehicleLabel || '',
      paymentMethod,
      status: 'COMPLETED',
    });
    await user.save();

    return ticket.toObject();
  }

  static async listMyTickets(userId) {
    const tickets = await Ticket.find({ passenger: userId })
      .sort({ purchasedAt: -1 })
      .populate('routeId')
      .populate('passenger', 'fullName email phoneNumber')
      .lean();

    return Promise.all(tickets.map((ticket) => this.buildTicketView(ticket)));
  }

  static getCurrentTicketStatus(ticket) {
    if (ticket.bookingStatus === 'CANCELLED' || ticket.ticketStatus === 'CANCELLED') {
      return 'CANCELLED';
    }

    if (ticket.ticketStatus === 'USED' || ticket.usedAt) {
      return 'USED';
    }

    if (ticket.paymentStatus !== 'PAID' || ticket.bookingStatus !== 'SUCCESS') {
      return 'PENDING';
    }

    if (getTicketExpiryDate(ticket) < new Date()) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }

  static buildTripProgress(ticket, route) {
    const stops = (route?.stops || []).map((stop) => ({
      name: stop.name,
      order: stop.order,
      latitude: stop.latitude,
      longitude: stop.longitude,
      isBoardingPoint: stop.name === ticket.departureLocation,
      isDestination: stop.name === ticket.destinationLocation,
    }));
    const boardingIndex = stops.findIndex((stop) => stop.name === ticket.departureLocation);
    const destinationIndex = stops.findIndex((stop) => stop.name === ticket.destinationLocation);
    const safeBoardingIndex = Math.max(boardingIndex, 0);
    const safeDestinationIndex = destinationIndex >= safeBoardingIndex ? destinationIndex : stops.length - 1;

    return {
      routeName: route?.name || ticket.routeNumber,
      estimatedDurationMinutes: route?.estimatedDurationMinutes || 0,
      estimatedArrivalTime: ticket.departureTime
        ? `${ticket.departureTime} + ${route?.estimatedDurationMinutes || 0} min`
        : 'Not available',
      boardingPoint: ticket.departureLocation,
      destinationPoint: ticket.destinationLocation,
      stops,
      completedStops: stops.slice(0, safeBoardingIndex),
      remainingStops: stops.slice(safeBoardingIndex, safeDestinationIndex + 1),
      progressPercent: stops.length > 1
        ? Math.round((safeBoardingIndex / (stops.length - 1)) * 100)
        : 0,
    };
  }

  static async buildTicketView(ticket) {
    const route = ticket.routeId && typeof ticket.routeId === 'object'
      ? ticket.routeId
      : await Route.findById(ticket.routeId).lean();
    const passenger = ticket.passenger && typeof ticket.passenger === 'object'
      ? ticket.passenger
      : await User.findById(ticket.passenger).select('fullName email phoneNumber').lean();
    const status = this.getCurrentTicketStatus(ticket);
    const isCancelable = status === 'ACTIVE';

    return {
      ...ticket,
      id: String(ticket._id),
      ticketId: ticket.ticketCode,
      ticketType: 'ONE_WAY',
      status,
      canCancel: isCancelable,
      qrCode: {
        payload: ticket.digitalTicket?.qrPayload || JSON.stringify({
          ticketCode: ticket.ticketCode,
          passengerId: String(ticket.passenger?._id || ticket.passenger),
        }),
        issuedAt: ticket.digitalTicket?.issuedAt,
      },
      passengerInfo: {
        fullName: passenger?.fullName || 'Passenger',
        email: passenger?.email || '',
        phoneNumber: passenger?.phoneNumber || '',
      },
      tripInfo: this.buildTripProgress(ticket, route),
      actionAvailability: {
        download: true,
        share: true,
        addToCalendar: status === 'ACTIVE',
        cancel: isCancelable,
      },
      importantNotes: [
        'Please arrive at the stop at least 5 minutes before departure.',
        'Keep your QR code visible and show it when boarding.',
        'This ticket is for personal use only and cannot be transferred.',
        'Used or expired tickets cannot be cancelled.',
      ],
    };
  }

  static async getMyTicketById(userId, ticketId) {
    if (!mongoose.isValidObjectId(ticketId)) {
      throw new CustomError('Ticket information is unavailable.', HTTP_STATUS.NOT_FOUND);
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      passenger: userId,
    })
      .populate('routeId')
      .populate('passenger', 'fullName email phoneNumber')
      .lean();

    if (!ticket) {
      throw new CustomError('Ticket information is unavailable.', HTTP_STATUS.NOT_FOUND);
    }

    const view = await this.buildTicketView(ticket);
    if (view.status === 'EXPIRED') {
      return { ...view, statusMessage: 'This ticket has expired.' };
    }
    if (view.status === 'USED') {
      return { ...view, statusMessage: 'This ticket has already been used.' };
    }
    return view;
  }

  static async cancelMyTicket(userId, ticketId) {
    if (!mongoose.isValidObjectId(ticketId)) {
      throw new CustomError('Ticket information is unavailable.', HTTP_STATUS.NOT_FOUND);
    }

    const ticket = await Ticket.findOne({ _id: ticketId, passenger: userId });
    if (!ticket) {
      throw new CustomError('Ticket information is unavailable.', HTTP_STATUS.NOT_FOUND);
    }

    const status = this.getCurrentTicketStatus(ticket);
    if (status === 'USED') {
      throw new CustomError('This ticket has already been used.', HTTP_STATUS.BAD_REQUEST);
    }
    if (status === 'EXPIRED') {
      throw new CustomError('This ticket has expired.', HTTP_STATUS.BAD_REQUEST);
    }
    if (status === 'CANCELLED') {
      throw new CustomError('This ticket is already cancelled.', HTTP_STATUS.BAD_REQUEST);
    }

    ticket.bookingStatus = 'CANCELLED';
    ticket.ticketStatus = 'CANCELLED';
    ticket.cancelledAt = new Date();
    await ticket.save();

    return this.getMyTicketById(userId, ticket._id);
  }

  static normalizePassType(value) {
    const passType = String(value || 'STANDARD').trim().toUpperCase();
    return Object.keys(MONTHLY_PASS_PRICES).includes(passType) ? passType : null;
  }

  static addMonths(date, months) {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  }

  static async purchaseMonthlyPass(userId, payload) {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const passType = this.normalizePassType(payload.passType);
    if (!passType) {
      throw new CustomError('Selected monthly pass option is unavailable', HTTP_STATUS.BAD_REQUEST);
    }

    const paymentMethod = String(payload.paymentMethod || '').trim().toUpperCase();
    if (!MONTHLY_PASS_PAYMENT_METHODS.has(paymentMethod)) {
      throw new CustomError('Invalid payment method', HTTP_STATUS.BAD_REQUEST);
    }

    if (String(payload.paymentReference || '').trim().toUpperCase() === 'FAIL') {
      throw new CustomError('Payment processing failed. Please retry the transaction.', HTTP_STATUS.BAD_REQUEST);
    }

    const activePass = await MonthlyPass.findOne({
      passenger: user._id,
      passType,
      passStatus: 'ACTIVE',
      expiryDate: { $gte: new Date() },
    }).lean();

    if (activePass && !payload.renew) {
      throw new CustomError('You already have an active monthly pass of this type.', HTTP_STATUS.CONFLICT);
    }

    const startDate = normalizeDate(payload.startDate);
    const validityMonths = Math.max(Number(payload.validityMonths) || 1, 1);
    const expiryDate = this.addMonths(startDate, validityMonths);
    const passPrice = MONTHLY_PASS_PRICES[passType] * validityMonths;
    const passCode = buildPassCode();
    const qrPayload = JSON.stringify({
      passCode,
      passengerId: String(user._id),
      passType,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
    });

    const monthlyPass = await MonthlyPass.create({
      passCode,
      passenger: user._id,
      passType,
      startDate,
      expiryDate,
      passPrice,
      paymentMethod,
      paymentStatus: 'PAID',
      passStatus: 'ACTIVE',
      digitalPass: {
        qrPayload,
        issuedAt: new Date(),
      },
    });

    user.monthlyPassStatus = 'ACTIVE';
    user.monthlyPassExpireDate = expiryDate;
    await user.save();

    return monthlyPass.toObject();
  }

  static async listMyMonthlyPasses(userId) {
    return MonthlyPass.find({ passenger: userId }).sort({ purchasedAt: -1 }).lean();
  }
}

export default TicketService;
