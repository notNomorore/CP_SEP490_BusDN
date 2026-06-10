import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => {
  return Object.entries(params).reduce((accumulator, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
};

export const revenueReportService = {
  async getRevenueReport(params) {
    return apiClient.get('/admin/revenue/reports', { params: normalizeParams(params) });
  },

  async getTicketSalesStatistics(params) {
    return apiClient.get('/admin/revenue/ticket-sales-statistics', {
      params: normalizeParams(params),
    });
  },

  async getPeakHourDemand(params) {
    return apiClient.get('/admin/revenue/peak-hour-demand', {
      params: normalizeParams(params),
    });
  },

  async exportReport(params) {
    return apiClient.get('/admin/revenue/export', {
      params: normalizeParams(params),
      responseType: 'blob',
    });
  },
};

export default revenueReportService;
