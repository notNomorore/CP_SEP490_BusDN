import { apiClient } from '../../auth/services/authService.js';

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
  searchStopAddresses: async (query) => {
    return apiClient.get('/bus-stops/geocode/search', { params: { q: query } });
  },
  createBusStop: async (data) => {
    return apiClient.post('/bus-stops', data);
  },
  updateBusStop: async (stopId, data) => {
    return apiClient.put(`/bus-stops/${stopId}`, data);
  },
  deleteBusStop: async (stopId) => {
    return apiClient.delete(`/bus-stops/${stopId}`);
  },
  syncDanaBusStops: async () => {
    return apiClient.post('/bus-stops/sync');
  },
  getBuses: async () => {
    return apiClient.get('/admin/buses');
  },
  createBus: async (data) => {
    return apiClient.post('/admin/buses', data);
  },
  updateBus: async (busId, data) => {
    return apiClient.put(`/admin/buses/${busId}`, data);
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
  generateTripSchedulePreview: async (data) => {
    return apiClient.post('/admin/trip-schedules/generate-preview', data);
  },
  confirmGeneratedTripSchedules: async (rows, replaceScheduled = false) => {
    return apiClient.post('/admin/trip-schedules/confirm-generated', { rows, replaceScheduled });
  },
  updateTripSchedule: async (scheduleId, data) => {
    return apiClient.put(`/admin/trip-schedules/${scheduleId}`, data);
  },
  deleteTripSchedule: async (scheduleId) => {
    return apiClient.delete(`/admin/trip-schedules/${scheduleId}`);
  },
  getShifts: async (params = {}) => {
    return apiClient.get('/admin/shifts', { params });
  },
  createShift: async (data) => {
    return apiClient.post('/admin/shifts', data);
  },
  autoGenerateShiftSchedule: async (data) => {
    return apiClient.post('/admin/shifts/auto-generate', data);
  },
  confirmGeneratedShifts: async (rows) => {
    return apiClient.post('/admin/shifts/confirm-generated', { rows });
  },
  getAvailableShiftDrivers: async (params) => {
    return apiClient.get('/admin/shifts/available-drivers', { params });
  },
  getAvailableShiftAssistants: async (params) => {
    return apiClient.get('/admin/shifts/available-assistants', { params });
  },
  getAvailableShiftVehicles: async (params) => {
    return apiClient.get('/admin/shifts/available-vehicles', { params });
  },
  updateShift: async (shiftId, data) => {
    return apiClient.put(`/admin/shifts/${shiftId}`, data);
  },
  archiveShift: async (shiftId) => {
    return apiClient.delete(`/admin/shifts/${shiftId}`);
  },
  getShiftAssignments: async (params = {}) => {
    return apiClient.get('/admin/shift-assignments', { params });
  },
  assignDriverToShift: async (data) => {
    return apiClient.post('/admin/shift-assignments/drivers', data);
  },
  assignVehicleToShift: async (data) => {
    return apiClient.post('/admin/shift-assignments/vehicles', data);
  },
  assignTripToShift: async (data) => {
    return apiClient.post('/admin/shift-assignments/trips', data);
  },
  assignDriverToSelectedShift: async (shiftId, data) => {
    return apiClient.post(`/admin/shifts/${shiftId}/assign-driver`, data);
  },
  assignAssistantToSelectedShift: async (shiftId, data) => {
    return apiClient.post(`/admin/shifts/${shiftId}/assign-assistant`, data);
  },
  assignVehicleToSelectedShift: async (shiftId, data) => {
    return apiClient.post(`/admin/shifts/${shiftId}/assign-vehicle`, data);
  },
  assignTripToSelectedShift: async (shiftId, data) => {
    return apiClient.post(`/admin/shifts/${shiftId}/assign-trip`, data);
  },
  getShiftAssignmentsByShift: async (shiftId) => {
    return apiClient.get(`/admin/shifts/${shiftId}/assignments`);
  },
};

export default adminService;
