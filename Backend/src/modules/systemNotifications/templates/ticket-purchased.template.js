import {
  escapeHtml,
  formatCurrencyVnd,
  formatDateTimeVi,
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
    { label: 'Vé có hiệu lực đến', value: formatDateTimeVi(data.validUntil) },
    { label: 'Số tiền', value: formatCurrencyVnd(amount) },
    { label: 'Phương thức thanh toán', value: data.paymentMethod },
  ];
  const subject = 'BusDN - Xác nhận mua vé thành công';
  const intro = `Xin chào ${passengerName}, vé của bạn đã được mua thành công.`;
  const qrImage = String(data.qrCodeImage || '');
  const qrBase64 = qrImage.match(/^data:image\/png;base64,(.+)$/i)?.[1] || '';
  const safe = (value) => escapeHtml(value || '—');
  const routeName = data.routeName || data.routeNumber || data.routeCode;
  const departure = formatDateTimeVi(departureTime) || data.departureTime;
  const validUntil = formatDateTimeVi(data.validUntil);
  const qrMarkup = qrBase64
    ? '<div class="qr-card"><p class="eyebrow">MÃ QR LÊN XE</p><img src="cid:busdn-ticket-qr" alt="Mã QR vé xe BusDN" width="220" height="220" /><p>Đưa mã này cho phụ xe quét khi lên xe</p></div>'
    : '<div class="qr-card"><p>Mở vé trong ứng dụng BusDN để xem mã QR.</p></div>';

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
body{margin:0;background:#edf7f2;color:#153229;font-family:Arial,Helvetica,sans-serif}.wrap{padding:28px 12px}.card{max-width:680px;margin:auto;background:#fff;border:1px solid #cae7da;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(9,70,48,.12)}.hero{padding:30px;background:linear-gradient(135deg,#073d2a,#0d6b4a);color:#fff}.brand{font-size:20px;font-weight:900;letter-spacing:-.5px}.success{display:inline-block;margin-top:20px;padding:7px 12px;border-radius:999px;background:#baf3d2;color:#07422c;font-size:12px;font-weight:800}.hero h1{margin:14px 0 6px;font-size:26px}.hero p{margin:0;color:#d9f5e8;line-height:1.6}.content{padding:26px}.route{padding:20px;border-radius:18px;background:#effaf5;border:1px solid #d7eee3}.eyebrow{margin:0 0 8px!important;font-size:11px!important;font-weight:900!important;letter-spacing:1.4px;color:#41806a!important}.route h2{margin:0;color:#073d2a;font-size:21px;line-height:1.4}.journey{width:100%;margin-top:18px;border-collapse:collapse;table-layout:fixed}.journey td{vertical-align:middle}.stop{width:44%;font-size:14px;font-weight:800;line-height:1.5}.stop.end{text-align:right}.arrow{width:12%;text-align:center;color:#0d8a5f;font-size:22px;font-weight:900}.details{width:100%;margin:22px 0;border-collapse:separate;border-spacing:0 8px}.details td{padding:11px 14px;background:#f7faf9;font-size:14px}.details td:first-child{width:40%;border-radius:10px 0 0 10px;color:#658078;font-weight:700}.details td:last-child{border-radius:0 10px 10px 0;color:#142f27;font-weight:800}.qr-card{text-align:center;margin:22px auto;padding:22px;border:2px dashed #86cbae;border-radius:20px;background:#fbfffd}.qr-card img{display:block;margin:0 auto;padding:8px;background:#fff;border-radius:14px}.qr-card p{margin:12px 0 0;color:#58736a;font-size:13px}.notice{margin-top:22px;padding:20px;border-radius:18px;background:#fff8e8;border:1px solid #f0d998}.notice h3{margin:0 0 12px;color:#6c4d00;font-size:16px}.notice ul{margin:0;padding-left:20px;color:#6a5831}.notice li{margin:8px 0;line-height:1.5;font-size:14px}.action{text-align:center;margin:24px 0 4px}.action a{display:inline-block;padding:13px 22px;border-radius:12px;background:#073d2a;color:#fff;text-decoration:none;font-weight:800}.footer{padding:20px 26px;background:#f6faf8;color:#71847d;text-align:center;font-size:12px;line-height:1.6}@media(max-width:520px){.wrap{padding:10px 6px}.hero,.content{padding:20px}.stop{font-size:12px}.arrow{font-size:18px}.details td{display:block;width:auto!important;border-radius:8px!important}.details td:first-child{padding-bottom:3px}.details td:last-child{padding-top:3px}.qr-card img{width:190px;height:190px}}
</style></head><body><div class="wrap"><div class="card">
<div class="hero"><div class="brand">BusDN</div><span class="success">THANH TOÁN THÀNH CÔNG</span><h1>Vé xe buýt của bạn đã sẵn sàng</h1><p>Xin chào ${safe(passengerName)}, cảm ơn bạn đã lựa chọn BusDN.</p></div>
<div class="content"><div class="route"><p class="eyebrow">HÀNH TRÌNH</p><h2>${safe(routeName)}</h2><table class="journey" role="presentation"><tr><td class="stop">${safe(data.boardingStop || data.departureLocation)}</td><td class="arrow">→</td><td class="stop end">${safe(data.destinationStop || data.destinationLocation)}</td></tr></table></div>
<table class="details" role="presentation"><tr><td>Mã vé</td><td>${safe(data.ticketCode)}</td></tr><tr><td>Giờ khởi hành</td><td>${safe(departure)}</td></tr><tr><td>Vé có hiệu lực đến</td><td>${safe(validUntil)}</td></tr><tr><td>Số tiền</td><td>${safe(formatCurrencyVnd(amount))}</td></tr><tr><td>Phương thức thanh toán</td><td>${safe(data.paymentMethod)}</td></tr></table>
${qrMarkup}
<div class="notice"><h3>Lưu ý quan trọng</h3><ul><li>Vui lòng có mặt tại điểm dừng ít nhất 5 phút trước giờ khởi hành.</li><li>Giữ mã QR rõ ràng và xuất trình khi lên xe.</li><li>Vé chỉ dành cho cá nhân và không được chuyển nhượng.</li><li>Không thể hủy vé đã sử dụng hoặc hết hạn.</li></ul></div>
${notification.actionUrl ? `<p class="action"><a href="${safe(notification.actionUrl)}">Xem vé trong BusDN</a></p>` : ''}</div>
<div class="footer">Đây là email tự động từ BusDN. Vui lòng không trả lời email này.<br/>Chúc bạn có một hành trình an toàn và thuận tiện.</div>
</div></div></body></html>`;

  return {
    subject,
    html,
    text: renderTextEmail({
      title: 'Xác nhận mua vé thành công',
      intro,
      rows: [...rows, { label: 'Lưu ý quan trọng', value: 'Có mặt trước 5 phút; giữ QR rõ ràng; vé không được chuyển nhượng; không thể hủy vé đã sử dụng hoặc hết hạn.' }],
      actionUrl: notification.actionUrl,
    }),
    attachments: qrBase64 ? [{
      filename: `BusDN-${data.ticketCode || 'ticket'}-QR.png`,
      content: Buffer.from(qrBase64, 'base64'),
      contentType: 'image/png',
      cid: 'busdn-ticket-qr',
    }] : [],
  };
};

export default renderTicketPurchasedEmail;
