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

  async sendNotification(id, payload) {
    return apiClient.post(`/admin/incidents/${id}/notifications`, payload);
  },

  async reassignAssistant(id, payload) {
    return apiClient.patch(`/admin/incidents/${id}/reassign-assistant`, payload);
  },

  async reassignStaff(id, payload) {
    return apiClient.patch(`/admin/incidents/${id}/reassign-staff`, payload);
  },

  async getOverviewStatistics(params) {
    return apiClient.get('/admin/incidents/statistics/overview', { params: normalizeParams(params) });
  },
};

export default incidentReportService;
