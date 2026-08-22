import apiClient from '../../../shared/services/apiClient.js';

export const sendChatMessage = async (messages) => {
  const response = await apiClient.post('/ai/chat', { messages });
  return response.data?.reply || 'Mình chưa tạo được phản hồi. Bạn vui lòng thử lại.';
};

export default {
  sendChatMessage,
};
