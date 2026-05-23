import RouteService from './RouteService.js';
import logger from '../../utils/logger.js';

export class RouteController {
  static async search(req, res, next) {
    try {
      const { q = '', from = '', to = '' } = req.query;
      const routes = await RouteService.searchRoutes({ q, from, to });

      return res.success(
        {
          routes,
          count: routes.length,
          filters: { q, from, to },
        },
        'Routes fetched successfully'
      );
    } catch (error) {
      logger.error('Route search error:', error);
      next(error);
    }
  }
}

export default RouteController;
