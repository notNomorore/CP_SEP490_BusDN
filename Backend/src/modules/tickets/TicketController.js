import TicketService from './TicketService.js';

export class TicketController {
  static async purchaseOneWay(req, res) {
    const ticket = await TicketService.purchaseOneWayTicket(req.user.userId, req.body);
    return res.success(ticket, 'One-way ticket purchased successfully', 201);
  }

  static async listMyTickets(req, res) {
    const tickets = await TicketService.listMyTickets(req.user.userId);
    return res.success({ tickets, count: tickets.length }, 'Purchased tickets retrieved successfully');
  }

  static async getMyTicket(req, res) {
    const ticket = await TicketService.getMyTicketById(req.user.userId, req.params.ticketId);
    return res.success(ticket, 'E-ticket retrieved successfully');
  }

  static async cancelMyTicket(req, res) {
    const ticket = await TicketService.cancelMyTicket(req.user.userId, req.params.ticketId);
    return res.success(ticket, 'Ticket cancelled successfully');
  }

  static async purchaseMonthlyPass(req, res) {
    const monthlyPass = await TicketService.purchaseMonthlyPass(req.user.userId, req.body);
    return res.success(monthlyPass, 'Monthly pass purchased successfully', 201);
  }

  static async listMyMonthlyPasses(req, res) {
    const passes = await TicketService.listMyMonthlyPasses(req.user.userId);
    return res.success({ passes, count: passes.length }, 'Monthly passes retrieved successfully');
  }

  static async validateQRCode(req, res) {
    const result = await TicketService.validateQRCode(req.user.userId, req.body);
    return res.success(result, result.message || 'Ticket validated successfully');
  }
}

export default TicketController;
