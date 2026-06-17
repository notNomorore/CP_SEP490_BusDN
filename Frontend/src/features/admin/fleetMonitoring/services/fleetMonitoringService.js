import apiClient from '../../../../shared/services/apiClient.js';

export const fleetMonitoringService = {
  getLocations: async (params = {}) => {
    const response = await apiClient.get('/admin/fleet/locations', { params });
    return response.data;
  },

  getActiveTrips: async (params = {}) => {
    const response = await apiClient.get('/admin/fleet/active-trips', { params });
    return response.data;
  },

  getActiveTripDetail: async (tripId) => {
    const response = await apiClient.get(`/admin/fleet/active-trips/${tripId}`);
    return response.data;
  },

  getDelayedTrips: async (params = {}) => {
    const response = await apiClient.get('/admin/fleet/delayed-trips', { params });
    return response.data;
  },

  acknowledgeDelayedTrip: async (tripId, data) => {
    const response = await apiClient.patch(`/admin/fleet/delayed-trips/${tripId}/acknowledge`, data);
    return response.data;
  },

  scanSystemIncidents: async () => {
    const response = await apiClient.post('/admin/fleet/system-incidents/scan');
    return response.data;
  },

  seedDemoFleet: async () => {
    const response = await apiClient.post('/admin/fleet/mock-data');
    return response.data;
  },
};

export default fleetMonitoringService;
