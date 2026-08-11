import {
  formatCurrencyVnd,
  formatDateTimeVi,
  renderNotificationEmailLayout,
  renderTextEmail,
} from './base.template.js';

export const renderTicketPurchasedEmail = ({ notification, recipient }) => {
  const data = notification.metadata || {};
  const passengerName = data.passengerName || recipient.fullName || 'Quý khách';
  const departureTime = data.departureDateTime || data.departureTime || data.validFrom || '';
  const amount = data.amount ?? data.ticketPrice;
  const rows = [
    { label: 'Hành khách', value: passengerName },
    { label: 'Mã vé', value: data.ticketCode },
    { label: 'Tuyến', value: data.routeName || data.routeNumber || data.routeCode },
    { label: 'Điểm lên xe', value: data.boardingStop || data.departureLocation },
    { label: 'Điểm đến', value: data.destinationStop || data.destinationLocation },
    { label: 'Giờ khởi hành', value: formatDateTimeVi(departureTime) || data.departureTime },
    { label: 'Số tiền', value: formatCurrencyVnd(amount) },
    { label: 'Trạng thái thanh toán', value: data.paymentStatus || 'PAID' },
    { label: 'Phương thức thanh toán', value: data.paymentMethod },
  ];
  const subject = 'BusDN - Xác nhận mua vé thành công';
  const intro = `Xin chào ${passengerName}, vé của bạn đã được mua thành công.`;

  return {
    subject,
    html: renderNotificationEmailLayout({
      title: 'Xác nhận mua vé thành công',
      intro,
      rows,
      actionUrl: notification.actionUrl,
    }),
    text: renderTextEmail({
      title: 'Xác nhận mua vé thành công',
      intro,
      rows,
      actionUrl: notification.actionUrl,
    }),
  };
};

export default renderTicketPurchasedEmail;
