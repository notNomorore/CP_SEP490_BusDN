import apiClient from '../../../shared/services/apiClient.js';

export const ticketService = {
  getMyTickets: async () => {
    const response = await apiClient.get('/tickets/me');
    return response.data;
  },

  getTicket: async (ticketId) => {
    const response = await apiClient.get(`/tickets/${ticketId}`);
    return response.data;
  },

  cancelTicket: async (ticketId) => {
    const response = await apiClient.patch(`/tickets/${ticketId}/cancel`);
    return response.data;
  },
};

export default ticketService;
