import apiClient from '@/api/client';
import type {
  ApiEnvelope,
  AssignedTrip,
  AssignedTripsPayload,
  OperationNotificationsPayload,
  ShiftSchedulePayload,
} from '@/types/scheduleOperations';

export type ScheduleRangeParams = {
  from?: string;
  to?: string;
  status?: string;
};

export const scheduleOperationsApi = {
  getAssignedTrips: async (params: ScheduleRangeParams = {}): Promise<AssignedTripsPayload> => {
    const response = await apiClient.get('/schedule-operations/assigned-trips', { params }) as unknown as ApiEnvelope<AssignedTripsPayload>;
    return response.data;
  },

  getShiftSchedule: async (params: ScheduleRangeParams = {}): Promise<ShiftSchedulePayload> => {
    const response = await apiClient.get('/schedule-operations/shift-schedule', { params }) as unknown as ApiEnvelope<ShiftSchedulePayload>;
    return response.data;
  },

  getOperationNotifications: async (params: ScheduleRangeParams = {}): Promise<OperationNotificationsPayload> => {
    const response = await apiClient.get('/schedule-operations/operation-notifications', { params }) as unknown as ApiEnvelope<OperationNotificationsPayload>;
    return response.data;
  },

  acceptAssignedTrip: async (assignmentId: string): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/accept`) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  startTrip: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/start`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  reportOperationIncident: async (assignmentId: string, payload = {}) => {
    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/incidents`, payload) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },
};

export default scheduleOperationsApi;
