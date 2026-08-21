import routeRecommendationService from './routeRecommendation.service.js';
import logger from '../../utils/logger.js';
import { searchStopAddresses } from '../busStops/BusStopService.js';

export class RouteRecommendationController {
  static async recommend(req, res, next) {
    try {
      const result = await routeRecommendationService.recommend(req.query);
      return res.success(result, 'Route recommendations calculated successfully');
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      logger.error('Route recommendation error:', error);
      next(error);
    }
  }

  static async geocode(req, res, next) {
    try {
      const query = String(req.query.q || '').trim();

      if (query.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Search text must contain at least 3 characters',
        });
      }

      const results = await searchStopAddresses(query);
      return res.success({
        query,
        results,
      }, 'Address search completed successfully');
    } catch (error) {
      logger.error('Route recommendation geocode error:', error);
      next(error);
    }
  }
}

export default RouteRecommendationController;
