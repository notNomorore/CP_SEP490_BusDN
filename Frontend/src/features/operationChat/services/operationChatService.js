import apiClient from '../../../shared/services/apiClient.js';

export const operationChatService = {
  getGroups: async () => {
    const response = await apiClient.get('/operation-chat/groups');
    return response.data;
  },

  getMessages: async (groupId, params = {}) => {
    const response = await apiClient.get(`/operation-chat/groups/${groupId}/messages`, { params });
    return response.data;
  },

  sendMessage: async (groupId, content) => {
    const response = await apiClient.post(`/operation-chat/groups/${groupId}/messages`, { content });
    return response.data;
  },

  markRead: async (groupId) => {
    const response = await apiClient.patch(`/operation-chat/groups/${groupId}/read`);
    return response.data;
  },
};

export default operationChatService;
