import RevenueReportService from './revenueReport.service.js';

export class RevenueReportController {
  static async getRevenueReports(req, res) {
    const report = await RevenueReportService.getRevenueReports(req.query, req.user);
    return res.success(report, 'Revenue report retrieved successfully');
  }

  static async getTicketSalesStatistics(req, res) {
    const statistics = await RevenueReportService.getTicketSalesStatistics(req.query, req.user);
    return res.success(statistics, 'Ticket sales statistics retrieved successfully');
  }

  static async getPeakHourDemand(req, res) {
    const demand = await RevenueReportService.getPeakHourDemand(req.query, req.user);
    return res.success(demand, 'Peak hour demand retrieved successfully');
  }

  static async exportFinancialReport(req, res) {
    const exportedReport = await RevenueReportService.exportFinancialReport(req.query, req.user);

    res.setHeader('Content-Type', exportedReport.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportedReport.fileName}"`);
    return res.send(exportedReport.buffer);
  }
}

export default RevenueReportController;
