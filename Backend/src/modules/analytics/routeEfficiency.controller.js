import RouteEfficiencyService from './routeEfficiency.service.js';

export class RouteEfficiencyController {
  static async getRouteEfficiency(req, res) {
    const analytics = await RouteEfficiencyService.getRouteEfficiency(req.query, req.user);
    return res.success(analytics, 'Route efficiency analytics retrieved successfully');
  }

  static async getRouteEfficiencyDetail(req, res) {
    const analytics = await RouteEfficiencyService.getRouteEfficiencyDetail(
      req.params.routeId,
      req.query,
      req.user
    );
    return res.success(analytics, 'Route efficiency detail retrieved successfully');
  }
}

export default RouteEfficiencyController;
