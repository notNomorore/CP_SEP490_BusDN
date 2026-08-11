import {
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderIncidentAlertEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = recipient.fullName || 'Quý khách';
  const rows = [
    { label: 'Tuyến', value: data.routeName || data.routeCode || data.routeId },
    { label: 'Chuyến', value: data.tripId },
    { label: 'Mức độ', value: data.severity },
    { label: 'Loại sự cố', value: data.incidentType },
  ];
  const subject = 'BusDN - Cảnh báo sự cố tuyến xe';
  const intro = `Xin chào ${passengerName}, tuyến xe liên quan đến bạn đang có thông báo sự cố.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: notification.title || 'Cảnh báo sự cố',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: notification.title || 'Cảnh báo sự cố',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderIncidentAlertEmail;
