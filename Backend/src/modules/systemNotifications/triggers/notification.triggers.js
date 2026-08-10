import logger from '../../../utils/logger.js';
import notificationService from '../notification.service.js';

const normalizeId = (value) => (value ? String(value) : '');

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
    channels: {
      inApp: true,
      email: false,
      push: false,
    },
    priority: trip.delayMinutes >= 15 ? 'high' : 'normal',
    source: {
      module: 'trip',
      entityId: trip._id,
    },
    data: {
      tripId: normalizeId(trip._id),
      routeId: normalizeId(trip.routeId),
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
    channels: {
      inApp: true,
      email: false,
      push: false,
    },
    priority: incident.severity === 'CRITICAL' ? 'urgent' : 'high',
    source: {
      module: 'incident',
      entityId: incident._id,
    },
    data: {
      incidentId: normalizeId(incident._id),
      routeId: normalizeId(incident.routeId),
      tripId: normalizeId(incident.tripId),
      severity: incident.severity || '',
      incidentType: incident.incidentType || '',
    },
    deduplicationKey: `incident:${incident._id}`,
    createdBy: actorId,
  }, { createdBy: actorId, io }));
};

export const notifyTicketPaymentSuccess = async ({ ticket, paymentOrder = null }) => {
  if (!ticket?._id || !ticket?.passenger) return null;

  return runNotificationSideEffect('ticket_payment_success', () => notificationService.send({
    type: 'PAYMENT_SUCCESS',
    title: 'Thanh toán thành công',
    message: `Vé ${ticket.ticketCode || ''} đã được thanh toán thành công.`,
    target: {
      type: 'USER',
      userId: ticket.passenger,
    },
    channels: {
      inApp: true,
      email: false,
      push: false,
    },
    priority: 'normal',
    actionUrl: `/tickets/${ticket._id}`,
    source: {
      module: 'ticket',
      entityId: ticket._id,
    },
    data: {
      ticketId: normalizeId(ticket._id),
      ticketCode: ticket.ticketCode || '',
      routeId: normalizeId(ticket.routeId),
      tripId: normalizeId(ticket.tripId),
      orderCode: paymentOrder?.orderCode || '',
    },
    deduplicationKey: `payment-success:ticket:${ticket._id}`,
    createdBy: ticket.passenger,
  }));
};

export const notifyMonthlyPassPaymentSuccess = async ({ monthlyPass, paymentOrder = null }) => {
  if (!monthlyPass?._id || !monthlyPass?.passenger) return null;

  return runNotificationSideEffect('monthly_pass_payment_success', () => notificationService.send({
    type: 'PAYMENT_SUCCESS',
    title: 'Thanh toán thành công',
    message: `Vé tháng ${monthlyPass.passCode || ''} đã được kích hoạt thành công.`,
    target: {
      type: 'USER',
      userId: monthlyPass.passenger,
    },
    channels: {
      inApp: true,
      email: false,
      push: false,
    },
    priority: 'normal',
    actionUrl: '/tickets/monthly-passes',
    source: {
      module: 'monthly-pass',
      entityId: monthlyPass._id,
    },
    data: {
      monthlyPassId: normalizeId(monthlyPass._id),
      passCode: monthlyPass.passCode || '',
      routeId: normalizeId(monthlyPass.routeId),
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

