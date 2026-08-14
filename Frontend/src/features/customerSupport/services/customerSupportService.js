import { apiClient } from '../../auth/services/authService.js';

export const CASE_TYPES = [
  { value: 'COMPLAINT', label: 'Khiếu nại' },
  { value: 'LOST_ITEM', label: 'Đồ thất lạc' },
  { value: 'SERVICE_FEEDBACK', label: 'Góp ý dịch vụ' },
];

export const FEEDBACK_CATEGORIES = [
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

export const FEEDBACK_STATUSES = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NEW', label: 'Mới' },
  { value: 'IN_REVIEW', label: 'Đang tiếp nhận' },
  { value: 'INVESTIGATING', label: 'Đang xác minh' },
  { value: 'WAITING_FOR_INFORMATION', label: 'Chờ bổ sung thông tin' },
  { value: 'ACTION_REQUIRED', label: 'Cần xử lý' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
  { value: 'REOPENED', label: 'Mở lại' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_FOR_PASSENGER', label: 'Chờ hành khách' },
  { value: 'REJECTED', label: 'Đã từ chối' },
];

export const LOST_ITEM_CATEGORIES = [
  { value: 'PERSONAL_BELONGINGS', label: 'Vật dụng cá nhân' },
  { value: 'ELECTRONICS', label: 'Thiết bị điện tử' },
  { value: 'WALLET_DOCUMENTS', label: 'Ví / giấy tờ' },
  { value: 'CLOTHING', label: 'Quần áo' },
  { value: 'BAGS_LUGGAGE', label: 'Túi xách / hành lý' },
  { value: 'OTHER_ITEMS', label: 'Vật dụng khác' },
];

export const CASE_STATUSES = [
  ...FEEDBACK_STATUSES,
  { value: 'OPEN', label: 'Đang mở' },
  { value: 'SUBMITTED', label: 'Đã gửi' },
  { value: 'WAITING_FOR_MATCH', label: 'Đang đợi đối chiếu' },
  { value: 'POTENTIAL_MATCH', label: 'Có khả năng trùng khớp' },
  { value: 'MATCH_CONFIRMED', label: 'Đã xác nhận trùng khớp' },
  { value: 'RETURN_IN_PROGRESS', label: 'Đang sắp xếp hoàn trả' },
  { value: 'RETURNED', label: 'Đã hoàn trả' },
  { value: 'UNDER_REVIEW', label: 'Đang xem xét' },
  { value: 'RESPONDED', label: 'Đã phản hồi' },
];

export const PRIORITIES = [
  { value: 'ALL', label: 'Tất cả mức độ' },
  { value: 'LOW', label: 'Thấp' },
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Khẩn cấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'URGENT', label: 'Rất khẩn cấp' },
];

export const ASSIGNED_TEAMS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'OPERATION_TEAM', label: 'Đội vận hành' },
  { value: 'SUPPORT_TEAM', label: 'Đội hỗ trợ' },
  { value: 'MAINTENANCE_TEAM', label: 'Đội bảo trì' },
  { value: 'UNASSIGNED', label: 'Chưa phân công' },
];

export const CORRECTIVE_ACTION_TYPES = [
  { value: 'DRIVER_WARNING', label: 'Nhắc nhở tài xế' },
  { value: 'DRIVER_TRAINING', label: 'Đào tạo tài xế' },
  { value: 'SUPERVISOR_REVIEW', label: 'Quản lý xem xét' },
  { value: 'SCHEDULE_ADJUSTMENT', label: 'Điều chỉnh lịch chạy' },
  { value: 'MAINTENANCE_ACTION', label: 'Xử lý bảo trì' },
  { value: 'NO_VIOLATION_FOUND', label: 'Không phát hiện vi phạm' },
  { value: 'OTHER', label: 'Khác' },
];

export const RECOVERY_STATUSES = [
  { value: 'REPORTED', label: 'Đã báo cáo' },
  { value: 'SEARCHING', label: 'Đang tìm kiếm' },
  { value: 'POTENTIAL_MATCH', label: 'Có khả năng trùng khớp' },
  { value: 'MATCH_CONFIRMED', label: 'Đã xác nhận trùng khớp' },
  { value: 'RETURN_IN_PROGRESS', label: 'Đang sắp xếp hoàn trả' },
  { value: 'FOUND', label: 'Đã tìm thấy' },
  { value: 'RETURNED', label: 'Đã hoàn trả' },
  { value: 'UNRECOVERED', label: 'Không tìm thấy' },
];

export const LOST_ITEM_RECOVERY_STATUSES = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'REPORTED', label: 'Đã báo cáo' },
  { value: 'STORED', label: 'Đã lưu giữ' },
  { value: 'POTENTIAL_MATCH', label: 'Có khả năng trùng khớp' },
  { value: 'MATCHED', label: 'Đã ghép với hồ sơ mất' },
  { value: 'RETURN_IN_PROGRESS', label: 'Đang sắp xếp hoàn trả' },
  { value: 'RETURNED', label: 'Đã hoàn trả' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export const OPERATION_INCIDENT_STATUSES = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'OPEN', label: 'Mới' },
  { value: 'ACKNOWLEDGED', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const buildMultipartPayload = (payload) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'attachments') {
      (value || []).forEach((file) => formData.append('attachments', file));
      return;
    }

    if (key === 'lostItem') {
      formData.append('lostItem', JSON.stringify(value || {}));
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });

  return formData;
};

export const customerSupportService = {
  submitLostItem: async (payload) => (
    apiClient.post('/customer-support/cases', buildMultipartPayload(payload), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ),

  listMyLostItemCases: async () => apiClient.get('/customer-support/lost-items/me'),

  getMyLostItemCase: async (caseId) => apiClient.get(`/customer-support/lost-items/${caseId}`),

  submitFeedback: async (payload) => (
    apiClient.post('/customer-support/cases', buildMultipartPayload(payload), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ),

  listMyFeedback: async ({ status = 'ALL', search = '', page = 1, limit = 10 } = {}) => (
    apiClient.get('/customer-support/feedback/me', {
      params: { status, search, page, limit },
    })
  ),

  getMyFeedback: async (caseId) => apiClient.get(`/customer-support/feedback/${caseId}`),

  replyToFeedback: async (caseId, payload) => (
    apiClient.post(`/customer-support/feedback/${caseId}/replies`, payload)
  ),

  listAdminCases: async (params = {}) => (
    apiClient.get('/customer-support/admin/cases', {
      params: {
        type: 'SERVICE_FEEDBACK',
        status: 'ALL',
        priority: 'ALL',
        page: 1,
        limit: 20,
        ...params,
      },
    })
  ),

  getAdminCaseDetail: async (caseId) => apiClient.get(`/customer-support/admin/cases/${caseId}`),

  getFeedbackAnalytics: async () => apiClient.get('/customer-support/admin/feedback/analytics'),

  assignFeedback: async (caseId, payload = {}) => (
    apiClient.patch(`/customer-support/admin/cases/${caseId}/assign`, payload)
  ),

  previewCaseNotification: async (caseId, payload = {}) => (
    apiClient.post(`/customer-support/admin/cases/${caseId}/notifications/preview`, payload)
  ),

  updateFeedback: async (caseId, payload) => (
    apiClient.patch(`/customer-support/admin/cases/${caseId}/feedback`, payload)
  ),

  addInternalNote: async (caseId, payload) => (
    apiClient.post(`/customer-support/admin/cases/${caseId}/notes`, payload)
  ),

  addCorrectiveAction: async (caseId, payload) => (
    apiClient.post(`/customer-support/admin/cases/${caseId}/actions`, payload)
  ),

  respondToComplaint: async (caseId, payload) => (
    apiClient.post(`/customer-support/admin/cases/${caseId}/respond`, payload)
  ),

  updateLostItemCase: async (caseId, payload) => (
    apiClient.patch(`/customer-support/admin/cases/${caseId}/lost-item`, payload)
  ),

  listAdminLostItems: async ({ status = 'ALL', recoveryStatus = 'ALL', page = 1, limit = 20 } = {}) => (
    apiClient.get('/customer-support/admin/lost-items', {
      params: { status, recoveryStatus, page, limit },
    })
  ),

  getAdminLostItemDetail: async (caseId) => apiClient.get(`/customer-support/admin/lost-items/${caseId}`),

  updateAdminLostItem: async (caseId, payload) => (
    apiClient.patch(`/customer-support/admin/lost-items/${caseId}`, payload)
  ),

  listLostFoundMatches: async ({ status = 'PENDING_REVIEW', page = 1, limit = 20 } = {}) => (
    apiClient.get('/customer-support/admin/lost-items/matches', {
      params: { status, page, limit },
    })
  ),

  getLostFoundMatch: async (matchId) => (
    apiClient.get(`/customer-support/admin/lost-items/matches/${matchId}`)
  ),

  confirmLostFoundMatch: async (matchId, payload = {}) => (
    apiClient.post(`/customer-support/admin/lost-items/matches/${matchId}/confirm`, payload)
  ),

  rejectLostFoundMatch: async (matchId, payload = {}) => (
    apiClient.post(`/customer-support/admin/lost-items/matches/${matchId}/reject`, payload)
  ),

  startLostFoundReturn: async (matchId, payload = {}) => (
    apiClient.post(`/customer-support/admin/lost-items/matches/${matchId}/return/start`, payload)
  ),

  completeLostFoundReturn: async (matchId, payload = {}) => (
    apiClient.post(`/customer-support/admin/lost-items/matches/${matchId}/return/complete`, payload)
  ),
};

export default customerSupportService;
