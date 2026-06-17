import BusAssistantService from './busAssistant.service.js';

export class BusAssistantController {
  static async validateETicket(req, res) {
    const result = await BusAssistantService.validateETicket(req.body, req.user, req);
    return res.success(result, result.message);
  }

  static async createWalkInTicket(req, res) {
    const result = await BusAssistantService.createWalkInTicket(req.body, req.user, req);
    return res.created(result, result.message);
  }

  static async getShiftRevenue(req, res) {
    const result = await BusAssistantService.getShiftRevenue(req.query, req.user, req);
    return res.success(result, 'Shift revenue retrieved successfully');
  }

  static async submitRevenueSummary(req, res) {
    const result = await BusAssistantService.submitRevenueSummary(req.body, req.user, req);
    return res.created(result, result.message);
  }
}

export default BusAssistantController;
