import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => {
  return Object.entries(params).reduce((accumulator, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
};

export const incidentReportService = {
  async getIncidents(params) {
    return apiClient.get('/admin/incidents', { params: normalizeParams(params) });
  },

  async getIncident(id) {
    return apiClient.get(`/admin/incidents/${id}`);
  },

  async updateStatus(id, payload) {
    return apiClient.patch(`/admin/incidents/${id}/status`, payload);
  },

  async reassignAssistant(id, payload) {
    return apiClient.patch(`/admin/incidents/${id}/reassign-assistant`, payload);
  },

  async getOverviewStatistics() {
    return apiClient.get('/admin/incidents/statistics/overview');
  },
};

export default incidentReportService;
