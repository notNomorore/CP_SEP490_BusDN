import { apiClient } from '../../auth/services/authService.js';

const shouldRetrySameOrigin = (error) => (
  error?.statusCode === 404
  || error?.response?.status === 404
  || /not found/i.test(error?.message || '')
);

const sameOriginAdminRequest = async (path, options = {}) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw data?.message ? data : new Error(`Request failed with status ${response.status}`);
  }
  return data;
};

export const adminService = {
  createUser: async (data) => {
    return apiClient.post('/admin/users', data);
  },
  importUsers: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/admin/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
  getRoutes: async (params = {}) => {
    return apiClient.get('/admin/routes', { params });
  },
  getRouteDetail: async (routeId) => {
    return apiClient.get(`/admin/routes/${routeId}`);
  },
  createRoute: async (data) => {
    return apiClient.post('/admin/routes', data);
  },
  updateRoute: async (routeId, data) => {
    return apiClient.put(`/admin/routes/${routeId}`, data);
  },
  suspendRoute: async (routeId, data = {}) => {
    return apiClient.patch(`/admin/routes/${routeId}/suspend`, data);
  },
  deleteRoute: async (routeId) => {
    return apiClient.delete(`/admin/routes/${routeId}`);
  },
  getStations: async (params = {}) => {
    return apiClient.get('/admin/stations', { params });
  },
  createStation: async (data) => {
    return apiClient.post('/admin/stations', data);
  },
  getBusStops: async (params = {}) => {
    return apiClient.get('/bus-stops', { params });
  },
  createBusStop: async (data) => {
    return apiClient.post('/bus-stops', data);
  },
  updateBusStop: async (stopId, data) => {
    return apiClient.put(`/bus-stops/${stopId}`, data);
  },
  syncDanaBusStops: async () => {
    return apiClient.post('/bus-stops/sync');
  },
  getBuses: async () => {
    try {
      return await apiClient.get('/admin/buses');
    } catch (error) {
      if (!shouldRetrySameOrigin(error)) throw error;
      return sameOriginAdminRequest('/buses');
    }
  },
  createBus: async (data) => {
    try {
      return await apiClient.post('/admin/buses', data);
    } catch (error) {
      if (!shouldRetrySameOrigin(error)) throw error;
      return sameOriginAdminRequest('/buses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  },
  updateBus: async (busId, data) => {
    try {
      return await apiClient.put(`/admin/buses/${busId}`, data);
    } catch (error) {
      if (!shouldRetrySameOrigin(error)) throw error;
      return sameOriginAdminRequest(`/buses/${busId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }
  },
  getDrivers: async () => {
    return apiClient.get('/admin/drivers');
  },
  getTripSchedules: async (params = {}) => {
    return apiClient.get('/admin/trip-schedules', { params });
  },
  createTripSchedule: async (data) => {
    return apiClient.post('/admin/trip-schedules', data);
  },
  updateTripSchedule: async (scheduleId, data) => {
    return apiClient.put(`/admin/trip-schedules/${scheduleId}`, data);
  },
};

export default adminService;
