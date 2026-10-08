import { axiosClient } from '../axiosClient';

export const assistantApi = {
  chat: (payload) => axiosClient.post('/api/assistant/chat', payload).then((response) => response.data),
};
