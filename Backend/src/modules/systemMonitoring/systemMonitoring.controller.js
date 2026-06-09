import ApiResponse from '../../utils/response.js';
import SystemMonitoringService from './systemMonitoring.service.js';

export class SystemMonitoringController {
  static async getAuditLogs(req, res) {
    const result = await SystemMonitoringService.getAuditLogs(req.query);
    return res.apiResponse(ApiResponse.success(result.items, 'Audit logs retrieved successfully', 200, result.meta));
  }

  static async getAuditLogDetail(req, res) {
    const log = await SystemMonitoringService.getAuditLogDetail(req.params.id, req.user, req);
    return res.success(log, 'Audit log detail retrieved successfully');
  }

  static async getSuspiciousActivities(req, res) {
    const result = await SystemMonitoringService.getSuspiciousActivities(req.query);
    return res.apiResponse(ApiResponse.success(result.items, 'Suspicious activities retrieved successfully', 200, result.meta));
  }

  static async getSuspiciousDetail(req, res) {
    const activity = await SystemMonitoringService.getSuspiciousDetail(req.params.id, req.user, req);
    return res.success(activity, 'Suspicious activity detail retrieved successfully');
  }

  static async updateSuspiciousStatus(req, res) {
    const activity = await SystemMonitoringService.updateSuspiciousStatus(
      req.params.id,
      req.body,
      req.user,
      req
    );
    return res.success(activity, 'Suspicious activity status updated successfully');
  }

  static async getOverview(req, res) {
    const overview = await SystemMonitoringService.getOverview();
    return res.success(overview, 'System monitoring overview retrieved successfully');
  }
}

export default SystemMonitoringController;
