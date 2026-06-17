import FleetMonitoringService from './fleetMonitoring.service.js';

export class FleetMonitoringController {
  static async scanSystemIncidents(req, res) {
    const result = await FleetMonitoringService.scanSystemIncidents(req.user, req.app.io);
    return res.success(result, 'System fleet incidents scanned successfully');
  }

  static async getActiveTrips(req, res) {
    const result = await FleetMonitoringService.getActiveTrips(req.query);
    return res.success(result, 'Active trips retrieved successfully');
  }

  static async getActiveTripDetail(req, res) {
    const result = await FleetMonitoringService.getActiveTripDetail(req.params.tripId);
    return res.success(result, 'Active trip detail retrieved successfully');
  }

  static async getDelayedTrips(req, res) {
    const result = await FleetMonitoringService.getDelayedTrips(req.query);
    return res.success(result, 'Delayed trips retrieved successfully');
  }

  static async acknowledgeDelayedTrip(req, res) {
    const result = await FleetMonitoringService.acknowledgeDelayedTrip(
      req.params.tripId,
      req.body,
      req.user,
      req.app.io
    );
    return res.success(result, 'Delayed trip acknowledged successfully');
  }

  static async getFleetLocations(req, res) {
    const result = await FleetMonitoringService.getFleetLocations(req.query);
    return res.success(result, 'Fleet locations retrieved successfully');
  }

  static async seedDemoFleet(req, res) {
    const result = await FleetMonitoringService.seedDemoFleet(req.user);
    return res.created(result, 'Demo fleet data created successfully');
  }
}

export default FleetMonitoringController;
