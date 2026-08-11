import {
  formatDateTimeVi,
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderPromotionEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = recipient.fullName || 'Quý khách';
  const rows = [
    { label: 'Mã khuyến mãi', value: data.promotionCode || notification.promotionCode },
    { label: 'Loại ưu đãi', value: data.discountType },
    { label: 'Giá trị', value: data.discountValue },
    { label: 'Hiệu lực đến', value: formatDateTimeVi(data.endDate || notification.expiresAt) },
  ];
  const subject = 'BusDN - Khuyến mãi mới';
  const intro = `Xin chào ${passengerName}, BusDN gửi bạn thông tin khuyến mãi mới.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: notification.title || 'Khuyến mãi mới',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
      footer: 'Cảm ơn bạn đã đồng hành cùng BusDN.',
    }),
    text: renderTextEmail({
      title: notification.title || 'Khuyến mãi mới',
      intro,
      body: notification.message,
      rows,
      actionUrl: notification.actionUrl,
      footer: 'Cảm ơn bạn đã đồng hành cùng BusDN.',
    }),
  };
};

export default renderPromotionEmail;
