import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((accumulator, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    accumulator[key] = value;
  }

  return accumulator;
}, {});

export const congestedRoutesService = {
  async getCongestedRoutes(params) {
    return apiClient.get('/admin/analytics/congested-routes', {
      params: normalizeParams(params),
    });
  },

  async getRouteDetail(routeId, params) {
    return apiClient.get(`/admin/analytics/congested-routes/${routeId}/detail`, {
      params: normalizeParams(params),
    });
  },

  async broadcastNotification(routeId, params) {
    return apiClient.post(`/admin/analytics/congested-routes/${routeId}/broadcast`, null, {
      params: normalizeParams(params),
    });
  },
};

export default congestedRoutesService;
