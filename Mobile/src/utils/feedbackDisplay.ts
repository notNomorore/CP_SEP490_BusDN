import type { FeedbackCategory, FeedbackStatus } from '@/api/passenger.api';

export const feedbackCategories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'SERVICE_QUALITY', label: 'Chất lượng dịch vụ' },
  { value: 'DRIVER_BEHAVIOR', label: 'Thái độ tài xế' },
  { value: 'BUS_ASSISTANT_BEHAVIOR', label: 'Thái độ phụ xe' },
  { value: 'BUS_CLEANLINESS', label: 'Vệ sinh xe' },
  { value: 'ROUTE_DELAY', label: 'Trễ chuyến/tuyến' },
  { value: 'SAFETY', label: 'An toàn' },
  { value: 'APP_ISSUE', label: 'Ứng dụng' },
  { value: 'PAYMENT_ISSUE', label: 'Thanh toán' },
  { value: 'OTHER', label: 'Khác' },
];

export const feedbackStatuses: Array<{ value: 'ALL' | FeedbackStatus; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Đã gửi' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_FOR_PASSENGER', label: 'Cần bổ sung' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
];

export const getFeedbackCategoryLabel = (value?: string) => (
  feedbackCategories.find((item) => item.value === value)?.label || value || 'Chưa có'
);

export const getFeedbackStatusInfo = (value?: string) => {
  switch (value) {
    case 'WAITING_FOR_PASSENGER':
      return {
        label: 'Cần bạn bổ sung',
        tone: 'warning' as const,
        description: 'BusDN cần thêm thông tin từ bạn trước khi tiếp tục xử lý.',
        canReply: true,
      };
    case 'IN_PROGRESS':
    case 'ASSIGNED':
      return {
        label: 'Đang xử lý',
        tone: 'warning' as const,
        description: 'Bộ phận hỗ trợ đang kiểm tra phản hồi của bạn.',
        canReply: false,
      };
    case 'RESOLVED':
      return {
        label: 'Đã giải quyết',
        tone: 'success' as const,
        description: 'Phản hồi đã được xử lý và có kết luận.',
        canReply: false,
      };
    case 'CLOSED':
      return {
        label: 'Đã đóng',
        tone: 'neutral' as const,
        description: 'Phiếu phản hồi đã được đóng.',
        canReply: false,
      };
    case 'REJECTED':
      return {
        label: 'Từ chối',
        tone: 'danger' as const,
        description: 'Phản hồi không đủ điều kiện xử lý.',
        canReply: false,
      };
    case 'PENDING':
    case 'SUBMITTED':
    default:
      return {
        label: 'Đã gửi',
        tone: 'neutral' as const,
        description: 'BusDN đã nhận phản hồi và sẽ tiếp nhận sớm.',
        canReply: false,
      };
  }
};
