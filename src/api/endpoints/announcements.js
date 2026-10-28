import { axiosClient } from '../axiosClient';
import { saveBlob } from './expenses';

export const announcementsApi = {
  feed: () => axiosClient.get('/api/announcements/feed').then((res) => res.data),
  unreadCount: () => axiosClient.get('/api/announcements/unread-count').then((res) => res.data),
  markRead: (id) => axiosClient.post(`/api/announcements/${id}/read`).then((res) => res.data),
  acknowledge: (id) => axiosClient.post(`/api/announcements/${id}/acknowledge`).then((res) => res.data),
  downloadAttachment: (id) => axiosClient
    .get(`/api/announcements/${id}/attachment`, { responseType: 'blob' })
    .then((res) => saveBlob(res, 'attachment')),

  adminList: () => axiosClient.get('/api/announcements/admin').then((res) => res.data),
  create: (payload) => axiosClient.post('/api/announcements/admin', payload).then((res) => res.data),
  update: (id, payload) => axiosClient.put(`/api/announcements/admin/${id}`, payload).then((res) => res.data),
  publish: (id) => axiosClient.post(`/api/announcements/admin/${id}/publish`).then((res) => res.data),
  remove: (id) => axiosClient.delete(`/api/announcements/admin/${id}`),
  uploadAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(`/api/announcements/admin/${id}/attachment`, formData).then((res) => res.data);
  },
  removeAttachment: (id) => axiosClient.delete(`/api/announcements/admin/${id}/attachment`).then((res) => res.data),
  acknowledgements: (id) => axiosClient.get(`/api/announcements/admin/${id}/acknowledgements`).then((res) => res.data),
  exportAcknowledgements: (id) => axiosClient
    .get(`/api/announcements/admin/${id}/acknowledgements/export`, { responseType: 'blob' })
    .then((res) => saveBlob(res, `announcement-${id}-acknowledgements.csv`)),
  remind: (id) => axiosClient.post(`/api/announcements/admin/${id}/remind`).then((res) => res.data),
};
