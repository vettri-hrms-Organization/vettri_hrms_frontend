import { axiosClient } from '../axiosClient';

/** Employee self-service profile (see ProfileController). Every write returns the refreshed profile. */
export const profileApi = {
  get: (employeeId) => axiosClient.get(`/api/profile/${employeeId}`).then((res) => res.data),
  updateDetails: (employeeId, details) => axiosClient.patch(`/api/profile/${employeeId}/details`, details).then((res) => res.data),
  requestChange: (employeeId, section, values, reason) =>
    axiosClient.post(`/api/profile/${employeeId}/change-requests`, { section, values, reason }).then((res) => res.data),
  withdraw: (employeeId, requestId) =>
    axiosClient.post(`/api/profile/${employeeId}/change-requests/${requestId}/withdraw`).then((res) => res.data),
  saveEntry: (employeeId, kind, entry) => (entry.id
    ? axiosClient.put(`/api/profile/${employeeId}/${kind}/${entry.id}`, entry)
    : axiosClient.post(`/api/profile/${employeeId}/${kind}`, entry)).then((res) => res.data),
  deleteEntry: (employeeId, kind, id) => axiosClient.delete(`/api/profile/${employeeId}/${kind}/${id}`).then((res) => res.data),
  uploadPhoto: (employeeId, image) => axiosClient.put(`/api/profile/${employeeId}/photo`, { image }).then((res) => res.data),
  removePhoto: (employeeId) => axiosClient.delete(`/api/profile/${employeeId}/photo`).then((res) => res.data),
  pendingChanges: () => axiosClient.get('/api/profile/change-requests/pending').then((res) => res.data),
  approveChange: (id, note) => axiosClient.post(`/api/profile/change-requests/${id}/approve`, { note: note || null }).then((res) => res.data),
  rejectChange: (id, note) => axiosClient.post(`/api/profile/change-requests/${id}/reject`, { note }).then((res) => res.data),
};
