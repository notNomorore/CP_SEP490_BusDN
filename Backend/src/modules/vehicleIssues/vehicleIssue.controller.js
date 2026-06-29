import ApiResponse from '../../utils/response.js';
import VehicleIssueService from './vehicleIssue.service.js';

export class VehicleIssueController {
  static async getIssues(req, res) {
    const result = await VehicleIssueService.getIssues(req.query);
    return res.apiResponse(
      ApiResponse.success(
        result.issues,
        'Vehicle issues retrieved successfully',
        200,
        {
          ...result.pagination,
          ...result.counts,
        }
      )
    );
  }

  static async getIssueById(req, res) {
    const issue = await VehicleIssueService.getIssueById(req.params.id, req.user);
    return res.success(issue, 'Vehicle issue retrieved successfully');
  }

  static async reviewIssue(req, res) {
    const issue = await VehicleIssueService.reviewIssue(
      req.params.id,
      req.body,
      req.user,
      req.app?.io
    );
    return res.success(issue, 'Vehicle issue reviewed successfully');
  }
}

export default VehicleIssueController;
