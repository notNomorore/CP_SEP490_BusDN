import { apiClient } from '../../auth/services/authService.js';

export const CASE_TYPES = [
  { value: 'COMPLAINT', label: 'Khiếu nại' },
];

export const CASE_STATUSES = [
  { value: 'OPEN', label: 'Mới' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CLOSED', label: 'Đã đóng' },
  { value: 'ALL', label: 'Tất cả' },
];

export const COMPLAINT_RESPONSE_STATUSES = [
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CLOSED', label: 'Đã đóng' },
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
};

export default customerSupportService;
