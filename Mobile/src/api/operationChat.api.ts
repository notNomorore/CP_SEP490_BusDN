import apiClient from '@/api/client';
import type { ApiEnvelope } from '@/types/scheduleOperations';
import type {
  OperationChatGroupsPayload,
  OperationChatMessagePayload,
  OperationChatMessagesPayload,
} from '@/types/operationChat';

export const operationChatApi = {
  getGroups: async (): Promise<OperationChatGroupsPayload> => {
    const response = await apiClient.get('/schedule-operations/operation-chat/groups') as unknown as ApiEnvelope<OperationChatGroupsPayload>;
    return response.data;
  },

  getMessages: async (groupId: string, params: { limit?: number } = {}): Promise<OperationChatMessagesPayload> => {
    const response = await apiClient.get(`/schedule-operations/operation-chat/groups/${groupId}/messages`, { params }) as unknown as ApiEnvelope<OperationChatMessagesPayload>;
    return response.data;
  },

  sendMessage: async (groupId: string, content: string): Promise<OperationChatMessagePayload> => {
    const response = await apiClient.post(`/schedule-operations/operation-chat/groups/${groupId}/messages`, { content }) as unknown as ApiEnvelope<OperationChatMessagePayload>;
    return response.data;
  },

  markRead: async (groupId: string): Promise<unknown> => {
    const response = await apiClient.patch(`/schedule-operations/operation-chat/groups/${groupId}/read`) as unknown as ApiEnvelope<unknown>;
    return response.data;
  },
};

export default operationChatApi;
