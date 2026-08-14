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
  confirmGeneratedTripSchedules: async (rows, replaceScheduled = false, planningOnly = false) => {
    return apiClient.post('/admin/trip-schedules/confirm-generated', { rows, replaceScheduled, planningOnly });
  },
  updateTripSchedule: async (scheduleId, data) => {
    return apiClient.put(`/admin/trip-schedules/${scheduleId}`, data);
  },
  deleteTripSchedule: async (scheduleId) => {
    return apiClient.delete(`/admin/trip-schedules/${scheduleId}`);
  },
  deleteTripSchedules: async (data = {}) => {
    return apiClient.delete('/admin/trip-schedules', { data });
  },
  getShifts: async (params = {}) => {
    return apiClient.get('/admin/shifts', { params });
  },
  getShiftStaffPriorities: async (params = {}) => {
    return apiClient.get('/admin/shifts/staff-priorities', { params });
  },
  getWeeklyRoster: async (weekStartDate) => apiClient.get('/admin/rosters/weekly', { params: { weekStartDate } }),
  getRosterAvailableStaff: async (params) => apiClient.get('/admin/rosters/available-staff', { params }),
  getWeeklyRosterRequirements: async (weekStartDate) => apiClient.get('/admin/rosters/requirements', { params: { weekStartDate } }),
  saveWeeklyRosterRequirements: async (weekStartDate, routeRequirements) => apiClient.put('/admin/rosters/requirements', { weekStartDate, routeRequirements }),
  resetWeeklyRosterRequirements: async (weekStartDate) => apiClient.delete('/admin/rosters/requirements', { data: { weekStartDate } }),
  autoGenerateWeeklyRoster: async (weekStartDate) => apiClient.post('/admin/rosters/auto-generate', { weekStartDate }),
  validateWeeklyRoster: async (weekStartDate) => apiClient.post('/admin/rosters/validate', { weekStartDate }),
  publishWeeklyRoster: async (weekStartDate) => apiClient.post('/admin/rosters/publish', { weekStartDate }),
  reopenWeeklyRoster: async (weekStartDate) => apiClient.post('/admin/rosters/reopen', { weekStartDate }),
  cancelAllWeeklyRosterShifts: async (weekStartDate) => apiClient.delete('/admin/rosters/weekly', { data: { weekStartDate } }),
  getSchedulingOverview: async (date) => {
    return apiClient.get('/admin/scheduling/overview', { params: { date } });
  },
  getStaffingDemand: async (params = {}) => {
    return apiClient.get('/admin/scheduling/staffing-demand', { params });
  },
  getRouteOperatingConfigs: async (params = {}) => {
    return apiClient.get('/admin/scheduling/route-configs', { params });
  },
  saveRouteOperatingConfigs: async (data) => {
    return apiClient.put('/admin/scheduling/route-configs', data);
  },
  getEligibleSchedulingDrivers: async (params) => {
    return apiClient.get('/admin/scheduling/eligible-drivers', { params });
  },
  generateSchedulingPlan: async (data) => {
    return apiClient.post('/admin/scheduling/generate', data);
  },
  getSchedulingPlans: async (params = {}) => {
    return apiClient.get('/admin/scheduling/plans', { params });
  },
  cancelSchedulingPlan: async (planId) => {
    return apiClient.delete(`/admin/scheduling/plans/${planId}`);
  },
  validateSchedulingPlan: async (data) => {
    return apiClient.post('/admin/scheduling/validate', data);
  },
  confirmSchedulingPlan: async (data) => {
    return apiClient.post('/admin/scheduling/confirm', data);
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
  previewTripAllocation: async (params) => {
    return apiClient.get('/admin/shifts/trip-allocation/preview', { params });
  },
  confirmTripAllocation: async (rows) => {
    return apiClient.post('/admin/shifts/trip-allocation/confirm', { rows });
  },
  getTripAvailableDrivers: async (tripId) => {
    return apiClient.get(`/admin/trip-schedules/${tripId}/available-drivers`);
  },
  assignDriverToTrip: async (tripId, driverId) => {
    return apiClient.post(`/admin/trip-schedules/${tripId}/assign-driver`, { driverId });
  },
  removeDriverFromTrip: async (tripId) => {
    return apiClient.delete(`/admin/trip-schedules/${tripId}/driver-assignment`);
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
  archiveShifts: async (data = {}) => {
    return apiClient.delete('/admin/shifts', { data });
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
  removeDriverFromSelectedShift: async (shiftId) => {
    return apiClient.delete(`/admin/shifts/${shiftId}/driver-assignment`);
  },
  assignAssistantToSelectedShift: async (shiftId, data) => {
    return apiClient.post(`/admin/shifts/${shiftId}/assign-assistant`, data);
  },
  removeAssistantFromSelectedShift: async (shiftId) => {
    return apiClient.delete(`/admin/shifts/${shiftId}/assistant-assignment`);
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
