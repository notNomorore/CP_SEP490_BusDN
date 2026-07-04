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

export type IncidentPayload = Record<string, unknown> & {
  evidenceFiles?: Array<{
    uri: string;
    name?: string;
    type?: string;
  }>;
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

  startVehicleInspection: async (assignmentId: string, payload = {}) => {
    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/inspection/start`, payload) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },

  confirmVehicleReady: async (assignmentId: string, payload = {}) => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/inspection/ready`, payload) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },

  reportVehicleIssue: async (assignmentId: string, payload = {}) => {
    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/inspection/issues`, payload) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },

  acceptAssignedTrip: async (assignmentId: string): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/accept`) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  rejectAssignedTrip: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/reject`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  startTrip: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/start`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  completeTrip: async (assignmentId: string): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/complete`) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  syncTripGps: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/gps-sync`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return response.data;
  },

  reportOperationIncident: async (assignmentId: string, payload: IncidentPayload = {}) => {
    if (payload.evidenceFiles?.length) {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'evidenceFiles' || value === undefined || value === null) return;
        formData.append(key, String(value));
      });
      payload.evidenceFiles.forEach((file) => {
        formData.append('evidenceFiles', {
          uri: file.uri,
          name: file.name || 'evidence.jpg',
          type: file.type || 'image/jpeg',
        } as unknown as Blob);
      });

      const response = await apiClient.post(
        `/schedule-operations/assigned-trips/${assignmentId}/incidents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      ) as unknown as ApiEnvelope<unknown>;
      return response.data;
    }

    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/incidents`, payload) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },

  getOperationIncidents: async (assignmentId: string) => {
    const response = await apiClient.get(`/schedule-operations/assigned-trips/${assignmentId}/incidents`) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },
};

export default scheduleOperationsApi;
