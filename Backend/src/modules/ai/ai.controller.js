import AiService from './ai.service.js';
import { createAiOpenApiSpec } from './ai.openapi.js';

export class AiController {
  static async getOpenApiSpec(req, res) {
    const serverOrigin = `${req.protocol}://${req.get('host')}`;
    return res.json(createAiOpenApiSpec(serverOrigin));
  }

  static async searchRoutes(req, res) {
    const result = await AiService.searchRoutes(req.query);
    return res.success(result, 'AI route search completed successfully');
  }

  static async chat(req, res) {
    const result = await AiService.chat(req.body, { user: req.user });
    return res.success(result, 'AI chat response generated successfully');
  }

  static async suggestRoutes(req, res) {
    const result = await AiService.suggestRoutes(req.query);
    return res.success(result, 'AI route suggestions completed successfully');
  }

  static async findNearbyRoutes(req, res) {
    const result = await AiService.findNearbyRoutes(req.query);
    return res.success(result, 'AI nearby routes fetched successfully');
  }

  static async getRouteEta(req, res) {
    const result = await AiService.getRouteEta(req.params.routeId);
    return res.success(result, 'AI route ETA fetched successfully');
  }

  static async getLiveRoute(req, res) {
    const result = await AiService.getLiveRoute(req.params.routeId);
    return res.success(result, 'AI live route data fetched successfully');
  }
}

export default AiController;
