import apiClient from '@/api/client';
import type {
  ApiEnvelope,
  RevenueSummaryResult,
  ShiftRevenue,
  TicketValidationResult,
  ValidateTicketPayload,
  ValidationHistoryPayload,
  WalkInTicketPayload,
  WalkInTicketHistory,
  WalkInTicketResult,
} from '@/types/busAssistant';

const cleanParams = (values: Record<string, unknown> = {}) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined),
);

const localDateInput = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDateInput = (dateInput: string, days: number) => {
  const [year, month, day] = dateInput.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
};

const vietnamDateInput = (timestamp?: string) => {
  if (!timestamp) return '';
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return '';
  const vietnamTime = new Date(value.getTime() + (7 * 60 * 60 * 1000));
  return `${vietnamTime.getUTCFullYear()}-${String(vietnamTime.getUTCMonth() + 1).padStart(2, '0')}-${String(vietnamTime.getUTCDate()).padStart(2, '0')}`;
};

const fetchWalkInTicketHistory = async (params: { date?: string } = {}): Promise<WalkInTicketHistory> => {
  const response = await apiClient.get('/bus-assistant/walkin-tickets/history', { params: cleanParams(params) }) as unknown as ApiEnvelope<WalkInTicketHistory>;
  return response.data;
};

const revenueFromSalesHistory = (history: WalkInTicketHistory, shiftRevenue?: ShiftRevenue | null): ShiftRevenue => {
  const completedTickets = (history.tickets || []).filter((ticket) => String(ticket.status || '').toUpperCase() === 'COMPLETED');
  const amountOf = (ticket: WalkInTicketHistory['tickets'][number]) => Number(ticket.collectedAmount ?? ticket.totalAmount) || 0;
  const paymentMethodOf = (value?: string) => ['BANK_TRANSFER', 'QR'].includes(String(value || '').toUpperCase()) ? 'QR' : String(value || 'CASH').toUpperCase();
  const methodTotals = new Map<string, { paymentMethod: string; transactions: number; amount: number }>();

  completedTickets.forEach((ticket) => {
    const paymentMethod = paymentMethodOf(ticket.paymentMethod);
    const current = methodTotals.get(paymentMethod) || { paymentMethod, transactions: 0, amount: 0 };
    current.transactions += 1;
    current.amount += amountOf(ticket);
    methodTotals.set(paymentMethod, current);
  });

  const totalRevenue = completedTickets.reduce((total, ticket) => total + amountOf(ticket), 0);
  const cashCollected = completedTickets
    .filter((ticket) => paymentMethodOf(ticket.paymentMethod) === 'CASH')
    .reduce((total, ticket) => total + amountOf(ticket), 0);

  return {
    ...shiftRevenue,
    totalTicketsSold: completedTickets.length,
    totalRevenue,
    cashCollected,
    ePaymentAmount: totalRevenue - cashCollected,
    revenueBreakdown: completedTickets.length ? [{ ticketType: 'WALK_IN', tickets: completedTickets.length, revenue: totalRevenue, discountAmount: 0 }] : [],
    paymentMethodBreakdown: [...methodTotals.values()],
    recentTransactions: completedTickets.slice(0, 10).map((ticket) => ({
      _id: ticket._id,
      transactionCode: ticket.ticketCode,
      ticketType: 'WALK_IN',
      paymentMethod: paymentMethodOf(ticket.paymentMethod),
      amount: amountOf(ticket),
      status: 'COMPLETED',
      completedAt: ticket.issuedAt,
    })),
  };
};

export const busAssistantApi = {
  validateTicket: async (payload: ValidateTicketPayload): Promise<TicketValidationResult> => {
    const response = await apiClient.post('/tickets/validate-qr', cleanParams({
      qrPayload: payload.qrCode || payload.qrPayload || payload.code || payload.ticketCode,
      tripId: payload.tripId,
      routeId: payload.routeId,
      routeCode: payload.routeCode,
    })) as unknown as ApiEnvelope<TicketValidationResult>;
    return response.data;
  },

  getValidationHistory: async (params: { date?: string } = {}): Promise<ValidationHistoryPayload> => {
    const response = await apiClient.get('/tickets/validation-history', { params: cleanParams(params) }) as unknown as ApiEnvelope<ValidationHistoryPayload>;
    return response.data;
  },

  createWalkInTicket: async (payload: WalkInTicketPayload): Promise<WalkInTicketResult> => {
    const response = await apiClient.post('/bus-assistant/walkin-tickets', payload) as unknown as ApiEnvelope<WalkInTicketResult>;
    return response.data;
  },

  confirmWalkInPayment: async (ticketId: string): Promise<WalkInTicketResult> => {
    const response = await apiClient.patch(`/bus-assistant/walkin-tickets/${ticketId}/confirm-payment`) as unknown as ApiEnvelope<WalkInTicketResult>;
    return response.data;
  },

  getWalkInTicketHistory: async (params: { date?: string } = {}): Promise<WalkInTicketHistory> => {
    return fetchWalkInTicketHistory(params);
  },

  resumeWalkInPayment: async (ticketId: string): Promise<WalkInTicketResult> => {
    const response = await apiClient.get(`/bus-assistant/walkin-tickets/${ticketId}/resume-payment`) as unknown as ApiEnvelope<WalkInTicketResult>;
    return response.data;
  },

  getShiftRevenue: async (params: { shiftId?: string; routeId?: string; date?: string } = {}): Promise<ShiftRevenue> => {
    const date = params.date || localDateInput();
    const previousDate = shiftDateInput(date, -1);
    const [previousHistory, currentHistory, shiftResponse] = await Promise.all([
      fetchWalkInTicketHistory({ date: previousDate }),
      fetchWalkInTicketHistory({ date }),
      apiClient.get('/bus-assistant/shift-revenue', { params: cleanParams(params) })
        .then((response) => (response as unknown as ApiEnvelope<ShiftRevenue>).data)
        .catch(() => null),
    ]);
    const ticketsById = new Map(
      [...(previousHistory.tickets || []), ...(currentHistory.tickets || [])]
        .filter((ticket) => vietnamDateInput(ticket.issuedAt) === date)
        .map((ticket) => [ticket._id, ticket]),
    );
    const tickets = [...ticketsById.values()].sort(
      (left, right) => new Date(right.issuedAt || 0).getTime() - new Date(left.issuedAt || 0).getTime(),
    );
    return revenueFromSalesHistory({ date, count: tickets.length, totalRevenue: 0, tickets }, shiftResponse);
  },

  submitRevenueSummary: async (payload: {
    shiftId: string;
    actualCollectedAmount: number;
    note?: string;
    attachmentUrls?: string[];
  }): Promise<RevenueSummaryResult> => {
    const response = await apiClient.post('/bus-assistant/revenue-summary', payload) as unknown as ApiEnvelope<RevenueSummaryResult>;
    return response.data;
  },
};

export default busAssistantApi;
