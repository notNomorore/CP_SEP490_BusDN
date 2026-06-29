import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((result, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    result[key] = value;
  }
  return result;
}, {});

export const vehicleIssueService = {
  getIssues(params) {
    return apiClient.get('/admin/vehicle-issues', { params: normalizeParams(params) });
  },

  getIssue(id) {
    return apiClient.get(`/admin/vehicle-issues/${id}`);
  },

  reviewIssue(id, payload) {
    return apiClient.patch(`/admin/vehicle-issues/${id}/review`, payload);
  },
};

export default vehicleIssueService;
