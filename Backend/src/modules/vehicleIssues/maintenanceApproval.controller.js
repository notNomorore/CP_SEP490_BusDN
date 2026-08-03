import ApiResponse from '../../utils/response.js';
import MaintenanceApprovalService from './maintenanceApproval.service.js';

export class MaintenanceApprovalController {
  static async getPendingApprovalTasks(req, res) {
    const result = await MaintenanceApprovalService.getPendingApprovalTasks(req.query);
    return res.apiResponse(
      ApiResponse.success(
        result.tasks,
        'Maintenance tasks waiting for approval retrieved successfully',
        200,
        result.pagination
      )
    );
  }

  static async approveMaintenanceTask(req, res) {
    const task = await MaintenanceApprovalService.approveMaintenanceTask(
      req.params.id,
      req.user.userId,
      req.body,
      req.app?.io
    );
    return res.success(task, 'Maintenance task approved successfully');
  }

  static async startMaintenanceTask(req, res) {
    const task = await MaintenanceApprovalService.startMaintenanceTask(
      req.params.id,
      req.user.userId,
      req.body,
      req.app?.io
    );
    return res.success(task, 'Maintenance task started successfully');
  }

  static async completeMaintenanceTask(req, res) {
    const task = await MaintenanceApprovalService.completeMaintenanceTask(
      req.params.id,
      req.user.userId,
      req.body,
      req.app?.io
    );
    return res.success(task, 'Maintenance task completed and waiting for approval');
  }

  static async rejectMaintenanceTask(req, res) {
    const task = await MaintenanceApprovalService.rejectMaintenanceTask(
      req.params.id,
      req.user.userId,
      req.body,
      req.app?.io
    );
    return res.success(task, 'Maintenance task rejected for rework');
  }
}

export default MaintenanceApprovalController;
