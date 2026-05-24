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

  static async nearby(req, res, next) {
    try {
      const { latitude, longitude, radiusKm = 5 } = req.query;
      const result = await RouteService.findNearbyRoutes({ latitude, longitude, radiusKm });

      return res.success(
        {
          ...result,
          count: result.routes.length,
        },
        'Nearby routes fetched successfully'
      );
    } catch (error) {
      logger.error('Nearby route search error:', error);

      if (error.message === 'Invalid latitude or longitude') {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }
}

export default RouteController;
