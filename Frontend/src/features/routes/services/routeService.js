import apiClient from '../../../shared/services/apiClient.js';

export const routeService = {
  purchaseOneWayTicket: async (payload) => {
    const response = await apiClient.post('/tickets/one-way', payload);
    return response.data;
  },

  searchRoutes: async ({ q = '', from = '', to = '' } = {}) => {
    const response = await apiClient.get('/routes/search', {
      params: { q, from, to },
    });

    return response.data;
  },

  searchNearbyRoutes: async ({ latitude, longitude, radiusKm = 5 }) => {
    const response = await apiClient.get('/routes/nearby', {
      params: { latitude, longitude, radiusKm },
    });

    return response.data;
  },

  findBestRoute: async ({ from, to, preference = 'fastest' }) => {
    const response = await apiClient.get('/routes/best', {
      params: { from, to, preference },
    });

    return response.data;
  },

  suggestRouteOptions: async ({ from, to, preference = 'fastest' }) => {
    const response = await apiClient.get('/routes/suggestions', {
      params: { from, to, preference },
    });

    return response.data;
  },

  getLiveBusLocations: async (routeId) => {
    const response = await apiClient.get(`/routes/${routeId}/live`);
    return response.data;
  },

  getEstimatedArrivalTimes: async (routeId) => {
    const response = await apiClient.get(`/routes/${routeId}/eta`);
    return response.data;
  },

  getFavoriteRoutes: async () => {
    const response = await apiClient.get('/profile/favorites/routes');
    return response.data;
  },

  saveFavoriteRoute: async (routeId) => {
    const response = await apiClient.post(`/profile/favorites/routes/${routeId}`);
    return response.data;
  },

  removeFavoriteRoute: async (routeId) => {
    const response = await apiClient.delete(`/profile/favorites/routes/${routeId}`);
    return response.data;
  },

  getFavoriteStops: async () => {
    const response = await apiClient.get('/profile/favorites/stops');
    return response.data;
  },

  saveFavoriteStop: async (payload) => {
    const response = await apiClient.post('/profile/favorites/stops', payload);
    return response.data;
  },

  removeFavoriteStop: async (stopId) => {
    const response = await apiClient.delete(`/profile/favorites/stops/${encodeURIComponent(stopId)}`);
    return response.data;
  },

  getArrivalNotifications: async () => {
    const response = await apiClient.get('/profile/notifications/arrival');
    return response.data;
  },

  subscribeArrivalNotification: async (payload) => {
    const response = await apiClient.post('/profile/notifications/arrival', payload);
    return response.data;
  },

  removeArrivalNotification: async (subscriptionId) => {
    const response = await apiClient.delete(`/profile/notifications/arrival/${encodeURIComponent(subscriptionId)}`);
    return response.data;
  },

  getDelayNotifications: async () => {
    const response = await apiClient.get('/profile/notifications/delay');
    return response.data;
  },

  subscribeDelayNotification: async (payload) => {
    const response = await apiClient.post('/profile/notifications/delay', payload);
    return response.data;
  },

  removeDelayNotification: async (subscriptionId) => {
    const response = await apiClient.delete(`/profile/notifications/delay/${encodeURIComponent(subscriptionId)}`);
    return response.data;
  },

  getRouteChangeNotifications: async () => {
    const response = await apiClient.get('/profile/notifications/route-change');
    return response.data;
  },

  subscribeRouteChangeNotification: async (payload) => {
    const response = await apiClient.post('/profile/notifications/route-change', payload);
    return response.data;
  },

  removeRouteChangeNotification: async (subscriptionId) => {
    const response = await apiClient.delete(`/profile/notifications/route-change/${encodeURIComponent(subscriptionId)}`);
    return response.data;
  },
};

export default routeService;
