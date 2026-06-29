import ApiResponse from '../../utils/response.js';
import FleetOperationsService from './fleetOperations.service.js';

export class FleetOperationsController {
  static async listVehicles(req, res) {
    const result = await FleetOperationsService.listVehicles(req.query);
    return res.apiResponse(
      ApiResponse.success(result.vehicles, 'Vehicles retrieved successfully', 200, result.pagination)
    );
  }

  static async createVehicle(req, res) {
    const vehicle = await FleetOperationsService.createVehicle(req.body);
    return res.created(vehicle, 'Vehicle created successfully');
  }

  static async listTrips(req, res) {
    const result = await FleetOperationsService.listTrips(req.query);
    return res.apiResponse(
      ApiResponse.success(result.trips, 'Trips retrieved successfully', 200, result.pagination)
    );
  }

  static async createTrip(req, res) {
    const trip = await FleetOperationsService.createTrip(req.body);
    return res.created(trip, 'Trip created successfully');
  }

  static async updateGps(req, res) {
    const result = await FleetOperationsService.updateGps(req.body, req.app.io);
    return res.success(result, 'Vehicle location updated successfully');
  }

  static async createIncident(req, res) {
    const result = await FleetOperationsService.createIncident(req.body, req.user, req.app.io);
    return res.created(result, 'Incident reported successfully');
  }

  static async updateIncidentStatus(req, res) {
    const result = await FleetOperationsService.updateIncidentStatus(
      req.params.id,
      req.body,
      req.user,
      req.app.io
    );
    return res.success(result, 'Incident status updated successfully');
  }
}

export default FleetOperationsController;
