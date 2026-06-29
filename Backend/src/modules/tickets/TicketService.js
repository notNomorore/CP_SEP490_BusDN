import crypto from 'crypto';
import mongoose from 'mongoose';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import User from '../auth/User.js';
import Route from '../routes/Route.js';
import RouteService from '../routes/RouteService.js';
import Ticket from './Ticket.js';
import MonthlyPass from './MonthlyPass.js';
import QRCodeService from './QRCodeService.js';

const PASSENGER_TYPES = new Set(['STANDARD', 'STUDENT', 'PRIORITY']);
const MONTHLY_PASS_PRICES = {
  STANDARD: 250000,
  STUDENT: 120000,
  PRIORITY: 0,
};

const parseServiceDateParts = (value) => {
  const dateMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const storedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  const isValidDate = storedDate.getUTCFullYear() === year
    && storedDate.getUTCMonth() === month - 1
    && storedDate.getUTCDate() === day;

  return isValidDate ? { year, month, day } : null;
};

const buildStoredServiceDate = (value) => {
  const parts = parseServiceDateParts(value);
  if (!parts) {
    return null;
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
};

const buildVietnamDepartureDate = (serviceDate, departureTime) => {
  const dateParts = parseServiceDateParts(serviceDate);
  const timeMatch = String(departureTime || '').match(/^(\d{2}):(\d{2})$/);

  if (!dateParts || !timeMatch) {
    return null;
  }

  const { year, month, day } = dateParts;
  const [, hours, minutes] = timeMatch.map(Number);

  if (
    month < 1 || month > 12
    || day < 1 || day > 31
    || hours < 0 || hours > 23
    || minutes < 0 || minutes > 59
  ) {
    return null;
  }

  // Vietnam uses UTC+7 year-round, so subtract seven hours to obtain UTC.
  const departureDate = new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0, 0));
  const vietnamParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(departureDate).reduce((parts, part) => {
    parts[part.type] = part.value;
    return parts;
  }, {});

  const isValid = Number(vietnamParts.year) === year
    && Number(vietnamParts.month) === month
    && Number(vietnamParts.day) === day
    && Number(vietnamParts.hour) === hours
    && Number(vietnamParts.minute) === minutes;

  return isValid ? departureDate : null;
};

const buildTicketCode = () => `TKT-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
const buildPassCode = () => `MP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();

const roundFareToNearestThousand = (value) => {
  const amount = Number(value) || 0;
  if (amount <= 0) {
    return 0;
  }

  return Math.max(Math.round(amount / 1000) * 1000, 1000);
};

const getTicketExpiryDate = (ticket) => {
  if (ticket.validUntil) {
    return new Date(ticket.validUntil);
  }

  if (ticket.expiresAt || ticket.digitalTicket?.expiresAt) {
    return new Date(ticket.expiresAt || ticket.digitalTicket.expiresAt);
  }

  const serviceDate = new Date(ticket.serviceDate);
  const dateValue = [
    serviceDate.getUTCFullYear(),
    String(serviceDate.getUTCMonth() + 1).padStart(2, '0'),
    String(serviceDate.getUTCDate()).padStart(2, '0'),
  ].join('-');

  return buildVietnamDepartureDate(dateValue, ticket.departureTime || '23:59') || serviceDate;
};

const normalizeDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new CustomError('NgÃ y Ä‘Ã£ chá»n khÃ´ng há»£p lá»‡', HTTP_STATUS.BAD_REQUEST);
  }

  date.setHours(0, 0, 0, 0);
  return date;
};

const formatVietnamOffsetDateTime = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`;
};

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);

const buildValidationResult = (result, message, data = {}) => ({
  ok: result === 'VALID',
  result,
  message,
  ...data,
});

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
    const proportionalFare = (route.fare / routeStopCount) * stopSpan;
    const minimumFare = route.fare * 0.35;
    return roundFareToNearestThousand(Math.max(proportionalFare, minimumFare));
  }

  static async generateUniqueTicketCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ticketCode = buildTicketCode();
      // eslint-disable-next-line no-await-in-loop
      const existingTicket = await Ticket.exists({ ticketCode });
      if (!existingTicket) {
        return ticketCode;
      }
    }

    return `TKT-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
  }

  static async purchaseOneWayTicket(userId, payload) {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError('Không tìm thấy người dùng', HTTP_STATUS.NOT_FOUND);
    }

    const route = await this.findRoute(payload.routeId);
    if (!route) {
      throw new CustomError('Chuyến đi hoặc tuyến xe đã chọn không tồn tại', HTTP_STATUS.NOT_FOUND);
    }

    const startStop = this.findStop(route, payload.departureLocation);
    const endStop = this.findStop(route, payload.destinationLocation);

    if (!startStop || !endStop) {
      throw new CustomError('Diem di hoac diem den khong thuoc tuyen da chon', HTTP_STATUS.BAD_REQUEST);
    }

    if (startStop.order >= endStop.order) {
      throw new CustomError('Điểm đi hoặc điểm đến không hợp lệ', HTTP_STATUS.BAD_REQUEST);
    }

    const passengerType = String(payload.passengerType || 'STANDARD').trim().toUpperCase();
    if (!PASSENGER_TYPES.has(passengerType)) {
      throw new CustomError('Loại vé không hợp lệ', HTTP_STATUS.BAD_REQUEST);
    }

    const paymentMethod = '';


    const departureTime = payload.departureTime || route.operatingHours?.firstDeparture || '05:30';
    const departureDate = buildVietnamDepartureDate(payload.serviceDate, departureTime);

    if (!departureDate) {
      throw new CustomError('Ngày đi hoặc giờ khởi hành không hợp lệ', HTTP_STATUS.BAD_REQUEST);
    }

    if (departureDate.getTime() <= Date.now()) {
      throw new CustomError(
        'Không thể mua vé cho chuyến xe đã khởi hành. Vui lòng chọn thời gian trong tương lai.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const serviceDate = buildStoredServiceDate(payload.serviceDate);
    if (!serviceDate) {
      throw new CustomError('Ngày đi không hợp lệ', HTTP_STATUS.BAD_REQUEST);
    }
    const serviceDateValue = String(payload.serviceDate || '').slice(0, 10);
    const tripId = `${route.routeNumber}-${serviceDateValue}-${departureTime}`;

    const ticketPrice = this.calculatePrice(route, startStop, endStop);
    const ticketCode = await this.generateUniqueTicketCode();
    const ticket = new Ticket({
      ticketCode,
      ticketType: 'ONE_WAY',
      passenger: user._id,
      routeId: route._id,
      routeCode: route.routeNumber,
      routeNumber: route.routeNumber,
      tripId,
      departureLocation: startStop.name,
      destinationLocation: endStop.name,
      passengerType,
      ticketPrice,
      paymentMethod,
      paymentStatus: 'PENDING',
      bookingStatus: 'PENDING',
      ticketStatus: 'ACTIVE',
      serviceDate,
      departureTime,
    });

    const validFrom = departureDate;
    const validUntil = addHours(validFrom, 2);
    const digitalTicket = await QRCodeService.buildTicketQRCode({
      type: 'BUS_TICKET',
      ticketCode,
      ticketType: 'ONE_WAY',
      routeCode: route.routeNumber,
      fromStop: startStop.name,
      toStop: endStop.name,
      validFrom: formatVietnamOffsetDateTime(validFrom),
      validUntil: formatVietnamOffsetDateTime(validUntil),
    });

    ticket.validFrom = validFrom;
    ticket.validUntil = validUntil;
    ticket.expiresAt = validUntil;
    ticket.digitalTicket = {
      ...digitalTicket,
      issuedAt: new Date(digitalTicket.issuedAt),
      expiresAt: validUntil,
    };

    await ticket.save();

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
    const isCancelable = status === 'ACTIVE' || status === 'PENDING';

    return {
      ...ticket,
      id: String(ticket._id),
      ticketId: ticket.ticketCode,
      ticketType: 'ONE_WAY',
      passengerType: ticket.passengerType || 'STANDARD',
      status,
      canCancel: isCancelable,
      qrCode: {
        payload: ticket.digitalTicket?.qrPayload || JSON.stringify({
          app: 'BusDN',
          type: 'BUS_TICKET',
          ticketCode: ticket.ticketCode,
          ticketType: ticket.ticketType || 'ONE_WAY',
          routeCode: ticket.routeCode || ticket.routeNumber,
          validFrom: ticket.validFrom ? formatVietnamOffsetDateTime(new Date(ticket.validFrom)) : undefined,
          validUntil: ticket.validUntil ? formatVietnamOffsetDateTime(new Date(ticket.validUntil)) : undefined,
        }),
        data: ticket.digitalTicket?.qrCodeData || '',
        image: ticket.digitalTicket?.qrCodeImage || '',
        signature: ticket.digitalTicket?.qrSignature || '',
        issuedAt: ticket.digitalTicket?.issuedAt,
        validFrom: ticket.validFrom,
        validUntil: ticket.validUntil || ticket.expiresAt || ticket.digitalTicket?.expiresAt,
        expiresAt: ticket.validUntil || ticket.expiresAt || ticket.digitalTicket?.expiresAt,
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
        'Vui lòng có mặt tại điểm dừng ít nhất 5 phút trước giờ khởi hành.',
        'Giữ mã QR rõ ràng và xuất trình khi lên xe.',
        'Vé chỉ dành cho cá nhân và không được chuyển nhượng.',
        'Không thể hủy vé đã sử dụng hoặc hết hạn.',
      ],
    };
  }

  static async getMyTicketById(userId, ticketId) {
    if (!mongoose.isValidObjectId(ticketId)) {
      throw new CustomError('Không tìm thấy thông tin vé.', HTTP_STATUS.NOT_FOUND);
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      passenger: userId,
    })
      .populate('routeId')
      .populate('passenger', 'fullName email phoneNumber')
      .lean();

    if (!ticket) {
      throw new CustomError('Không tìm thấy thông tin vé.', HTTP_STATUS.NOT_FOUND);
    }

    const view = await this.buildTicketView(ticket);
    if (view.status === 'EXPIRED') {
      return { ...view, statusMessage: 'Vé này đã hết hạn.' };
    }
    if (view.status === 'USED') {
      return { ...view, statusMessage: 'Vé này đã được sử dụng.' };
    }
    return view;
  }

  static async cancelMyTicket(userId, ticketId) {
    if (!mongoose.isValidObjectId(ticketId)) {
      throw new CustomError('Không tìm thấy thông tin vé.', HTTP_STATUS.NOT_FOUND);
    }

    const ticket = await Ticket.findOne({ _id: ticketId, passenger: userId });
    if (!ticket) {
      throw new CustomError('Không tìm thấy thông tin vé.', HTTP_STATUS.NOT_FOUND);
    }

    const status = this.getCurrentTicketStatus(ticket);
    if (status === 'USED') {
      throw new CustomError('Vé này đã được sử dụng.', HTTP_STATUS.BAD_REQUEST);
    }
    if (status === 'EXPIRED') {
      throw new CustomError('Vé này đã hết hạn.', HTTP_STATUS.BAD_REQUEST);
    }
    if (status === 'CANCELLED') {
      throw new CustomError('Vé này đã được hủy trước đó.', HTTP_STATUS.BAD_REQUEST);
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
      throw new CustomError('Không tìm thấy người dùng', HTTP_STATUS.NOT_FOUND);
    }

    const passType = this.normalizePassType(payload.passType);
    if (!passType) {
      throw new CustomError('Loại vé tháng đã chọn không khả dụng', HTTP_STATUS.BAD_REQUEST);
    }

    const paymentMethod = '';


    const activePass = await MonthlyPass.findOne({
      passenger: user._id,
      passType,
      passStatus: 'ACTIVE',
      expiryDate: { $gte: new Date() },
    }).lean();

    if (activePass && !payload.renew) {
      throw new CustomError('Bạn đang có một vé tháng cùng loại còn hiệu lực.', HTTP_STATUS.CONFLICT);
    }

    const selectedRoute = payload.routeId ? await this.findRoute(payload.routeId) : null;
    if (payload.routeId && !selectedRoute) {
      throw new CustomError('Tuyen xe da chon khong ton tai', HTTP_STATUS.NOT_FOUND);
    }

    const routeCode = selectedRoute?.routeNumber || String(payload.routeCode || 'ALL').trim().toUpperCase();
    const startDate = normalizeDate(payload.startDate);
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    if (startDate < currentMonthStart) {
      throw new CustomError('Khong the dat ve thang cho thang da qua', HTTP_STATUS.BAD_REQUEST);
    }

    const validityMonths = Math.max(Number(payload.validityMonths) || 1, 1);
    const expiryDate = new Date(this.addMonths(startDate, validityMonths).getTime() - 1);
    const duplicatePendingPass = await MonthlyPass.findOne({
      passenger: user._id,
      passType,
      routeCode,
      passStatus: 'PENDING',
      startDate,
      expiryDate,
    }).lean();

    if (duplicatePendingPass && !payload.renew) {
      throw new CustomError('Ban da co ve thang cung tuyen va thoi han dang cho xu ly.', HTTP_STATUS.CONFLICT);
    }

    const passPrice = MONTHLY_PASS_PRICES[passType] * validityMonths;
    const passCode = buildPassCode();
    const issuedAt = new Date();

    const monthlyPass = new MonthlyPass({
      passCode,
      passenger: user._id,
      routeId: selectedRoute?._id,
      routeCode,
      passType,
      startDate,
      expiryDate,
      validFrom: startDate,
      validUntil: expiryDate,
      passPrice,
      paymentMethod,
      paymentStatus: 'PENDING',
      passStatus: 'PENDING',
      digitalPass: {
        issuedAt,
        expiresAt: expiryDate,
      },
    });

    const refreshedDigitalPass = await QRCodeService.buildTicketQRCode({
      type: 'MONTHLY_PASS',
      passCode,
      routeCode,
      passengerName: user.fullName || user.email || 'Passenger',
      validFrom: formatVietnamOffsetDateTime(startDate),
      validUntil: formatVietnamOffsetDateTime(expiryDate),
    });
    monthlyPass.digitalPass = {
      ...refreshedDigitalPass,
      issuedAt: new Date(refreshedDigitalPass.issuedAt),
      expiresAt: expiryDate,
    };

    await monthlyPass.save();

    return monthlyPass.toObject();
  }

  static async listMyMonthlyPasses(userId) {
    return MonthlyPass.find({ passenger: userId }).sort({ purchasedAt: -1 }).lean();
  }

  static getValidationMessage(status) {
    return {
      USED: 'Already used',
      EXPIRED: 'Expired ticket',
      CANCELLED: 'Cancelled ticket',
      PENDING: 'Ticket is not active',
    }[status] || 'Invalid QR';
  }

  static extractManualCode(input) {
    const value = String(input || '').trim();
    if (!value) return '';

    const signedPayload = QRCodeService.decodePayload(value);
    if (signedPayload?.data) {
      return signedPayload.data.ticketCode || signedPayload.data.passCode || '';
    }

    try {
      const parsed = JSON.parse(value);
      return parsed.ticketCode || parsed.passCode || parsed.code || '';
    } catch {
      return value;
    }
  }

  static async validateQRCode(validatorUserId, payload = {}) {
    const scannedValue = payload.qrPayload || payload.qrCodeData || payload.code || payload.ticketCode || '';
    const signedPayload = QRCodeService.decodePayload(scannedValue);
    const isSignedScan = Boolean(signedPayload);

    if (!isSignedScan) {
      try {
        const parsedPayload = JSON.parse(String(scannedValue || '').trim());
        if (parsedPayload?.app === 'BusDN') {
          return buildValidationResult('INVALID_QR', 'QR signature is missing or invalid.');
        }
      } catch {
        // Manual ticket/pass code entry is still supported for staff testing.
      }
    }

    if (isSignedScan && !QRCodeService.verifySignedPayload(signedPayload)) {
      return buildValidationResult('INVALID_QR', 'QR signature is invalid.');
    }

    const qrData = signedPayload?.data || {};
    const manualCode = this.extractManualCode(scannedValue);
    const ticketCode = qrData.ticketCode || (String(manualCode).startsWith('TKT-') ? manualCode : '');
    const passCode = qrData.passCode || (String(manualCode).startsWith('MP-') ? manualCode : '');

    if (isSignedScan && qrData.app !== 'BusDN') {
      return buildValidationResult('INVALID_QR', 'QR does not belong to BusDN.');
    }

    if (isSignedScan && !signedPayload.legacy && !['BUS_TICKET', 'MONTHLY_PASS'].includes(qrData.type)) {
      return buildValidationResult('INVALID_QR', 'QR ticket type is invalid.');
    }

    if (qrData.type === 'MONTHLY_PASS' || qrData.ticketType === 'MONTHLY_PASS' || passCode) {
      return this.validateMonthlyPassQR(validatorUserId, {
        signedPayload,
        passCode,
        routeId: payload.routeId,
        routeCode: payload.routeCode,
      });
    }

    if (!ticketCode) {
      return buildValidationResult('INVALID_QR', 'QR payload is invalid.');
    }

    const ticket = await Ticket.findOne({ ticketCode: String(ticketCode).trim().toUpperCase() })
      .populate('passenger', 'fullName email phoneNumber')
      .populate('routeId')
      .exec();

    if (!ticket) {
      return buildValidationResult('NOT_FOUND', 'Ticket was not found.', { ticketCode });
    }

    if (isSignedScan) {
      const expectedValues = [
        ['ticketCode', ticket.ticketCode],
        ['routeCode', ticket.routeCode || ticket.routeNumber],
        ['ticketType', 'ONE_WAY'],
      ];

      const hasMismatch = expectedValues.some(([key, expected]) => (
        qrData[key] && String(qrData[key]) !== String(expected)
      ));

      if (hasMismatch) {
        return buildValidationResult('INVALID_QR', 'QR content does not match ticket record.');
      }
    }

    if (payload.routeId && String(payload.routeId) !== String(ticket.routeId?._id || ticket.routeId)) {
      return buildValidationResult('WRONG_ROUTE', 'Ticket is not valid for this route.', {
        ticketCode: ticket.ticketCode,
        routeCode: ticket.routeCode || ticket.routeNumber,
      });
    }

    if (payload.routeCode && String(payload.routeCode).toUpperCase() !== String(ticket.routeCode || ticket.routeNumber).toUpperCase()) {
      return buildValidationResult('WRONG_ROUTE', 'Ticket is not valid for this route.', {
        ticketCode: ticket.ticketCode,
        routeCode: ticket.routeCode || ticket.routeNumber,
      });
    }

    if ((payload.tripId || payload.scheduleId) && String(payload.tripId || payload.scheduleId) !== ticket.tripId) {
      return buildValidationResult('WRONG_ROUTE', 'Ticket is not valid for this trip.', {
        ticketCode: ticket.ticketCode,
        tripId: ticket.tripId,
      });
    }

    const status = this.getCurrentTicketStatus(ticket);
    if (status !== 'ACTIVE') {
      return buildValidationResult({
        USED: 'ALREADY_USED',
        EXPIRED: 'EXPIRED',
        CANCELLED: 'CANCELLED',
      }[status] || 'INVALID_QR', this.getValidationMessage(status), {
        ticketCode: ticket.ticketCode,
        ticketType: ticket.ticketType || 'ONE_WAY',
        routeCode: ticket.routeCode || ticket.routeNumber,
        validUntil: ticket.validUntil || ticket.expiresAt,
      });
    }

    const validationMessage = 'Ticket is valid for boarding.';
    ticket.ticketStatus = 'USED';
    ticket.usedAt = new Date();
    ticket.validatedBy = validatorUserId;
    ticket.validatedTripId = payload.tripId || payload.scheduleId || ticket.tripId;
    ticket.validationLogs.push({
      validatedAt: ticket.usedAt,
      validatedBy: validatorUserId,
      result: 'VALID',
      tripId: ticket.validatedTripId,
      routeCode: ticket.routeCode || ticket.routeNumber,
      message: validationMessage,
    });
    await ticket.save();

    return buildValidationResult('VALID', validationMessage, {
      ticketType: 'ONE_WAY',
      ticketCode: ticket.ticketCode,
      status: 'USED',
      passengerName: ticket.passenger?.fullName || 'Passenger',
      routeCode: ticket.routeCode || ticket.routeNumber,
      routeNumber: ticket.routeNumber,
      tripId: ticket.tripId,
      validFrom: ticket.validFrom,
      validUntil: ticket.validUntil || ticket.expiresAt,
      usedAt: ticket.usedAt,
    });
  }

  static async validateMonthlyPassQR(validatorUserId, { signedPayload, passCode, routeId, routeCode }) {
    if (!passCode) {
      return buildValidationResult('INVALID_QR', 'QR payload is invalid.');
    }

    const monthlyPass = await MonthlyPass.findOne({ passCode: String(passCode).trim().toUpperCase() })
      .populate('passenger', 'fullName email phoneNumber')
      .exec();

    if (!monthlyPass) {
      return buildValidationResult('NOT_FOUND', 'Monthly pass was not found.', { passCode });
    }

    if (signedPayload) {
      const qrData = signedPayload.data || {};
      const expectedValues = [
        ['passCode', monthlyPass.passCode],
        ['routeCode', monthlyPass.routeCode || 'ALL'],
      ];

      const hasMismatch = expectedValues.some(([key, expected]) => (
        qrData[key] && String(qrData[key]) !== String(expected)
      ));

      if (hasMismatch) {
        return buildValidationResult('INVALID_QR', 'QR content does not match monthly pass record.');
      }
    }

    if (routeId) {
      const route = await this.findRoute(routeId);
      if (monthlyPass.routeId && String(monthlyPass.routeId) !== String(route?._id)) {
        return buildValidationResult('WRONG_ROUTE', 'Monthly pass is not valid for this route.', {
          passCode: monthlyPass.passCode,
          routeCode: monthlyPass.routeCode || 'ALL',
        });
      }
    }

    if (
      routeCode
      && monthlyPass.routeCode
      && monthlyPass.routeCode !== 'ALL'
      && String(routeCode).toUpperCase() !== String(monthlyPass.routeCode).toUpperCase()
    ) {
      return buildValidationResult('WRONG_ROUTE', 'Monthly pass is not valid for this route.', {
        passCode: monthlyPass.passCode,
        routeCode: monthlyPass.routeCode,
      });
    }

    const now = new Date();
    if (monthlyPass.passStatus === 'CANCELLED') {
      return buildValidationResult('CANCELLED', 'Cancelled ticket', { passCode: monthlyPass.passCode });
    }
    if (monthlyPass.passStatus !== 'ACTIVE') {
      return buildValidationResult('INVALID_QR', 'Ticket is not active', { passCode: monthlyPass.passCode });
    }
    if (new Date(monthlyPass.validFrom || monthlyPass.startDate) > now || new Date(monthlyPass.validUntil || monthlyPass.expiryDate) < now) {
      return buildValidationResult('EXPIRED', 'Expired ticket', {
        passCode: monthlyPass.passCode,
        validUntil: monthlyPass.validUntil || monthlyPass.expiryDate,
      });
    }

    const validationMessage = 'Monthly pass is valid for boarding.';
    monthlyPass.validationLogs.push({
      validatedAt: new Date(),
      validatedBy: validatorUserId,
      result: 'VALID',
      routeCode: routeCode || monthlyPass.routeCode || 'ALL',
      message: validationMessage,
    });
    await monthlyPass.save();

    return buildValidationResult('VALID', validationMessage, {
      ticketType: 'MONTHLY_PASS',
      passCode: monthlyPass.passCode,
      status: 'ACTIVE',
      passengerName: monthlyPass.passenger?.fullName || 'Passenger',
      passType: monthlyPass.passType,
      routeCode: monthlyPass.routeCode || 'ALL',
      validatedBy: validatorUserId,
      validFrom: monthlyPass.validFrom || monthlyPass.startDate,
      validUntil: monthlyPass.validUntil || monthlyPass.expiryDate,
    });
  }
}

export default TicketService;
