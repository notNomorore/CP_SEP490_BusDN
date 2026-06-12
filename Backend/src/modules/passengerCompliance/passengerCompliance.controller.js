import ApiResponse from '../../utils/response.js';
import PassengerComplianceService from './passengerCompliance.service.js';

export class PassengerComplianceController {
  static async listViolations(req, res) {
    const result = await PassengerComplianceService.listViolations(req.query, req.user, req);
    return res.apiResponse(ApiResponse.success(
      result.violations,
      'Passenger violations retrieved successfully',
      200,
      { ...result.pagination, ...result.statistics }
    ));
  }

  static async getViolation(req, res) {
    const violation = await PassengerComplianceService.getViolation(req.params.id, req.user, req);
    return res.success(violation, 'Passenger violation detail retrieved successfully');
  }

  static async applyRestriction(req, res) {
    const restriction = await PassengerComplianceService.applyRestriction(req.body, req.user, req);
    return res.created(restriction, 'Passenger restriction applied successfully');
  }

  static async updateRestriction(req, res) {
    const restriction = await PassengerComplianceService.updateRestriction(
      req.params.id,
      req.body,
      req.user,
      req
    );
    return res.success(restriction, 'Passenger restriction updated successfully');
  }

  static async listRestrictions(req, res) {
    const result = await PassengerComplianceService.listRestrictions(req.query);
    return res.success(result, 'Passenger restrictions retrieved successfully');
  }
}

export default PassengerComplianceController;
