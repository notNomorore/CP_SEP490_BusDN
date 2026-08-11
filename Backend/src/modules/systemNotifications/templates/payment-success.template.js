import {
  formatCurrencyVnd,
  formatDateTimeVi,
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderPaymentSuccessEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = data.passengerName || recipient.fullName || 'Quý khách';
  const rows = [
    { label: 'Hành khách', value: passengerName },
    { label: 'Mã giao dịch', value: data.orderCode },
    { label: 'Mã vé', value: data.ticketCode || data.passCode },
    { label: 'Tuyến', value: data.routeName || data.routeCode || data.routeId },
    { label: 'Số tiền', value: formatCurrencyVnd(data.amount ?? data.passPrice ?? data.ticketPrice) },
    { label: 'Trạng thái thanh toán', value: data.paymentStatus || 'PAID' },
    { label: 'Phương thức thanh toán', value: data.paymentMethod },
    { label: 'Hiệu lực từ', value: formatDateTimeVi(data.validFrom || data.startDate) },
    { label: 'Hiệu lực đến', value: formatDateTimeVi(data.validUntil || data.expiryDate) },
  ];
  const subject = 'BusDN - Thanh toán thành công';
  const intro = `Xin chào ${passengerName}, BusDN đã ghi nhận thanh toán thành công.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: 'Thanh toán thành công',
      intro,
      rows,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: 'Thanh toán thành công',
      intro,
      rows,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderPaymentSuccessEmail;
