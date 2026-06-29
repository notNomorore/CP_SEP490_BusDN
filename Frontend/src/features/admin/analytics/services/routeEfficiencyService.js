import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => {
  return Object.entries(params).reduce((accumulator, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
};

export const routeEfficiencyService = {
  async getAnalytics(params) {
    return apiClient.get('/admin/analytics/route-efficiency', {
      params: normalizeParams(params),
    });
  },

  async getRouteDetail(routeId, params) {
    return apiClient.get(`/admin/analytics/route-efficiency/${routeId}`, {
      params: normalizeParams(params),
    });
  },
};

export default routeEfficiencyService;
