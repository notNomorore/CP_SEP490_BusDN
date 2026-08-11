import logger from '../../../utils/logger.js';
import notificationService from '../notification.service.js';

const normalizeId = (value) => (value ? String(value) : '');

const getPassengerName = (passenger) => passenger?.fullName || passenger?.name || '';

const getRouteName = (route, fallback = '') => (
  route?.routeName
  || route?.name
  || route?.routeCode
  || route?.routeNumber
  || fallback
);

const runNotificationSideEffect = async (eventName, task) => {
  try {
    return await task();
  } catch (error) {
    logger.error(`notification.trigger_failed.${eventName}`, {
      message: error.message,
    });
    return null;
  }
};

export const notifyFeedbackResponse = async ({
  supportCase,
  adminId,
  channels = { inApp: true, email: true },
  emailRecipients = [],
}) => {
  const passengerId = supportCase?.passenger?._id || supportCase?.passenger;
  if (!passengerId || !supportCase?._id) return null;

  return runNotificationSideEffect('feedback_response', () => notificationService.send({
    type: 'FEEDBACK_RESPONSE',
    title: 'Phản hồi mới',
    message: 'Quản trị viên đã phản hồi phản ánh của bạn.',
    target: {
      type: 'USER',
      userId: passengerId,
    },
    channels: {
      inApp: channels.inApp !== false,
      email: channels.email === true,
      push: false,
    },
    emailRecipients,
    priority: supportCase.priority === 'CRITICAL' ? 'urgent' : 'normal',
    actionUrl: supportCase.type === 'LOST_ITEM'
      ? `/lost-items/${supportCase._id}`
      : `/feedback/${supportCase._id}`,
    source: {
      module: 'feedback',
      entityId: supportCase._id,
    },
    data: {
      caseId: normalizeId(supportCase._id),
      passengerName: getPassengerName(supportCase.passenger),
      referenceNumber: supportCase.referenceNumber || '',
      feedbackType: supportCase.type || '',
    },
    deduplicationKey: `feedback:${supportCase._id}:response`,
    createdBy: adminId,
  }, { createdBy: adminId }));
};

export const notifyTripDelay = async ({ trip, io = null, actorId = null }) => {
  if (!trip?._id || !trip?.routeId) return null;

  return runNotificationSideEffect('trip_delay', () => notificationService.send({
    type: 'TRIP_DELAYED',
    title: 'Chuyến xe đang bị trễ',
    message: `Chuyến xe đang bị trễ${trip.delayMinutes ? ` khoảng ${trip.delayMinutes} phút` : ''}. Vui lòng theo dõi thông tin cập nhật trên BusDN.`,
    target: {
      type: 'ROUTE_PASSENGERS',
      routeId: trip.routeId,
    },
    channels: { inApp: true, push: false },
    priority: trip.delayMinutes >= 15 ? 'high' : 'normal',
    source: {
      module: 'trip',
      entityId: trip._id,
    },
    data: {
      tripId: normalizeId(trip._id),
      tripCode: trip.tripCode || trip.scheduleCode || '',
      routeId: normalizeId(trip.routeId),
      routeName: getRouteName(trip.route),
      delayMinutes: trip.delayMinutes || 0,
      status: trip.status || '',
    },
    deduplicationKey: `trip-delay:${trip._id}`,
    createdBy: actorId,
  }, { createdBy: actorId, io }));
};

export const notifyIncidentCreated = async ({ incident, io = null, actorId = null }) => {
  if (!incident?._id || !incident?.routeId) return null;

  return runNotificationSideEffect('incident_created', () => notificationService.send({
    type: 'INCIDENT_ALERT',
    title: 'Cảnh báo sự cố',
    message: incident.title
      ? `${incident.title}. Vui lòng theo dõi thông tin cập nhật trên BusDN.`
      : 'Tuyến xe của bạn đang có sự cố. Vui lòng theo dõi thông tin cập nhật trên BusDN.',
    target: {
      type: 'ROUTE_PASSENGERS',
      routeId: incident.routeId,
    },
    channels: { inApp: true, push: false },
    priority: incident.severity === 'CRITICAL' ? 'urgent' : 'high',
    source: {
      module: 'incident',
      entityId: incident._id,
    },
    data: {
      incidentId: normalizeId(incident._id),
      routeId: normalizeId(incident.routeId),
      routeName: getRouteName(incident.route),
      tripId: normalizeId(incident.tripId),
      severity: incident.severity || '',
      incidentType: incident.incidentType || '',
    },
    deduplicationKey: `incident:${incident._id}`,
    createdBy: actorId,
  }, { createdBy: actorId, io }));
};

export const notifyTicketPaymentSuccess = async ({
  ticket,
  paymentOrder = null,
  passenger = null,
  route = null,
}) => {
  if (!ticket?._id || !ticket?.passenger) return null;

  return runNotificationSideEffect('ticket_payment_success', () => notificationService.send({
    type: 'TICKET_PURCHASED',
    title: 'Mua vé thành công',
    message: `Vé ${ticket.ticketCode || ''} đã được mua thành công.`,
    target: {
      type: 'USER',
      userId: ticket.passenger,
    },
    channels: { inApp: true, push: false },
    priority: 'normal',
    actionUrl: `/tickets/${ticket._id}`,
    source: {
      module: 'ticket',
      entityId: ticket._id,
    },
    data: {
      ticketId: normalizeId(ticket._id),
      ticketCode: ticket.ticketCode || '',
      passengerName: getPassengerName(passenger || ticket.passenger),
      routeId: normalizeId(ticket.routeId),
      routeName: getRouteName(route, ticket.routeNumber || ticket.routeCode),
      routeNumber: ticket.routeNumber || '',
      routeCode: ticket.routeCode || '',
      tripId: normalizeId(ticket.tripId),
      boardingStop: ticket.departureLocation || '',
      destinationStop: ticket.destinationLocation || '',
      departureTime: ticket.departureTime || '',
      departureDateTime: ticket.validFrom || '',
      amount: ticket.ticketPrice,
      paymentStatus: ticket.paymentStatus,
      paymentMethod: ticket.paymentMethod || paymentOrder?.paymentMethod || '',
      orderCode: paymentOrder?.orderCode || '',
    },
    deduplicationKey: `ticket-purchased:${ticket._id}`,
    createdBy: ticket.passenger,
  }));
};

export const notifyMonthlyPassPaymentSuccess = async ({
  monthlyPass,
  paymentOrder = null,
  passenger = null,
  route = null,
}) => {
  if (!monthlyPass?._id || !monthlyPass?.passenger) return null;

  return runNotificationSideEffect('monthly_pass_payment_success', () => notificationService.send({
    type: 'PAYMENT_SUCCESS',
    title: 'Thanh toán thành công',
    message: `Vé tháng ${monthlyPass.passCode || ''} đã được kích hoạt thành công.`,
    target: {
      type: 'USER',
      userId: monthlyPass.passenger,
    },
    channels: { inApp: true, push: false },
    priority: 'normal',
    actionUrl: '/tickets/monthly-passes',
    source: {
      module: 'monthly-pass',
      entityId: monthlyPass._id,
    },
    data: {
      monthlyPassId: normalizeId(monthlyPass._id),
      passCode: monthlyPass.passCode || '',
      passengerName: getPassengerName(passenger || monthlyPass.passenger),
      routeId: normalizeId(monthlyPass.routeId),
      routeName: getRouteName(route, monthlyPass.routeCode),
      routeCode: monthlyPass.routeCode || '',
      amount: monthlyPass.passPrice,
      passPrice: monthlyPass.passPrice,
      paymentStatus: monthlyPass.paymentStatus,
      paymentMethod: monthlyPass.paymentMethod || paymentOrder?.paymentMethod || '',
      validFrom: monthlyPass.validFrom || monthlyPass.startDate,
      validUntil: monthlyPass.validUntil || monthlyPass.expiryDate,
      startDate: monthlyPass.startDate,
      expiryDate: monthlyPass.expiryDate,
      orderCode: paymentOrder?.orderCode || '',
    },
    deduplicationKey: `payment-success:monthly-pass:${monthlyPass._id}`,
    createdBy: monthlyPass.passenger,
  }));
};

export default {
  notifyFeedbackResponse,
  notifyTripDelay,
  notifyIncidentCreated,
  notifyTicketPaymentSuccess,
  notifyMonthlyPassPaymentSuccess,
};
