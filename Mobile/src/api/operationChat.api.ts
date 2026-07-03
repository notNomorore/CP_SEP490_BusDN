import apiClient from '@/api/client';
import type { ApiEnvelope } from '@/types/scheduleOperations';
import type {
  OperationChatGroupsPayload,
  OperationChatMessagePayload,
  OperationChatMessagesPayload,
} from '@/types/operationChat';

const webChatBasePath = '/operation-chat';
const scheduleChatAliasPath = '/schedule-operations/operation-chat';

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { statusCode?: unknown; status?: unknown; message?: unknown };
  return maybeError.statusCode === 404
    || maybeError.status === 404
    || String(maybeError.message || '').toLowerCase().includes('not found');
};

async function withChatFallback<T>(request: (basePath: string) => Promise<T>) {
  try {
    return await request(webChatBasePath);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    console.warn('Operation chat primary API returned 404. Retrying mobile-compatible alias.');
    return request(scheduleChatAliasPath);
  }
}

export const operationChatApi = {
  getGroups: async (): Promise<OperationChatGroupsPayload> => {
    return withChatFallback(async (basePath) => {
      const response = await apiClient.get(`${basePath}/groups`) as unknown as ApiEnvelope<OperationChatGroupsPayload>;
      return response.data;
    });
  },

  getMessages: async (groupId: string, params: { limit?: number } = {}): Promise<OperationChatMessagesPayload> => {
    return withChatFallback(async (basePath) => {
      const response = await apiClient.get(`${basePath}/groups/${groupId}/messages`, { params }) as unknown as ApiEnvelope<OperationChatMessagesPayload>;
      return response.data;
    });
  },

  sendMessage: async (groupId: string, content: string): Promise<OperationChatMessagePayload> => {
    return withChatFallback(async (basePath) => {
      const response = await apiClient.post(`${basePath}/groups/${groupId}/messages`, { content }) as unknown as ApiEnvelope<OperationChatMessagePayload>;
      return response.data;
    });
  },

  markRead: async (groupId: string): Promise<unknown> => {
    return withChatFallback(async (basePath) => {
      const response = await apiClient.patch(`${basePath}/groups/${groupId}/read`) as unknown as ApiEnvelope<unknown>;
      return response.data;
    });
  },
};

export default operationChatApi;
