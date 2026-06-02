import apiClient from '../../../shared/services/apiClient.js';

export const scheduleOperationsService = {
  getAssignedTrips: async (params = {}) => {
    const response = await apiClient.get('/schedule-operations/assigned-trips', { params });
    return response.data;
  },

  getShiftSchedule: async (params = {}) => {
    const response = await apiClient.get('/schedule-operations/shift-schedule', { params });
    return response.data;
  },
};

export default scheduleOperationsService;
