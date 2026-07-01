import apiClient from '../../../shared/services/apiClient.js';

const params = (values = {}) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)
);

export const busAssistantService = {
  validateETicket(payload) {
    return apiClient.post('/tickets/validate-qr', params({
      qrPayload: payload.qrCode || payload.qrPayload || payload.code,
      tripId: payload.tripId,
      routeId: payload.routeId,
      routeCode: payload.routeCode,
    })).then((response) => response.data);
  },
  createWalkInTicket(payload) {
    return apiClient.post('/bus-assistant/walkin-tickets', payload).then((response) => response.data);
  },
  getShiftRevenue(filters = {}) {
    return apiClient.get('/bus-assistant/shift-revenue', { params: params(filters) }).then((response) => response.data);
  },
  submitRevenueSummary(payload) {
    return apiClient.post('/bus-assistant/revenue-summary', payload).then((response) => response.data);
  },
};

export default busAssistantService;
