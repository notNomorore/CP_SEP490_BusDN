import { apiClient } from '../../auth/services/authService.js';

export const CASE_TYPES = [
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'LOST_ITEM', label: 'Lost item' },
  { value: 'SERVICE_FEEDBACK', label: 'Service feedback' },
];

export const FEEDBACK_CATEGORIES = [
  { value: 'SERVICE_QUALITY', label: 'Service Quality' },
  { value: 'DRIVER_BEHAVIOR', label: 'Driver Behavior' },
  { value: 'BUS_ASSISTANT_SERVICE', label: 'Bus Assistant Service' },
  { value: 'ROUTE_EXPERIENCE', label: 'Route Experience' },
  { value: 'MOBILE_APPLICATION', label: 'Mobile Application' },
  { value: 'SUGGESTION', label: 'Suggestion' },
  { value: 'COMPLAINT', label: 'Complaint' },
];

export const LOST_ITEM_CATEGORIES = [
  { value: 'PERSONAL_BELONGINGS', label: 'Personal Belongings' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'WALLET_DOCUMENTS', label: 'Wallet / Documents' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'BAGS_LUGGAGE', label: 'Bags / Luggage' },
  { value: 'OTHER_ITEMS', label: 'Other Items' },
];

export const CASE_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESPONDED', label: 'Responded' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
];

export const RECOVERY_STATUSES = [
  { value: 'REPORTED', label: 'Reported' },
  { value: 'SEARCHING', label: 'Searching' },
  { value: 'FOUND', label: 'Found' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'UNRECOVERED', label: 'Unrecovered' },
];

export const customerSupportService = {
  submitLostItem: async (payload) => {
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

    return apiClient.post('/customer-support/cases', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  listMyLostItemCases: async () => apiClient.get('/customer-support/lost-items/me'),

  getMyLostItemCase: async (caseId) => apiClient.get(`/customer-support/lost-items/${caseId}`),

  submitFeedback: async (payload) => {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'attachments') {
        (value || []).forEach((file) => formData.append('attachments', file));
        return;
      }

      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });

    return apiClient.post('/customer-support/cases', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  listAdminCases: async ({ type = 'ALL', status = 'OPEN', priority = 'ALL', page = 1, limit = 20 } = {}) => (
    apiClient.get('/customer-support/admin/cases', {
      params: { type, status, priority, page, limit },
    })
  ),

  getAdminCaseDetail: async (caseId) => apiClient.get(`/customer-support/admin/cases/${caseId}`),

  respondToComplaint: async (caseId, payload) => (
    apiClient.post(`/customer-support/admin/cases/${caseId}/respond`, payload)
  ),

  updateLostItemCase: async (caseId, payload) => (
    apiClient.patch(`/customer-support/admin/cases/${caseId}/lost-item`, payload)
  ),
};

export default customerSupportService;
