import {
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderFeedbackResponseEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = data.passengerName || recipient.fullName || 'Quý khách';
  const rows = [
    { label: 'Mã phản ánh', value: data.referenceNumber || data.caseId },
    { label: 'Loại phản ánh', value: data.feedbackType || data.supportCaseType },
    { label: 'Trạng thái', value: data.statusLabel || data.status },
  ];
  const subject = 'BusDN - Phản hồi mới cho phản ánh của bạn';
  const intro = `Xin chào ${passengerName}, BusDN đã cập nhật phản hồi cho phản ánh của bạn.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: 'Phản hồi mới',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: 'Phản hồi mới',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderFeedbackResponseEmail;
