import {
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderTripDelayedEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = recipient.fullName || 'Quý khách';
  const rows = [
    { label: 'Tuyến', value: data.routeName || data.routeCode || data.routeId },
    { label: 'Chuyến', value: data.tripCode || data.tripId },
    { label: 'Thời gian trễ dự kiến', value: data.delayMinutes ? `${data.delayMinutes} phút` : '' },
    { label: 'Trạng thái', value: data.status },
  ];
  const subject = 'BusDN - Chuyến xe bị trễ';
  const intro = `Xin chào ${passengerName}, chuyến xe liên quan đến bạn đang bị trễ.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: notification.title || 'Chuyến xe bị trễ',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: notification.title || 'Chuyến xe bị trễ',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderTripDelayedEmail;
