import { axiosClient } from '../axiosClient';

export const adminApi = {
  companies: () => axiosClient.get('/api/admin/companies').then((res) => res.data),
  createCompany: (payload) => axiosClient.post('/api/admin/companies', payload).then((res) => res.data),
  updateCompany: (id, payload) => axiosClient.put(`/api/admin/companies/${id}`, payload).then((res) => res.data),
  subscriptions: () => axiosClient.get('/api/admin/subscriptions').then((res) => res.data),
  createSubscription: (companyId, payload) => axiosClient.post(`/api/admin/companies/${companyId}/subscription`, payload).then((res) => res.data),
  updateSubscription: (id, payload) => axiosClient.put(`/api/admin/subscriptions/${id}`, payload).then((res) => res.data),
  // Sales demo workspaces (SUPER_ADMIN). Create/reset return the demo admin credentials once.
  demoCompanies: () => axiosClient.get('/api/admin/demo-companies').then((res) => res.data),
  createDemoCompany: (name) => axiosClient.post('/api/admin/demo-companies', name ? { name } : {}).then((res) => res.data),
  resetDemoCompany: (id) => axiosClient.post(`/api/admin/demo-companies/${id}/reset`).then((res) => res.data),
};
