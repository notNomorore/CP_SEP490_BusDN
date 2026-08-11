import {
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderGenericNotificationEmail = ({ notification, recipient }) => {
  const recipientName = recipient.fullName || 'Quý khách';
  const subject = `BusDN - ${notification.title}`;
  const intro = `Xin chào ${recipientName}, BusDN gửi bạn thông báo mới.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: notification.title,
      intro,
      body: notification.message,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: notification.title,
      intro,
      body: notification.message,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderGenericNotificationEmail;
