import apiClient from '../../../../shared/services/apiClient.js';

const params = (values = {}) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)
);

export const walkInTicketService = {
  getTickets(filters) {
    return apiClient.get('/admin/walkin-tickets', { params: params(filters) });
  },
  getTicket(id) {
    return apiClient.get(`/admin/walkin-tickets/${id}`);
  },
  reconcile(filters) {
    return apiClient.get('/admin/walkin-revenue/reconciliation', { params: params(filters) });
  },
};

export default walkInTicketService;
