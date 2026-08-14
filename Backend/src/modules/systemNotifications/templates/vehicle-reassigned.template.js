import {
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderVehicleReassignedEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = recipient.fullName || 'Quý khách';
  const rows = [
    { label: 'Tuyến', value: data.routeName || data.routeCode || data.routeId },
    { label: 'Chuyến', value: data.tripCode || data.tripId },
    { label: 'Xe cũ', value: data.oldVehicleLabel || data.oldVehicleId },
    { label: 'Xe thay thế', value: data.replacementVehicleLabel || data.replacementVehicleId },
    { label: 'Lý do', value: data.reason },
  ];
  const subject = 'BusDN - Cập nhật phương tiện';
  const intro = `Xin chào ${passengerName}, BusDN có cập nhật phương tiện cho chuyến xe liên quan đến bạn.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: notification.title || 'Cập nhật phương tiện',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: notification.title || 'Cập nhật phương tiện',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderVehicleReassignedEmail;
