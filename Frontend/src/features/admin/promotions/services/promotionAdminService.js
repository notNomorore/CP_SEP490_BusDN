import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => {
  return Object.entries(params).reduce((accumulator, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
};

export const promotionAdminService = {
  async getPromotions(params) {
    return apiClient.get('/admin/promotions', { params: normalizeParams(params) });
  },

  async getPromotion(id) {
    return apiClient.get(`/admin/promotions/${id}`);
  },

  async createPromotion(payload) {
    return apiClient.post('/admin/promotions', payload);
  },

  async updatePromotion(id, payload) {
    return apiClient.put(`/admin/promotions/${id}`, payload);
  },

  async updatePromotionStatus(id, status) {
    return apiClient.patch(`/admin/promotions/${id}/status`, { status });
  },

  async getPromotionStatistics(id, params) {
    return apiClient.get(`/admin/promotions/${id}/statistics`, {
      params: normalizeParams(params),
    });
  },

  async getOverviewStatistics(params) {
    return apiClient.get('/admin/promotions/statistics/overview', {
      params: normalizeParams(params),
    });
  },
};

export default promotionAdminService;
