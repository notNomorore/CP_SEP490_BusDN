import apiClient from '@/api/client';
import type {
  ApiEnvelope,
  RevenueSummaryResult,
  ShiftRevenue,
  TicketValidationResult,
  ValidateTicketPayload,
  WalkInTicketPayload,
  WalkInTicketResult,
} from '@/types/busAssistant';

const cleanParams = (values: Record<string, unknown> = {}) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined),
);

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

  createWalkInTicket: async (payload: WalkInTicketPayload): Promise<WalkInTicketResult> => {
    const response = await apiClient.post('/bus-assistant/walkin-tickets', payload) as unknown as ApiEnvelope<WalkInTicketResult>;
    return response.data;
  },

  getShiftRevenue: async (params: { shiftId?: string; routeId?: string; date?: string } = {}): Promise<ShiftRevenue> => {
    const response = await apiClient.get('/bus-assistant/shift-revenue', { params: cleanParams(params) }) as unknown as ApiEnvelope<ShiftRevenue>;
    return response.data;
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
