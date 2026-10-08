import { axiosClient } from '../axiosClient';

export const notificationsApi = {
  inbox: ({ page = 0, size = 20, type } = {}) => axiosClient.get('/api/notifications/inbox', {
    params: { page, size, ...(type ? { type } : {}) },
  }).then((response) => response.data),
  unreadCount: () => axiosClient.get('/api/notifications/unread-count').then((response) => response.data),
  markRead: (id) => axiosClient.patch(`/api/notifications/${id}/read`).then((response) => response.data),
  markAllRead: () => axiosClient.patch('/api/notifications/read-all').then((response) => response.data),
  emailPreferences: () => axiosClient.get('/api/notifications/preferences').then((response) => response.data),
  updateEmailPreferences: (payload) => axiosClient.patch('/api/notifications/preferences', payload).then((response) => response.data),
};
