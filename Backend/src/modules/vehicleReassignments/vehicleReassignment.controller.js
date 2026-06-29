import VehicleReassignmentService from './vehicleReassignment.service.js';

export class VehicleReassignmentController {
  static async getReplacementCandidates(req, res) {
    const result = await VehicleReassignmentService.findReplacementVehicleCandidates(req.query);
    return res.success(result, result.candidates.length
      ? 'Replacement candidates retrieved successfully'
      : 'No eligible replacement vehicles are available for this trip');
  }

  static async assignReplacementVehicle(req, res) {
    const result = await VehicleReassignmentService.assignReplacementVehicle(
      req.params.tripId,
      req.body.replacementVehicleId,
      req.body,
      req.user.userId,
      req.app.io
    );
    return res.success(result, 'Replacement vehicle assigned successfully');
  }
}

export default VehicleReassignmentController;
