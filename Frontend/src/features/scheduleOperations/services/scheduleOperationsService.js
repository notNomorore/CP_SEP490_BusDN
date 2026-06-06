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

  acceptAssignedTrip: async (assignmentId) => {
    const response = await apiClient.patch(
      `/schedule-operations/assigned-trips/${assignmentId}/accept`
    );
    return response.data;
  },

  rejectAssignedTrip: async (assignmentId, payload = {}) => {
    const response = await apiClient.patch(
      `/schedule-operations/assigned-trips/${assignmentId}/reject`,
      payload
    );
    return response.data;
  },

  startTrip: async (assignmentId, payload = {}) => {
    const response = await apiClient.patch(
      `/schedule-operations/assigned-trips/${assignmentId}/start`,
      payload
    );
    return response.data;
  },

  completeTrip: async (assignmentId) => {
    const response = await apiClient.patch(
      `/schedule-operations/assigned-trips/${assignmentId}/complete`
    );
    return response.data;
  },

  syncTripGps: async (assignmentId, payload = {}) => {
    const response = await apiClient.patch(
      `/schedule-operations/assigned-trips/${assignmentId}/gps-sync`,
      payload
    );
    return response.data;
  },

  reportOperationIncident: async (assignmentId, payload = {}) => {
    const response = await apiClient.post(
      `/schedule-operations/assigned-trips/${assignmentId}/incidents`,
      payload
    );
    return response.data;
  },

  getOperationIncidents: async (assignmentId) => {
    const response = await apiClient.get(
      `/schedule-operations/assigned-trips/${assignmentId}/incidents`
    );
    return response.data;
  },
};

export default scheduleOperationsService;
