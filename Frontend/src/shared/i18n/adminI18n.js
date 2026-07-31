import useLanguage from '../hooks/useLanguage.js';
import { adminMessages } from './adminMessages.js';
import { adminPhraseTranslations } from './adminPhraseTranslations.generated.js';

const phraseOverrides = {
  'The Guided Path': { en: 'The Guided Path', vi: 'Hành trình được dẫn lối' },
  'Seamless Travel': { en: 'Seamless Travel', vi: 'Di chuyển liền mạch' },
  'Evolved.': { en: 'Evolved.', vi: 'Nâng tầm.' },
  'Modern coach bus': { en: 'Modern coach bus', vi: 'Xe khách hiện đại' },
  'Route Planner': { en: 'Route Planner', vi: 'Lập kế hoạch tuyến xe' },
  'Search routes': { en: 'Search routes', vi: 'Tìm tuyến xe' },
  'Back to home': { en: 'Back to home', vi: 'Về trang chủ' },
  'Manage Booking': { en: 'Manage Booking', vi: 'Quản lý đặt vé' },
  'Become a Partner': { en: 'Become a Partner', vi: 'Trở thành đối tác' },
  'Current location': { en: 'Current location', vi: 'Vị trí hiện tại' },
  'View details': { en: 'View details', vi: 'Xem chi tiết' },
  'Route Details': { en: 'Route Details', vi: 'Chi tiết tuyến' },
  'Passenger Feedback': { en: 'Passenger Feedback', vi: 'Phản hồi hành khách' },
  'Favorite Routes': { en: 'Favorite Routes', vi: 'Tuyến yêu thích' },
  'Favorite Stops': { en: 'Favorite Stops', vi: 'Điểm dừng yêu thích' },
  'Current password': { en: 'Current password', vi: 'Mật khẩu hiện tại' },
  'New password': { en: 'New password', vi: 'Mật khẩu mới' },
  'Confirm new password': { en: 'Confirm new password', vi: 'Xác nhận mật khẩu mới' },
  'Nơi xuất phát': { en: 'Departure', vi: 'Nơi xuất phát' },
  'Nơi đến': { en: 'Destination', vi: 'Nơi đến' },
  'Ngày đi': { en: 'Departure date', vi: 'Ngày đi' },
  'Tìm kiếm': { en: 'Search', vi: 'Tìm kiếm' },
  'Tuyến đường phổ biến': { en: 'Popular routes', vi: 'Tuyến đường phổ biến' },
  'Xem tất cả tuyến đường': { en: 'View all routes', vi: 'Xem tất cả tuyến đường' },
  'Đặt ngay': { en: 'Book now', vi: 'Đặt ngay' },
  'Ưu đãi nổi bật': { en: 'Featured offers', vi: 'Ưu đãi nổi bật' },
  'Đối tác thanh toán tin cậy': { en: 'Trusted payment partners', vi: 'Đối tác thanh toán tin cậy' },
  'Walk-in Ticket Monitoring': { en: 'Walk-in Ticket Monitoring', vi: 'Giám sát vé mua trực tiếp' },
  'Walk-in ticket records': { en: 'Walk-in ticket records', vi: 'Danh sách vé mua trực tiếp' },
  'Revenue reconciliation': { en: 'Revenue reconciliation', vi: 'Đối soát doanh thu' },
  'Monitor Active Trips': { en: 'Monitor Active Trips', vi: 'Giám sát chuyến đang chạy' },
  'Monitor Delayed Trips': { en: 'Monitor Delayed Trips', vi: 'Giám sát chuyến trễ' },
  'Visible Fleet': { en: 'Visible Fleet', vi: 'Đội xe đang hiển thị' },
  'Live socket': { en: 'Live socket', vi: 'Kết nối trực tiếp' },
  'Polling fallback': { en: 'Polling fallback', vi: 'Đồng bộ định kỳ' },
  'Demo Data': { en: 'Demo Data', vi: 'Dữ liệu mẫu' },
  'Acknowledge delay': { en: 'Acknowledge delay', vi: 'Xác nhận chuyến trễ' },
  'Add Stop': { en: 'Add stop', vi: 'Thêm điểm dừng' },
  'Approval note': { en: 'Approval note', vi: 'Ghi chú phê duyệt' },
  'Route required': { en: 'Route required', vi: 'Cần chọn tuyến' },
  'All routes': { en: 'All routes', vi: 'Tất cả tuyến' },
  'Add New Policy': { en: 'Add New Policy', vi: 'Thêm chính sách mới' },
  'No policies found.': { en: 'No policies found.', vi: 'Không tìm thấy chính sách nào.' },
  'Quản lý tuyến xe buýt': { en: 'Bus route management', vi: 'Quản lý tuyến xe buýt' },
  'Tạo bản nháp mới': { en: 'Create new draft', vi: 'Tạo bản nháp mới' },
  'Fare Matrix': { en: 'Fare Matrix', vi: 'Ma trận giá vé' },
  'Monthly Pass Pricing': { en: 'Monthly Pass Pricing', vi: 'Giá vé tháng' },
  'Priority Discounts': { en: 'Priority Discounts', vi: 'Giảm giá ưu tiên' },
  'Create policy': { en: 'Create policy', vi: 'Tạo chính sách' },
  'Edit policy': { en: 'Edit policy', vi: 'Chỉnh sửa chính sách' },
  'Promotion list': { en: 'Promotion list', vi: 'Danh sách khuyến mãi' },
  'Route performance overview': { en: 'Route performance overview', vi: 'Tổng quan hiệu suất tuyến' },
  'Grouped analytics': { en: 'Grouped analytics', vi: 'Phân tích theo nhóm' },
  'Violation records': { en: 'Violation records', vi: 'Danh sách vi phạm' },
  'Restriction history': { en: 'Restriction history', vi: 'Lịch sử hạn chế' },
  'Notification history': { en: 'Notification history', vi: 'Lịch sử thông báo' },
  'Create broadcast': { en: 'Create broadcast', vi: 'Tạo thông báo phát rộng' },
  'Payload preview': { en: 'Payload preview', vi: 'Xem trước nội dung gửi' },
};

const statusTranslations = {
  en: {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    'ON-TIME': 'On time',
    BOARDING: 'Boarding',
    OPEN: 'Open',
    CLOSED: 'Closed',
    RESOLVED: 'Resolved',
    URGENT: 'Urgent',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  },
  vi: {
    ACTIVE: 'Đang hoạt động',
    INACTIVE: 'Ngừng hoạt động',
    PENDING: 'Chờ xử lý',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
    COMPLETED: 'Đã hoàn tất',
    CANCELLED: 'Đã hủy',
    DELAYED: 'Bị trễ',
    'ON-TIME': 'Đúng giờ',
    BOARDING: 'Đang đón khách',
    OPEN: 'Đang mở',
    CLOSED: 'Đã đóng',
    RESOLVED: 'Đã xử lý',
    URGENT: 'Khẩn cấp',
    HIGH: 'Cao',
    MEDIUM: 'Trung bình',
    LOW: 'Thấp',
  },
};

const preserveWhitespace = (original, translated) => {
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
};

const translateDynamicText = (text, language) => {
  const replacements = language === 'vi'
    ? [
      [/\b(\d+)\s+buses?\b/gi, '$1 xe'],
      [/\b(\d+)\s+results?\b/gi, '$1 kết quả'],
      [/\bPage\s+(\d+)\s+of\s+(\d+)\b/gi, 'Trang $1 / $2'],
      [/\bShowing\s+(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)\b/gi, 'Hiển thị $1–$2 trong $3'],
      [/\b(\d+)\s+minutes?\b/gi, '$1 phút'],
      [/\b(\d+)\s+hours?\b/gi, '$1 giờ'],
      [/\b(\d+)\s+days?\b/gi, '$1 ngày'],
    ]
    : [
      [/(\d+)\s+xe\b/gi, '$1 buses'],
      [/(\d+)\s+kết quả\b/gi, '$1 results'],
      [/Trang\s+(\d+)\s*\/\s*(\d+)/gi, 'Page $1 of $2'],
      [/Hiển thị\s+(\d+)\s*[-–]\s*(\d+)\s+trong\s+(\d+)/gi, 'Showing $1–$2 of $3'],
      [/(\d+)\s+phút\b/gi, '$1 minutes'],
      [/(\d+)\s+giờ\b/gi, '$1 hours'],
      [/(\d+)\s+ngày\b/gi, '$1 days'],
    ];

  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
};

export const translateAdminPhrase = (value, language = 'en') => {
  if (value === null || value === undefined) return value;
  const original = String(value);
  const normalized = original.replace(/\s+/g, ' ').trim();
  if (!normalized) return original;
  if (['VN', 'EN'].includes(normalized)) return original;

  const status = statusTranslations[language]?.[normalized.toUpperCase()];
  if (status) return preserveWhitespace(original, status);

  const translated = (phraseOverrides[normalized] || adminPhraseTranslations[normalized])?.[language];
  if (translated) return preserveWhitespace(original, translated);

  return translateDynamicText(original, language);
};

export const getAdminMessage = (language, key, fallback = key) => (
  adminMessages[language]?.[key]
  || adminMessages.en[key]
  || fallback
);

export const useAdminI18n = () => {
  const languageState = useLanguage();
  const { language } = languageState;

  return {
    ...languageState,
    t: (key, fallback) => getAdminMessage(language, key, fallback),
    tp: (value) => translateAdminPhrase(value, language),
  };
};

export default useAdminI18n;
