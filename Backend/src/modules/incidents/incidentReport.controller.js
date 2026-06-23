import ApiResponse from '../../utils/response.js';
import IncidentReportService from './incidentReport.service.js';

export class IncidentReportController {
  static async getIncidents(req, res) {
    const result = await IncidentReportService.getIncidents(req.query);
    return res.apiResponse(
      ApiResponse.success(
        result.incidents,
        'Incident reports retrieved successfully',
        200,
        {
          ...result.pagination,
          ...result.counts,
        }
      )
    );
  }

  static async getIncidentById(req, res) {
    const incident = await IncidentReportService.getIncidentById(
      req.params.id,
      req.user
    );
    return res.success(incident, 'Incident report retrieved successfully');
  }

  static async updateIncidentStatus(req, res) {
    const incident = await IncidentReportService.updateIncidentStatus(
      req.params.id,
      req.body,
      req.user
    );
    return res.success(incident, 'Incident status updated successfully');
  }

  static async reassignTripAssistant(req, res) {
    const incident = await IncidentReportService.reassignTripAssistant(
      req.params.id,
      req.body,
      req.user
    );
    return res.success(incident, 'Trip assistant reassigned successfully');
  }

  static async getOverviewStatistics(req, res) {
    const statistics = await IncidentReportService.getOverviewStatistics();
    return res.success(statistics, 'Incident overview statistics retrieved successfully');
  }
}

export default IncidentReportController;
