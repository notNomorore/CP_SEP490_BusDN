import { apiClient } from '../../auth/services/authService.js';

export const CASE_TYPES = [
  { value: 'COMPLAINT', label: 'Khieu nai' },
  { value: 'LOST_ITEM', label: 'Do that lac' },
  { value: 'SERVICE_FEEDBACK', label: 'Phan hoi dich vu' },
];

export const FEEDBACK_CATEGORIES = [
  { value: 'SERVICE_QUALITY', label: 'Chat luong dich vu' },
  { value: 'DRIVER_BEHAVIOR', label: 'Thai do tai xe' },
  { value: 'BUS_ASSISTANT_BEHAVIOR', label: 'Thai do phu xe' },
  { value: 'BUS_CLEANLINESS', label: 'Ve sinh xe' },
  { value: 'ROUTE_DELAY', label: 'Tre tuyen' },
  { value: 'SAFETY', label: 'An toan' },
  { value: 'APP_ISSUE', label: 'Ung dung' },
  { value: 'PAYMENT_ISSUE', label: 'Thanh toan' },
  { value: 'OTHER', label: 'Khac' },
];

export const FEEDBACK_STATUSES = [
  { value: 'ALL', label: 'Tat ca' },
  { value: 'NEW', label: 'Moi' },
  { value: 'IN_REVIEW', label: 'Dang tiep nhan' },
  { value: 'INVESTIGATING', label: 'Dang dieu tra' },
  { value: 'WAITING_FOR_INFORMATION', label: 'Cho bo sung thong tin' },
  { value: 'ACTION_REQUIRED', label: 'Can hanh dong' },
  { value: 'RESOLVED', label: 'Da giai quyet' },
  { value: 'CLOSED', label: 'Da dong' },
  { value: 'REOPENED', label: 'Mo lai' },
  { value: 'PENDING', label: 'Cho xu ly' },
  { value: 'IN_PROGRESS', label: 'Dang xu ly' },
  { value: 'WAITING_FOR_PASSENGER', label: 'Cho hanh khach' },
  { value: 'REJECTED', label: 'Da tu choi' },
];

export const LOST_ITEM_CATEGORIES = [
  { value: 'PERSONAL_BELONGINGS', label: 'Vat dung ca nhan' },
  { value: 'ELECTRONICS', label: 'Thiet bi dien tu' },
  { value: 'WALLET_DOCUMENTS', label: 'Vi / Giay to' },
  { value: 'CLOTHING', label: 'Quan ao' },
  { value: 'BAGS_LUGGAGE', label: 'Tui xach / Hanh ly' },
  { value: 'OTHER_ITEMS', label: 'Vat dung khac' },
];

export const CASE_STATUSES = [
  ...FEEDBACK_STATUSES,
  { value: 'OPEN', label: 'Dang mo' },
  { value: 'SUBMITTED', label: 'Da gui' },
  { value: 'WAITING_FOR_MATCH', label: 'Dang doi doi chieu' },
  { value: 'POTENTIAL_MATCH', label: 'Co kha nang trung khop' },
  { value: 'MATCH_CONFIRMED', label: 'Da xac nhan trung khop' },
  { value: 'RETURN_IN_PROGRESS', label: 'Dang sap xep hoan tra' },
  { value: 'RETURNED', label: 'Da hoan tra' },
  { value: 'UNDER_REVIEW', label: 'Dang xem xet' },
  { value: 'RESPONDED', label: 'Da phan hoi' },
];

export const PRIORITIES = [
  { value: 'ALL', label: 'Tat ca muc do' },
  { value: 'LOW', label: 'Thap' },
  { value: 'NORMAL', label: 'Binh thuong' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Khan cap' },
  { value: 'MEDIUM', label: 'Trung binh' },
  { value: 'URGENT', label: 'Rat khan cap' },
];

export const ASSIGNED_TEAMS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'OPERATION_TEAM', label: 'Operation team' },
  { value: 'SUPPORT_TEAM', label: 'Support team' },
  { value: 'MAINTENANCE_TEAM', label: 'Maintenance team' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
];

export const CORRECTIVE_ACTION_TYPES = [
  { value: 'DRIVER_WARNING', label: 'Driver warning' },
  { value: 'DRIVER_TRAINING', label: 'Driver training' },
  { value: 'SUPERVISOR_REVIEW', label: 'Supervisor review' },
  { value: 'SCHEDULE_ADJUSTMENT', label: 'Schedule adjustment' },
  { value: 'MAINTENANCE_ACTION', label: 'Maintenance action' },
  { value: 'NO_VIOLATION_FOUND', label: 'No violation found' },
  { value: 'OTHER', label: 'Other' },
];

export const RECOVERY_STATUSES = [
  { value: 'REPORTED', label: 'Da bao cao' },
  { value: 'SEARCHING', label: 'Dang tim kiem' },
  { value: 'POTENTIAL_MATCH', label: 'Co kha nang trung khop' },
  { value: 'MATCH_CONFIRMED', label: 'Da xac nhan trung khop' },
  { value: 'RETURN_IN_PROGRESS', label: 'Dang sap xep hoan tra' },
  { value: 'FOUND', label: 'Da tim thay' },
  { value: 'RETURNED', label: 'Da hoan tra' },
  { value: 'UNRECOVERED', label: 'Khong tim thay' },
];

export const LOST_ITEM_RECOVERY_STATUSES = [
  { value: 'ALL', label: 'Tat ca' },
  { value: 'REPORTED', label: 'Da bao cao' },
  { value: 'STORED', label: 'Da luu giu' },
  { value: 'POTENTIAL_MATCH', label: 'Co kha nang trung khop' },
  { value: 'MATCHED', label: 'Da ghep voi ho so mat' },
  { value: 'RETURN_IN_PROGRESS', label: 'Dang sap xep hoan tra' },
  { value: 'RETURNED', label: 'Da hoan tra' },
  { value: 'CANCELLED', label: 'Da huy' },
];

export const OPERATION_INCIDENT_STATUSES = [
  { value: 'ALL', label: 'Tat ca' },
  { value: 'OPEN', label: 'Moi' },
  { value: 'ACKNOWLEDGED', label: 'Dang xu ly' },
  { value: 'RESOLVED', label: 'Da xu ly' },
  { value: 'CANCELLED', label: 'Da huy' },
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
