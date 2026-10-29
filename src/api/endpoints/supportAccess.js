import { axiosClient } from '../axiosClient';

/**
 * Customer-controlled Vettri support access. A company admin grants time-limited access
 * (read-only by default); platform staff can only open companies that did.
 */
export const supportAccessApi = {
  status: () => axiosClient.get('/api/support-access/status').then((res) => res.data),
  grant: (payload) => axiosClient.post('/api/support-access', payload).then((res) => res.data),
  revoke: () => axiosClient.delete('/api/support-access').then((res) => res.data),

  // Platform staff (SUPER_ADMIN)
  accessibleCompanies: () => axiosClient.get('/api/admin/support-access/companies').then((res) => res.data),
  openSession: (companyId) => axiosClient.post(`/api/admin/support-access/${companyId}/open`).then((res) => res.data),
  platformOverview: () => axiosClient.get('/api/admin/platform-overview').then((res) => res.data),
};
