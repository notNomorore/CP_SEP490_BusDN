import ApiResponse from '../../utils/response.js';
import FareOperationsService from './fareOperations.service.js';

export class FareOperationsController {
  static async listFareMatrix(req, res) {
    const result = await FareOperationsService.listFareMatrix(req.query);
    return res.apiResponse(ApiResponse.success(result.items, 'Fare matrix rules retrieved successfully', 200, result.pagination));
  }

  static async createFareMatrix(req, res) {
    const item = await FareOperationsService.createFareMatrix(req.body, req.user);
    return res.created(item, 'Fare matrix rule created successfully');
  }

  static async updateFareMatrix(req, res) {
    const item = await FareOperationsService.updateFareMatrix(req.params.id, req.body, req.user);
    return res.success(item, 'Fare matrix rule updated successfully');
  }

  static async updateFareMatrixStatus(req, res) {
    const item = await FareOperationsService.updateFareMatrixStatus(req.params.id, req.body.status, req.user);
    return res.success(item, 'Fare matrix status updated successfully');
  }

  static async deleteFareMatrix(req, res) {
    const item = await FareOperationsService.deleteFareMatrix(req.params.id, req.user);
    return res.success(item, 'Fare matrix rule deactivated successfully');
  }

  static async listMonthlyPassPricing(req, res) {
    const result = await FareOperationsService.listMonthlyPassPricing(req.query);
    return res.apiResponse(ApiResponse.success(result.items, 'Monthly pass pricing rules retrieved successfully', 200, result.pagination));
  }

  static async createMonthlyPassPricing(req, res) {
    const item = await FareOperationsService.createMonthlyPassPricing(req.body);
    return res.created(item, 'Monthly pass pricing rule created successfully');
  }

  static async updateMonthlyPassPricing(req, res) {
    const item = await FareOperationsService.updateMonthlyPassPricing(req.params.id, req.body);
    return res.success(item, 'Monthly pass pricing rule updated successfully');
  }

  static async updateMonthlyPassPricingStatus(req, res) {
    const item = await FareOperationsService.updateMonthlyPassPricingStatus(req.params.id, req.body.status);
    return res.success(item, 'Monthly pass pricing status updated successfully');
  }

  static async deleteMonthlyPassPricing(req, res) {
    const item = await FareOperationsService.deleteMonthlyPassPricing(req.params.id);
    return res.success(item, 'Monthly pass pricing rule deactivated successfully');
  }

  static async listPriorityDiscounts(req, res) {
    const result = await FareOperationsService.listPriorityDiscounts(req.query);
    return res.apiResponse(ApiResponse.success(result.items, 'Priority discount policies retrieved successfully', 200, result.pagination));
  }

  static async createPriorityDiscount(req, res) {
    const item = await FareOperationsService.createPriorityDiscount(req.body);
    return res.created(item, 'Priority discount policy created successfully');
  }

  static async updatePriorityDiscount(req, res) {
    const item = await FareOperationsService.updatePriorityDiscount(req.params.id, req.body);
    return res.success(item, 'Priority discount policy updated successfully');
  }

  static async updatePriorityDiscountStatus(req, res) {
    const item = await FareOperationsService.updatePriorityDiscountStatus(req.params.id, req.body.status);
    return res.success(item, 'Priority discount status updated successfully');
  }

  static async deletePriorityDiscount(req, res) {
    const item = await FareOperationsService.deletePriorityDiscount(req.params.id);
    return res.success(item, 'Priority discount policy deactivated successfully');
  }

  static async calculateOneWayFare(req, res) {
    const result = await FareOperationsService.calculateOneWayFare(req.body);
    return res.success(result, 'One-way fare calculated successfully');
  }

  static async calculateMonthlyPassPrice(req, res) {
    const result = await FareOperationsService.calculateMonthlyPassPrice(req.body);
    return res.success(result, 'Monthly pass price calculated successfully');
  }
}

export default FareOperationsController;
