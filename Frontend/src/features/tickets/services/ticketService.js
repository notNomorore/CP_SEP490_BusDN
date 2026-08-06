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

  getPurchasableSchedules: async (params) => {
    const response = await apiClient.get('/tickets/purchasable-schedules', { params });
    return response.data;
  },

  getMyTickets: async () => {
    const response = await apiClient.get('/tickets/me');
    return response.data;
  },

  getMyTransactions: async () => {
    const response = await apiClient.get('/tickets/transactions/me');
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

  applyPromotion: async (payload) => {
    const response = await apiClient.post('/tickets/promotions/apply', payload);
    return response.data;
  },

  quotePurchase: async (payload) => {
    const response = await apiClient.post('/tickets/quote', payload);
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

  createPendingMonthlyPassPayment: async (passId) => {
    const response = await apiClient.post(`/tickets/monthly-passes/${passId}/payment`);
    return response.data;
  },

  cancelMonthlyPass: async (passId) => {
    const response = await apiClient.patch(`/tickets/monthly-passes/${passId}/cancel`);
    return response.data;
  },
};

export default ticketService;
