import apiClient from '@/api/client';
import type {
  ApiEnvelope,
  AssignedTrip,
  AssignedTripsPayload,
  OperationIncident,
  OperationIncidentsPayload,
  OperationNotificationsPayload,
  ShiftSchedulePayload,
  VehicleInspection,
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

const unwrapData = <T>(response: ApiEnvelope<T> | T): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
};

export const scheduleOperationsApi = {
  getAssignedTrips: async (params: ScheduleRangeParams = {}): Promise<AssignedTripsPayload> => {
    const response = await apiClient.get('/schedule-operations/assigned-trips', { params }) as unknown as ApiEnvelope<AssignedTripsPayload>;
    return unwrapData(response);
  },

  getAssignedTripDetail: async (assignmentId: string): Promise<AssignedTrip> => {
    const response = await apiClient.get(`/schedule-operations/assigned-trips/${assignmentId}`) as unknown as ApiEnvelope<AssignedTrip>;
    return unwrapData(response);
  },

  getShiftSchedule: async (params: ScheduleRangeParams = {}): Promise<ShiftSchedulePayload> => {
    const response = await apiClient.get('/schedule-operations/shift-schedule', { params }) as unknown as ApiEnvelope<ShiftSchedulePayload>;
    return unwrapData(response);
  },

  getOperationNotifications: async (params: ScheduleRangeParams = {}): Promise<OperationNotificationsPayload> => {
    const response = await apiClient.get('/schedule-operations/operation-notifications', { params }) as unknown as ApiEnvelope<OperationNotificationsPayload>;
    return unwrapData(response);
  },

  startVehicleInspection: async (assignmentId: string, payload = {}): Promise<VehicleInspection> => {
    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/inspection/start`, payload) as unknown as ApiEnvelope<VehicleInspection>;
    return unwrapData(response);
  },

  confirmVehicleReady: async (assignmentId: string, payload = {}): Promise<VehicleInspection> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/inspection/ready`, payload) as unknown as ApiEnvelope<VehicleInspection>;
    return unwrapData(response);
  },

  reportVehicleIssue: async (assignmentId: string, payload = {}): Promise<VehicleInspection> => {
    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/inspection/issues`, payload) as unknown as ApiEnvelope<VehicleInspection>;
    return unwrapData(response);
  },

  acceptAssignedTrip: async (assignmentId: string): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/accept`) as unknown as ApiEnvelope<AssignedTrip>;
    return unwrapData(response);
  },

  rejectAssignedTrip: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/reject`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return unwrapData(response);
  },

  startTrip: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/start`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return unwrapData(response);
  },

  completeTrip: async (assignmentId: string): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/complete`) as unknown as ApiEnvelope<AssignedTrip>;
    return unwrapData(response);
  },

  syncTripGps: async (assignmentId: string, payload = {}): Promise<AssignedTrip> => {
    const response = await apiClient.patch(`/schedule-operations/assigned-trips/${assignmentId}/gps-sync`, payload) as unknown as ApiEnvelope<AssignedTrip>;
    return unwrapData(response);
  },

  reportOperationIncident: async (assignmentId: string, payload: IncidentPayload = {}): Promise<OperationIncident> => {
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
      ) as unknown as ApiEnvelope<OperationIncident>;
      return unwrapData(response);
    }

    const response = await apiClient.post(`/schedule-operations/assigned-trips/${assignmentId}/incidents`, payload) as unknown as ApiEnvelope<OperationIncident>;
    return unwrapData(response);
  },

  getOperationIncidents: async (assignmentId: string): Promise<OperationIncidentsPayload> => {
    const response = await apiClient.get(`/schedule-operations/assigned-trips/${assignmentId}/incidents`) as unknown as ApiEnvelope<OperationIncidentsPayload>;
    return unwrapData(response);
  },
};

export default scheduleOperationsApi;
