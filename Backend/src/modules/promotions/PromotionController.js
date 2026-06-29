import PromotionService from './PromotionService.js';
import ApiResponse from '../../utils/response.js';

export class PromotionController {
  static async createPromotion(req, res) {
    const promotion = await PromotionService.createPromotion(req.body, req.user);
    return res.created(promotion, 'Promotion created successfully');
  }

  static async getPromotions(req, res) {
    const result = await PromotionService.getPromotions(req.query);
    return res.apiResponse(
      ApiResponse.success(
        result.items,
        'Promotions retrieved successfully',
        200,
        result.pagination
      )
    );
  }

  static async getPromotionById(req, res) {
    const promotion = await PromotionService.getPromotionById(req.params.id);
    return res.success(promotion, 'Promotion retrieved successfully');
  }

  static async updatePromotion(req, res) {
    const promotion = await PromotionService.updatePromotion(req.params.id, req.body, req.user);
    return res.success(promotion, 'Promotion updated successfully');
  }

  static async updatePromotionStatus(req, res) {
    const promotion = await PromotionService.updatePromotionStatus(
      req.params.id,
      req.body.status,
      req.user
    );
    return res.success(promotion, 'Promotion status updated successfully');
  }

  static async getPromotionStatistics(req, res) {
    const statistics = await PromotionService.getPromotionStatistics(
      req.params.id,
      req.query,
      req.user
    );
    return res.success(statistics, 'Promotion statistics retrieved successfully');
  }

  static async getOverviewStatistics(req, res) {
    const statistics = await PromotionService.getOverviewStatistics(req.query, req.user);
    return res.success(statistics, 'Promotion overview statistics retrieved successfully');
  }
}

export default PromotionController;
