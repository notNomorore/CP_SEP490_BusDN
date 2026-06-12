import apiClient from '../../../../shared/services/apiClient.js';

const cleanParams = (values = {}) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)
);

export const passengerComplianceService = {
  getViolations(filters) {
    return apiClient.get('/admin/passenger-violations', { params: cleanParams(filters) });
  },
  getViolation(id) {
    return apiClient.get(`/admin/passenger-violations/${id}`);
  },
  getRestrictions(filters = {}) {
    return apiClient.get('/admin/passenger-restrictions', { params: cleanParams(filters) });
  },
  applyRestriction(payload) {
    return apiClient.post('/admin/passenger-restrictions', payload);
  },
  updateRestriction(id, status) {
    return apiClient.patch(`/admin/passenger-restrictions/${id}`, { status });
  },
};

export default passengerComplianceService;
