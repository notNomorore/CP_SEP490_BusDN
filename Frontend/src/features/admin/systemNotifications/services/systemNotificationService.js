import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((accumulator, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    accumulator[key] = value;
  }
  return accumulator;
}, {});

export const systemNotificationService = {
  getNotifications(params) {
    return apiClient.get('/admin/notifications', { params: normalizeParams(params) });
  },

  getNotification(id) {
    return apiClient.get(`/admin/notifications/${id}`);
  },

  broadcast(payload) {
    return apiClient.post('/admin/notifications/broadcast', payload);
  },

  cancel(id) {
    return apiClient.patch(`/admin/notifications/${id}/cancel`);
  },
};

export default systemNotificationService;
