import { axiosClient } from '../axiosClient';

export const assistantApi = {
  chat: (payload) => axiosClient.post('/api/assistant/chat', payload).then((response) => response.data),
  conversations: () => axiosClient.get('/api/assistant/conversations').then((response) => response.data),
  conversation: (id) => axiosClient.get(`/api/assistant/conversations/${id}`).then((response) => response.data),
  archiveConversation: (id) => axiosClient.delete(`/api/assistant/conversations/${id}`),
};
