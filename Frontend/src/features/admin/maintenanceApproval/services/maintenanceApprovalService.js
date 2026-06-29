import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((result, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    result[key] = value;
  }
  return result;
}, {});

export const maintenanceApprovalService = {
  getPendingApproval(params) {
    return apiClient.get('/admin/maintenance/pending-approval', { params: normalizeParams(params) });
  },

  approveTask(id, payload) {
    return apiClient.patch(`/admin/maintenance/tasks/${id}/approve`, payload);
  },

  rejectTask(id, payload) {
    return apiClient.patch(`/admin/maintenance/tasks/${id}/reject`, payload);
  },
};

export default maintenanceApprovalService;
