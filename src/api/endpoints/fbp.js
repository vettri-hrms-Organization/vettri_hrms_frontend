import { axiosClient } from '../axiosClient';

/** Flexible benefit plan (see FbpController). */
export const fbpApi = {
  mine: (fy) => axiosClient.get('/api/fbp/me', { params: fy ? { fy } : {} }).then((res) => res.data),
  declare: (body) => axiosClient.post('/api/fbp/me/declaration', body).then((res) => res.data),
  claim: (body) => axiosClient.post('/api/fbp/me/claims', body).then((res) => res.data),
  components: () => axiosClient.get('/api/fbp/components').then((res) => res.data),
  seedDefaults: () => axiosClient.post('/api/fbp/components/defaults').then((res) => res.data),
  saveComponent: (c) => (c.id ? axiosClient.put(`/api/fbp/components/${c.id}`, c) : axiosClient.post('/api/fbp/components', c)).then((res) => res.data),
  declarations: (status) => axiosClient.get('/api/fbp/declarations', { params: status ? { status } : {} }).then((res) => res.data),
  approveDeclaration: (id, note) => axiosClient.post(`/api/fbp/declarations/${id}/approve`, { note: note || null }).then((res) => res.data),
  rejectDeclaration: (id, note) => axiosClient.post(`/api/fbp/declarations/${id}/reject`, { note }).then((res) => res.data),
  claims: (status) => axiosClient.get('/api/fbp/claims', { params: status ? { status } : {} }).then((res) => res.data),
  approveClaim: (id, note) => axiosClient.post(`/api/fbp/claims/${id}/approve`, { note: note || null }).then((res) => res.data),
  rejectClaim: (id, note) => axiosClient.post(`/api/fbp/claims/${id}/reject`, { note }).then((res) => res.data),
};

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const fyLabel = (fy) => `FY ${fy}-${String(fy + 1).slice(2)}`;
