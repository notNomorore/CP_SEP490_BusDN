const phrasePairs = [
  ['Bus Assistant Operations', 'Vận hành phụ xe'],
  ['Refresh', 'Làm mới'],
  ['Previous day', 'Ngày trước'],
  ['Next day', 'Ngày sau'],
  ['Prev', 'Trước'],
  ['Next', 'Tiếp'],
  ['Today', 'Hôm nay'],
  ['Assigned trips', 'Chuyến được phân công'],
  ['Shift schedule', 'Lịch ca làm việc'],
  ['Operation notifications', 'Thông báo vận hành'],
  ['Incident reports', 'Báo cáo sự cố'],
  ['Could not load data. Please try again.', 'Không thể tải dữ liệu. Vui lòng thử lại.'],
  ['Not available', 'Chưa có'],
  ['No update time available', 'Chưa có thời gian cập nhật'],
  ['Pending acceptance', 'Chờ tiếp nhận'],
  ['Assigned', 'Đã phân công'],
  ['Accepted', 'Đã tiếp nhận'],
  ['Rejected', 'Đã từ chối'],
  ['Vehicle ready', 'Xe sẵn sàng'],
  ['Scheduled', 'Đã lên lịch'],
  ['In progress', 'Đang vận hành'],
  ['Completed', 'Hoàn thành'],
  ['Cancelled', 'Đã hủy'],
  ['Pending', 'Chưa xử lý'],
  ['Processing', 'Đang xử lý'],
  ['Resolved', 'Đã xử lý'],
  ['Closed', 'Đã đóng'],
  ['Route update', 'Cập nhật tuyến'],
  ['Schedule change', 'Đổi lịch vận hành'],
  ['Emergency instruction', 'Chỉ đạo khẩn'],
  ['Notification', 'Thông báo'],
  ['Start point', 'Điểm đầu'],
  ['End point', 'Điểm cuối'],
  ['Route name unavailable', 'Chưa có tên tuyến'],
  ['Operation date', 'Ngày vận hành'],
  ['Time', 'Thời gian'],
  ['Vehicle', 'Phương tiện'],
  ['Role', 'Vai trò'],
  ['Bus assistant', 'Phụ xe'],
  ['Driver:', 'Tài xế:'],
  ['Notes:', 'Ghi chú:'],
  ['Not assigned', 'Chưa phân công'],
  ['No notes.', 'Không có ghi chú.'],
  ['The bus assistant accepted this trip. Please wait for the driver to begin operation.', 'Phụ xe đã tiếp nhận chuyến. Vui lòng chờ tài xế bắt đầu vận hành.'],
  ['The bus assistant rejected this trip. The reason was sent to the administrator for reassignment.', 'Phụ xe đã từ chối chuyến. Lý do đã được gửi về admin để xử lý phân công.'],
  ['Reject trip', 'Từ chối chuyến'],
  ['Accept trip', 'Tiếp nhận chuyến'],
  ['This trip is open to the bus assistant.', 'Chuyến đang mở cho phụ xe.'],
  ['Open the report screen to submit UC50, UC51, or UC52 for this trip.', 'Vào màn báo cáo để gửi UC50, UC51 hoặc UC52 cho đúng chuyến này.'],
  ['Open trip / Report', 'Vào chuyến / Báo cáo'],
  ['Report response', 'Phản hồi báo cáo'],
  ['No details available.', 'Chưa có nội dung chi tiết.'],
  ['Enter a reason for rejecting the assigned trip:', 'Nhập lý do từ chối chuyến được phân công:'],
  ['The trip rejection was sent to operations.', 'Đã gửi từ chối chuyến về điều hành.'],
  ['View trips assigned by operations and accept or reject them when necessary.', 'Xem các chuyến mà điều hành đã phân cho phụ xe và tiếp nhận hoặc từ chối nếu có lý do.'],
  ['The assigned trip was accepted.', 'Đã tiếp nhận chuyến được phân công.'],
  ['No trips were assigned during this period.', 'Không có chuyến nào được phân công trong khoảng thời gian này.'],
  ['Bus assistant activity', 'Hoạt động trợ lý xe buýt'],
  ['System Status: Active', 'Trạng thái hệ thống: Hoạt động'],
  ['Track your assigned shifts by week. Your shift details appear here.', 'Theo dõi các ca được phân công theo tuần. Chi tiết các ca của bạn hiển thị tại đây.'],
  ['Add new', 'Thêm mới'],
  ['Previous week', 'Tuần trước'],
  ['Next week', 'Tuần sau'],
  ['Select a day in the week to view', 'Chọn một ngày trong tuần cần xem'],
  ['This week', 'Tuần này'],
  ['Work shift', 'Ca làm việc'],
  ['Shift code unavailable', 'Chưa có mã ca'],
  ['This shift was assigned automatically from the operation schedule.', 'Ca được hệ thống phân công theo lịch vận hành.'],
  ['No shifts', 'Không có ca'],
  ['This week’s performance', 'Hiệu suất hoạt động tuần này'],
  ['Total hours', 'Tổng giờ'],
  ['Number of shifts', 'Số ca'],
  ['The schedule only shows shifts assigned to the signed-in account. Please arrive before the shift starts.', 'Lịch chỉ hiển thị những ca thuộc về tài khoản đang đăng nhập. Vui lòng có mặt trước giờ bắt đầu ca để chuẩn bị vận hành.'],
  ['Track operation responses, trip changes, and updates to submitted reports.', 'Theo dõi phản hồi từ điều hành, thay đổi chuyến và cập nhật xử lý báo cáo đã gửi.'],
  ['No operation notifications during this period.', 'Chưa có thông báo vận hành trong khoảng thời gian này.'],
  ['Passenger incident report', 'Báo cáo sự cố hành khách'],
  ['Submit passenger violations, conflicts, or found items to the operations center.', 'Phụ xe gửi báo cáo vi phạm, xung đột hành khách hoặc đồ tìm thấy về trung tâm điều hành.'],
  ['From date', 'Từ ngày'],
  ['To date', 'Đến ngày'],
  ['Trip', 'Chuyến'],
  ['No trips', 'Không có chuyến'],
  ['No bus-assistant trips during the selected dates.', 'Không có chuyến phụ xe trong khoảng ngày đã chọn.'],
  ['Please select a trip to report.', 'Vui lòng chọn chuyến cần báo cáo.'],
  ['A completed trip only allows found-item reports.', 'Chuyến đã hoàn thành chỉ cho phép báo đồ tìm thấy.'],
  ['Reports can only be submitted while the trip is in progress.', 'Chỉ có thể báo cáo khi chuyến đang vận hành.'],
  ['Please describe the situation using at least 10 characters.', 'Vui lòng mô tả tình huống tối thiểu 10 ký tự.'],
  ['Please enter the action taken for the passenger violation.', 'Vui lòng nhập hành động đã xử lý với hành khách vi phạm.'],
  ['Please enter the action taken for the conflict.', 'Vui lòng nhập hành động đã xử lý xung đột.'],
  ['Please enter the name of the found item.', 'Vui lòng nhập tên đồ vật tìm thấy.'],
  ['Please enter where the item was found.', 'Vui lòng nhập vị trí tìm thấy đồ vật.'],
  ['The report was sent to operations. You may submit another report for a new situation.', 'Đã gửi báo cáo cho điều hành. Bạn vẫn có thể gửi thêm báo cáo nếu phát sinh tình huống mới.'],
  ['The operation could not be completed. Please try again.', 'Không thể thực hiện thao tác. Vui lòng thử lại.'],
  ['Select report type', 'Chọn loại báo cáo'],
  ['Report passenger violation', 'Báo hành khách vi phạm'],
  ['Record a passenger’s bus-rule violation for operations to process.', 'Ghi nhận hành khách vi phạm nội quy xe buýt để điều hành xử lý.'],
  ['Report passenger conflict', 'Báo xung đột hành khách'],
  ['Record disputes, arguments, or disturbances on the bus.', 'Ghi nhận tranh chấp, cãi vã hoặc tình huống gây mất trật tự trên xe.'],
  ['Report found item', 'Báo đồ tìm thấy'],
  ['Record lost property found on the bus, including after the trip ends.', 'Ghi nhận đồ vật thất lạc tìm thấy trên xe, kể cả sau khi chuyến đã kết thúc.'],
  ['Severity', 'Mức độ'],
  ['Low', 'Thấp'],
  ['Medium', 'Trung bình'],
  ['High', 'Cao'],
  ['Critical', 'Khẩn cấp'],
  ['Violation type', 'Loại vi phạm'],
  ['Passenger description', 'Mô tả hành khách'],
  ['Action taken', 'Hành động đã xử lý'],
  ['Conflict category', 'Nhóm xung đột'],
  ['Parties involved', 'Các bên liên quan'],
  ['Item name', 'Tên đồ vật'],
  ['Found location', 'Vị trí tìm thấy'],
  ['Handed over to', 'Bàn giao cho'],
  ['Detailed description', 'Mô tả chi tiết'],
  ['Evidence photos', 'Ảnh minh chứng'],
  ['You can take or select up to 5 photos so the administrator can review the situation.', 'Có thể chụp hoặc chọn tối đa 5 ảnh để admin xem tình hình rõ hơn.'],
  ['Each situation can be submitted as a separate report.', 'Mỗi tình huống phát sinh có thể gửi một báo cáo riêng.'],
  ['Submit report', 'Gửi báo cáo'],
  ['Only UC50/UC51 can be reported while a trip is in progress. UC52 can be reported after completion.', 'Chỉ có thể báo UC50/UC51 khi chuyến đang vận hành. UC52 có thể báo sau khi chuyến hoàn thành.'],
  ['Example: blue shirt, standing near the rear door', 'Ví dụ: áo xanh, đứng gần cửa sau'],
  ['Example: reminded about rules, requested ticket scan', 'Ví dụ: nhắc nội quy, yêu cầu quét vé'],
  ['Example: 2 passengers in the middle-row seats', 'Ví dụ: 2 hành khách ở hàng ghế giữa'],
  ['Example: separated passengers, notified driver', 'Ví dụ: tách hành khách, báo tài xế'],
  ['Example: black leather wallet', 'Ví dụ: ví da màu đen'],
  ['Example: seat 12', 'Ví dụ: ghế số 12'],
  ['Example: terminal operations desk', 'Ví dụ: quầy điều hành bến'],
  ['No ticket / ticket not scanned', 'Không có vé / không quét vé'],
  ['Wrong ticket type', 'Dùng sai loại vé'],
  ['Smoking on the bus', 'Hút thuốc trên xe'],
  ['Littering on the bus', 'Xả rác trên xe'],
  ['Unsafe behavior', 'Hành vi mất an toàn'],
  ['Noise / disturbing passengers', 'Gây ồn / làm phiền hành khách'],
  ['Other', 'Khác'],
  ['Argument / disturbance', 'Cãi vã / gây rối'],
  ['Fare / payment dispute', 'Tranh chấp vé / thanh toán'],
  ['Seat dispute', 'Tranh chấp chỗ ngồi'],
  ['Harassment / threat', 'Quấy rối / đe dọa'],
  ['Safety risk', 'Nguy cơ mất an toàn'],
];

const translations = new Map();
phrasePairs.forEach(([en, vi]) => {
  translations.set(en, { en, vi });
  translations.set(vi, { en, vi });
});

const preserveWhitespace = (original, translated) => {
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
};

const translateDynamicText = (value, language) => {
  const replacements = language === 'vi'
    ? [
      [/(\d+) successful validation\(s\) on this date\./gi, '$1 lượt kiểm tra thành công trong ngày này.'],
      [/No successful validations saved for this date\./gi, 'Chưa lưu lượt kiểm tra thành công nào trong ngày này.'],
      [/(\d+) assigned shifts?/gi, '$1 ca được phân công'],
    ]
    : [
      [/(\d+) lượt kiểm tra thành công trong ngày này\./gi, '$1 successful validation(s) on this date.'],
      [/Chưa lưu lượt kiểm tra thành công nào trong ngày này\./gi, 'No successful validations saved for this date.'],
      [/(\d+) ca được phân công/gi, '$1 assigned shifts'],
    ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
};

export const translateBusAssistantPhrase = (value, language = 'en') => {
  if (value === null || value === undefined) return value;
  const original = String(value);
  const normalized = original.replace(/\s+/g, ' ').trim();
  if (!normalized || ['VN', 'EN'].includes(normalized)) return original;

  const translated = translations.get(normalized)?.[language];
  return translated
    ? preserveWhitespace(original, translated)
    : translateDynamicText(original, language);
};

export default translateBusAssistantPhrase;
