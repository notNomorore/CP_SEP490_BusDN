import renderFeedbackResponseEmail from './feedback-response.template.js';
import renderGenericNotificationEmail from './generic-notification.template.js';
import renderIncidentAlertEmail from './incident-alert.template.js';
import renderPaymentSuccessEmail from './payment-success.template.js';
import renderPromotionEmail from './promotion.template.js';
import renderTicketPurchasedEmail from './ticket-purchased.template.js';
import renderTripDelayedEmail from './trip-delayed.template.js';
import renderVehicleReassignedEmail from './vehicle-reassigned.template.js';

export const EMAIL_TEMPLATE_RENDERERS = Object.freeze({
  TICKET_PURCHASED: renderTicketPurchasedEmail,
  PAYMENT_SUCCESS: renderPaymentSuccessEmail,
  FEEDBACK_RESPONSE: renderFeedbackResponseEmail,
  INCIDENT_ALERT: renderIncidentAlertEmail,
  TRIP_DELAYED: renderTripDelayedEmail,
  VEHICLE_REASSIGNED: renderVehicleReassignedEmail,
  PROMOTION: renderPromotionEmail,
});

export const renderNotificationEmail = ({ notification, recipient }) => {
  const notificationType = String(notification.notificationType || notification.type || '').trim().toUpperCase();
  const renderer = EMAIL_TEMPLATE_RENDERERS[notificationType] || renderGenericNotificationEmail;

  return renderer({ notification, recipient });
};

export default renderNotificationEmail;
