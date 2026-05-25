import { apiClient } from '../../auth/services/authService.js';

export const CASE_TYPES = [
  { value: 'COMPLAINT', label: 'Khiếu nại' },
  { value: 'LOST_ITEM', label: 'Đồ thất lạc' },
];

export const CASE_STATUSES = [
  { value: 'OPEN', label: 'Mới' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CLOSED', label: 'Đã đóng' },
  { value: 'ALL', label: 'Tất cả' },
];

export const RECOVERY_STATUSES = [
  { value: 'REPORTED', label: 'Đã tiếp nhận' },
  { value: 'SEARCHING', label: 'Đang tìm' },
  { value: 'FOUND', label: 'Đã tìm thấy' },
  { value: 'RETURNED', label: 'Đã hoàn trả' },
  { value: 'UNRECOVERED', label: 'Không tìm thấy' },
];

export const customerSupportService = {
  listAdminCases: async ({ type = 'ALL', status = 'OPEN', priority = 'ALL', page = 1, limit = 20 } = {}) => {
    return apiClient.get('/customer-support/admin/cases', {
      params: { type, status, priority, page, limit },
    });
  },

  getAdminCaseDetail: async (caseId) => {
    return apiClient.get(`/customer-support/admin/cases/${caseId}`);
  },

  respondToComplaint: async (caseId, payload) => {
    return apiClient.post(`/customer-support/admin/cases/${caseId}/respond`, payload);
  },

  updateLostItemCase: async (caseId, payload) => {
    return apiClient.patch(`/customer-support/admin/cases/${caseId}/lost-item`, payload);
  },
};

export default customerSupportService;
