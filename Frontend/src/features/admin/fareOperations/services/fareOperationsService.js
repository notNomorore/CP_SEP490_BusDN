import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((acc, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    acc[key] = value;
  }
  return acc;
}, {});

export const fareOperationsService = {
  listFareMatrix(params) {
    return apiClient.get('/admin/fares/matrix', { params: normalizeParams(params) });
  },
  createFareMatrix(payload) {
    return apiClient.post('/admin/fares/matrix', payload);
  },
  updateFareMatrix(id, payload) {
    return apiClient.put(`/admin/fares/matrix/${id}`, payload);
  },
  updateFareMatrixStatus(id, status) {
    return apiClient.patch(`/admin/fares/matrix/${id}/status`, { status });
  },
  deleteFareMatrix(id) {
    return apiClient.delete(`/admin/fares/matrix/${id}`);
  },
  listMonthlyPassPricing(params) {
    return apiClient.get('/admin/fares/monthly-pass-pricing', { params: normalizeParams(params) });
  },
  createMonthlyPassPricing(payload) {
    return apiClient.post('/admin/fares/monthly-pass-pricing', payload);
  },
  updateMonthlyPassPricing(id, payload) {
    return apiClient.put(`/admin/fares/monthly-pass-pricing/${id}`, payload);
  },
  updateMonthlyPassPricingStatus(id, status) {
    return apiClient.patch(`/admin/fares/monthly-pass-pricing/${id}/status`, { status });
  },
  deleteMonthlyPassPricing(id) {
    return apiClient.delete(`/admin/fares/monthly-pass-pricing/${id}`);
  },
  listPriorityDiscounts(params) {
    return apiClient.get('/admin/fares/priority-discounts', { params: normalizeParams(params) });
  },
  createPriorityDiscount(payload) {
    return apiClient.post('/admin/fares/priority-discounts', payload);
  },
  updatePriorityDiscount(id, payload) {
    return apiClient.put(`/admin/fares/priority-discounts/${id}`, payload);
  },
  updatePriorityDiscountStatus(id, status) {
    return apiClient.patch(`/admin/fares/priority-discounts/${id}/status`, { status });
  },
  deletePriorityDiscount(id) {
    return apiClient.delete(`/admin/fares/priority-discounts/${id}`);
  },
};

export default fareOperationsService;
