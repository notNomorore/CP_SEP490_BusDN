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

  static async listPurchasableSchedules(req, res) {
    const result = await TicketService.listPurchasableTripSchedules(req.query);
    return res.success(result, 'Purchasable trip schedules retrieved successfully');
  }

  static async validateQRCode(req, res) {
    const result = await TicketService.validateQRCode(req.user.userId, req.body);
    return res.success(result, result.message || 'Ticket validated successfully');
  }

  static async getValidationHistory(req, res) {
    const result = await TicketService.getValidationHistory(req.user.userId, req.query);
    return res.success(result, 'Validation history retrieved successfully');
  }

  static async previewPromotion(req, res) {
    const promotion = await TicketService.previewPromotion(req.user.userId, req.body);
    return res.success(promotion, 'Promotion applied successfully');
  }

  static async quotePurchase(req, res) {
    const quote = await TicketService.quoteTicketPurchase(req.user.userId, req.body);
    return res.success(quote, 'Ticket price calculated successfully');
  }

  static async createPayment(req, res) {
    const payment = await TicketService.createPaymentOrder(req.user.userId, req.body);
    return res.success(payment, 'Payment QR created successfully', 201);
  }

  static async getPaymentStatus(req, res) {
    const payment = await TicketService.getPaymentOrderStatus(req.user.userId, req.params.orderCode);
    return res.success(payment, 'Payment status retrieved successfully');
  }

  static async listMyTransactions(req, res) {
    const transactions = await TicketService.listMyTransactions(req.user.userId);
    return res.success(
      {
        transactions,
        count: transactions.length,
        totalPaid: transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      },
      'Paid transactions retrieved successfully'
    );
  }

  static async createPendingTicketPayment(req, res) {
    const payment = await TicketService.createPaymentForPendingTicket(req.user.userId, req.params.ticketId);
    return res.success(payment, 'Payment QR created successfully', 201);
  }
}

export default TicketController;
