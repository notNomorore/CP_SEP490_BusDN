import ApiResponse from '../../utils/response.js';
import WalkInTicketService from './walkInTicket.service.js';

export class WalkInTicketController {
  static async getTickets(req, res) {
    const result = await WalkInTicketService.getTickets(req.query, req.user, req);
    return res.apiResponse(ApiResponse.success(
      result.tickets,
      'Walk-in ticket records retrieved successfully',
      200,
      { ...result.pagination, ...result.summary }
    ));
  }

  static async getTicketDetail(req, res) {
    const ticket = await WalkInTicketService.getTicketDetail(req.params.id, req.user, req);
    return res.success(ticket, 'Walk-in ticket detail retrieved successfully');
  }

  static async reconcileRevenue(req, res) {
    const reconciliation = await WalkInTicketService.reconcileRevenue(req.query, req.user, req);
    return res.success(reconciliation, 'Walk-in revenue reconciled successfully');
  }
}

export default WalkInTicketController;
