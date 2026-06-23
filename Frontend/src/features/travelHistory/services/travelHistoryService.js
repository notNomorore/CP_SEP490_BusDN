import apiClient from '../../../shared/services/apiClient.js';

export const travelHistoryService = {
  getTravelHistory: async () => {
    const response = await apiClient.get('/profile/travel-history');
    return response.data;
  },
};

export default travelHistoryService;
