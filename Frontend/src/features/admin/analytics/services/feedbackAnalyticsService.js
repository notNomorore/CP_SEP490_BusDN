import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((result, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    result[key] = value;
  }
  return result;
}, {});

export const feedbackAnalyticsService = {
  getAnalytics(params) {
    return apiClient.get('/admin/analytics/feedback', {
      params: normalizeParams(params),
    });
  },

  getDetail(params) {
    return apiClient.get('/admin/analytics/feedback/detail', {
      params: normalizeParams(params),
    });
  },
};

export default feedbackAnalyticsService;
