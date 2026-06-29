import apiClient from '../../../../shared/services/apiClient.js';

const params = (values = {}) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)
);

export const systemMonitoringService = {
  getAuditLogs(filters) {
    return apiClient.get('/admin/audit-logs', { params: params(filters) });
  },
  getAuditLog(id) {
    return apiClient.get(`/admin/audit-logs/${id}`);
  },
  getSuspiciousActivities(filters) {
    return apiClient.get('/admin/suspicious-activities', { params: params(filters) });
  },
  getSuspiciousActivity(id) {
    return apiClient.get(`/admin/suspicious-activities/${id}`);
  },
  updateSuspiciousStatus(id, payload) {
    return apiClient.patch(`/admin/suspicious-activities/${id}/status`, payload);
  },
  getOverview() {
    return apiClient.get('/admin/system-monitoring/overview');
  },
};

export default systemMonitoringService;
