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

  startVehicleInspection: async (assignmentId, payload = {}) => {
    const response = await apiClient.post(
      `/schedule-operations/assigned-trips/${assignmentId}/inspection/start`,
      payload
    );
    return response.data;
  },

  confirmVehicleReady: async (assignmentId, payload = {}) => {
    const response = await apiClient.patch(
      `/schedule-operations/assigned-trips/${assignmentId}/inspection/ready`,
      payload
    );
    return response.data;
  },

  reportVehicleIssue: async (assignmentId, payload = {}) => {
    const response = await apiClient.post(
      `/schedule-operations/assigned-trips/${assignmentId}/inspection/issues`,
      payload
    );
    return response.data;
  },
};

export default scheduleOperationsService;
