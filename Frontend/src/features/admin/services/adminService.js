import { apiClient } from '../../auth/services/authService.js';

export const adminService = {
  createUser: async (data) => {
    return apiClient.post('/admin/users', data);
  },
  getStaffPerformance: async () => {
    return apiClient.get('/admin/staff-performance');
  },
  getUsers: async (params = {}) => {
    return apiClient.get('/admin/users', { params });
  },
  getUserDetail: async (userId) => {
    return apiClient.get(`/admin/users/${userId}`);
  },
  lockUser: async (userId, data) => {
    return apiClient.patch(`/admin/users/${userId}/lock`, data);
  },
  unlockUser: async (userId) => {
    return apiClient.patch(`/admin/users/${userId}/unlock`);
  },
};

export default adminService;
