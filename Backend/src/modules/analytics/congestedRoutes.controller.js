import CongestedRoutesService from './congestedRoutes.service.js';

export class CongestedRoutesController {
  static async getCongestedRoutes(req, res) {
    const analytics = await CongestedRoutesService.detectCongestedRoutes({
      ...req.query,
      io: req.app?.io,
    });

    return res.success(analytics, 'Congested routes retrieved successfully');
  }

  static async getCongestedRouteDetail(req, res) {
    const detail = await CongestedRoutesService.getCongestedRouteDetail(
      req.params.routeId,
      req.query
    );

    return res.success(detail, 'Congested route detail retrieved successfully');
  }

  static async broadcastCongestionNotification(req, res) {
    const result = await CongestedRoutesService.broadcastCongestionNotification(
      req.params.routeId,
      req.query,
      req.user,
      req.app?.io
    );

    return res.success(result, 'Congestion notification broadcast successfully');
  }
}

export default CongestedRoutesController;
