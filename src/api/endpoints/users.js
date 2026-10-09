import { axiosClient } from '../axiosClient';

export const usersApi = {
  list: () => axiosClient.get('/api/users').then((res) => res.data),
  create: (payload) => axiosClient.post('/api/users', payload).then((res) => res.data),
  activate: (id) => axiosClient.patch(`/api/users/${id}/activate`).then((res) => res.data),
  deactivate: (id) => axiosClient.patch(`/api/users/${id}/deactivate`).then((res) => res.data),
  assignRoles: (id, roleNames) => axiosClient.put(`/api/users/${id}/roles`, roleNames).then((res) => res.data),
  permissionGrants: (id) => axiosClient.get(`/api/users/${id}/permission-grants`).then((res) => res.data),
  grantPermission: (id, payload) => axiosClient.post(`/api/users/${id}/permission-grants`, payload).then((res) => res.data),
  revokePermission: (id, grantId) => axiosClient.delete(`/api/users/${id}/permission-grants/${grantId}`).then((res) => res.data),
};
