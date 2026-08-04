const phrasePairs = [
  ['Driver Operations', 'Vận hành tài xế'],
  ['Driver BusDN', 'Driver BusDN'],
  ['BusDN driver operations', 'Vận hành xe buýt Đà Nẵng'],
  ['Da Nang bus operation', 'Vận hành xe buýt Đà Nẵng'],
  ['Signed in', 'Đã đăng nhập'],
  ['Driver', 'Tài xế'],
  ['Bus assistant', 'Phụ xe'],
  ['Assigned trips', 'Chuyến được phân công'],
  ['Shift schedule', 'Lịch ca làm việc'],
  ['Operation notifications', 'Thông báo vận hành'],
  ['Operation chat', 'Nhóm trò chuyện'],
  ['Operations chat group', 'Nhóm trò chuyện vận hành'],
  ['Track assigned trips, vehicle inspection, shift schedule, and operation chat.', 'Theo dõi chuyến được phân công, kiểm tra xe, lịch ca làm việc và trao đổi vận hành.'],
  ['Accept trips, inspect vehicles, and operate assigned schedules.', 'Tiếp nhận chuyến, kiểm tra xe và vận hành theo phân công.'],
  ['Track your assigned shifts by week.', 'Theo dõi ca làm việc của bạn theo tuần.'],
  ['Chat quickly with dispatch, drivers, and bus assistants in the operation group.', 'Trao đổi nhanh với điều hành, tài xế và phụ xe trong nhóm vận hành.'],
  ['Track dispatch responses and updates to submitted reports.', 'Theo dõi phản hồi từ điều hành và cập nhật xử lý báo cáo đã gửi.'],
  ['From date', 'Từ ngày'],
  ['To date', 'Đến ngày'],
  ['Refresh schedule', 'Làm mới lịch'],
  ['Refresh calendar', 'Làm mới lịch'],
  ['Loading operation schedule...', 'Đang tải lịch vận hành...'],
  ['No assigned trips during this period.', 'Không có chuyến xe nào được phân công trong khoảng thời gian này.'],
  ['Weekly work schedule', 'Lịch làm việc theo tuần'],
  ['Only shifts assigned by admins are shown here.', 'Chỉ hiển thị các ca admin đã phân công cho bạn.'],
  ['Previous week', 'Tuần trước'],
  ['This week', 'Tuần này'],
  ['Next week', 'Tuần sau'],
  ['No shifts', 'Không có ca'],
  ['Profile', 'Hồ sơ'],
  ['Full name', 'Họ tên'],
  ['Email', 'Email'],
  ['Role', 'Vai trò'],
  ['Avatar URL', 'Avatar URL'],
  ['Cancel', 'Hủy'],
  ['Close', 'Đóng'],
  ['Edit profile', 'Sửa hồ sơ'],
  ['Logout', 'Đăng xuất'],
  ['Saving...', 'Đang lưu...'],
  ['Save profile', 'Lưu hồ sơ'],
  ['Profile updated successfully.', 'Đã cập nhật hồ sơ.'],
  ['Could not update profile.', 'Không thể cập nhật hồ sơ.'],
  ['Assigned', 'Đã phân công'],
  ['Pending acceptance', 'Chờ tiếp nhận'],
  ['Accepted', 'Đã tiếp nhận'],
  ['Rejected', 'Đã từ chối'],
  ['Confirmed', 'Đã xác nhận'],
  ['Completed', 'Hoàn thành'],
  ['Cancelled', 'Đã hủy'],
  ['Scheduled', 'Đã lên lịch'],
  ['Vehicle ready', 'Xe sẵn sàng'],
  ['In progress', 'Đang vận hành'],
  ['Not started', 'Chưa kiểm tra'],
  ['Issue reported', 'Đã báo lỗi xe'],
  ['Vehicle operation', 'Vận hành phương tiện'],
  ['Trip operation', 'Vận hành chuyến'],
  ['Trip operation map', 'Bản đồ vận hành chuyến'],
  ['Start the trip after the driver confirms the vehicle is ready.', 'Bắt đầu chuyến sau khi tài xế đã xác nhận phương tiện sẵn sàng.'],
  ['Start trip', 'Bắt đầu chuyến'],
  ['Complete trip', 'Hoàn thành chuyến'],
  ['GPS is synced automatically when pressing Start trip.', 'GPS được đồng bộ tự động khi bấm Bắt đầu chuyến.'],
  ['Report incident', 'Báo cáo sự cố'],
  ['Traffic congestion report', 'Báo kẹt xe'],
  ['Accident report', 'Báo tai nạn'],
  ['Vehicle breakdown report', 'Báo xe hỏng'],
  ['Report congestion, route delays, or blocked roads.', 'Báo ùn tắc, chậm tuyến hoặc đường bị chặn.'],
  ['Report accidents, collisions, or urgent support situations.', 'Báo tai nạn, va chạm hoặc tình huống cần hỗ trợ khẩn.'],
  ['Report an in-trip vehicle breakdown that needs technical support or a replacement vehicle.', 'Báo xe hỏng trong chuyến, cần hỗ trợ kỹ thuật hoặc xe thay thế.'],
  ['Report vehicle issue', 'Báo lỗi xe'],
  ['Start vehicle inspection', 'Bắt đầu kiểm tra xe'],
  ['Start inspection', 'Bắt đầu kiểm tra'],
  ['Confirm vehicle ready', 'Xác nhận xe sẵn sàng'],
  ['Reload GPS', 'Tải lại GPS'],
  ['Trip map', 'Bản đồ chuyến đi'],
  ['Main stops on route', 'Trạm chính trên tuyến'],
  ['Route stops', 'Trạm cần đi'],
  ['Driver location', 'Vị trí tài xế'],
  ['Current location', 'Vị trí hiện tại'],
  ['Latitude', 'Vĩ độ'],
  ['Longitude', 'Kinh độ'],
  ['Accuracy', 'Độ chính xác'],
  ['Operation date', 'Ngày vận hành'],
  ['Trip time', 'Thời gian chuyến'],
  ['Vehicle', 'Phương tiện'],
  ['Your role', 'Vai trò của bạn'],
  ['Notes', 'Ghi chú'],
  ['Vehicle assistant', 'Phụ xe'],
  ['Assigned trip workflow', 'Luồng chuyến được phân công'],
  ['Operate, report, and complete one trip', 'Vận hành và báo cáo trong cùng một chuyến'],
  ['Start the trip, sync GPS, complete the trip, and submit incidents inside this assignment card.', 'Bắt đầu chuyến, theo dõi GPS, hoàn thành chuyến và gửi báo cáo sự cố ngay trong card phân công này.'],
  ['Trip is closed and cannot be restarted.', 'Chuyến đã đóng nên không thể bắt đầu lại.'],
  ['GPS: Synced when the trip started', 'GPS: Đã đồng bộ khi bắt đầu chuyến'],
  ['No operation notifications during this period.', 'Chưa có thông báo vận hành trong khoảng thời gian này.'],
];

const aliases = new Map([
  ['Trip assigned', 'Assigned trips'],
  ['Work shift schedule', 'Shift schedule'],
  ['Operation notice', 'Operation notifications'],
  ['COME DAY', 'To date'],
  ['Means', 'Vehicle'],
  ['Vehicle accessories', 'Bus assistant'],
  ['MAIN STATIONS ON THE ROUTE', 'Main stops on route'],
  ['Route map', 'Trip map'],
]);

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
      [/(\d+) assigned trips?/gi, '$1 chuyến được phân công'],
      [/(\d+) assigned shifts?/gi, '$1 ca được phân công'],
      [/Page\s+(\d+)\s+of\s+(\d+)/gi, 'Trang $1 / $2'],
    ]
    : [
      [/(\d+) chuyến được phân công/gi, '$1 assigned trips'],
      [/(\d+) ca được phân công/gi, '$1 assigned shifts'],
      [/Trang\s+(\d+)\s*\/\s*(\d+)/gi, 'Page $1 of $2'],
    ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
};

export const translateScheduleOperationsPhrase = (value, language = 'en', fallback) => {
  if (value === null || value === undefined) return value;
  const original = String(value);
  const normalized = original.replace(/\s+/g, ' ').trim();
  if (!normalized || ['VN', 'EN'].includes(normalized)) return original;

  const lookup = aliases.get(normalized) || normalized;
  const translated = translations.get(lookup)?.[language];
  if (translated) return preserveWhitespace(original, translated);

  const dynamic = translateDynamicText(original, language);
  if (dynamic !== original) return dynamic;

  return fallback !== undefined ? fallback : original;
};

export default translateScheduleOperationsPhrase;
