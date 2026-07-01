import apiClient from '../../../shared/services/apiClient.js';

export const ticketService = {
  purchaseOneWayTicket: async (payload) => {
    const response = await apiClient.post('/tickets/one-way', payload);
    return response.data;
  },

  purchaseMonthlyPass: async (payload) => {
    const response = await apiClient.post('/tickets/monthly-pass', payload);
    return response.data;
  },

  getMyMonthlyPasses: async () => {
    const response = await apiClient.get('/tickets/monthly-passes/me');
    return response.data;
  },

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

  validateQRCode: async (payload) => {
    const response = await apiClient.post('/tickets/validate-qr', payload);
    return response.data;
  },

  createPayment: async (payload) => {
    const response = await apiClient.post('/tickets/payments', payload);
    return response.data;
  },

  getPaymentStatus: async (orderCode) => {
    const response = await apiClient.get(`/tickets/payments/${orderCode}`);
    return response.data;
  },

  createPendingTicketPayment: async (ticketId) => {
    const response = await apiClient.post(`/tickets/${ticketId}/payment`);
    return response.data;
  },
};

export default ticketService;
