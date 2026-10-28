import { axiosClient } from '../axiosClient';

/** Saves a blob response as a file (receipts, CSV exports). */
export function saveBlob(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match ? match[1] : fallbackName;
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const expensesApi = {
  categories: (includeInactive = false) => axiosClient
    .get('/api/expenses/categories', { params: includeInactive ? { includeInactive: true } : {} })
    .then((res) => res.data),
  createCategory: (payload) => axiosClient.post('/api/expenses/categories', payload).then((res) => res.data),
  updateCategory: (id, payload) => axiosClient.put(`/api/expenses/categories/${id}`, payload).then((res) => res.data),
  settings: () => axiosClient.get('/api/expenses/settings').then((res) => res.data),
  updateSettings: (payload) => axiosClient.put('/api/expenses/settings', payload).then((res) => res.data),

  myClaims: () => axiosClient.get('/api/expenses/claims/my').then((res) => res.data),
  get: (id) => axiosClient.get(`/api/expenses/claims/${id}`).then((res) => res.data),
  create: (payload) => axiosClient.post('/api/expenses/claims', payload).then((res) => res.data),
  update: (id, payload) => axiosClient.put(`/api/expenses/claims/${id}`, payload).then((res) => res.data),
  remove: (id) => axiosClient.delete(`/api/expenses/claims/${id}`),
  submit: (id) => axiosClient.post(`/api/expenses/claims/${id}/submit`).then((res) => res.data),
  uploadReceipt: (id, lineId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(`/api/expenses/claims/${id}/lines/${lineId}/receipt`, formData).then((res) => res.data);
  },
  removeReceipt: (id, lineId) => axiosClient.delete(`/api/expenses/claims/${id}/lines/${lineId}/receipt`).then((res) => res.data),
  downloadReceipt: (id, lineId) => axiosClient
    .get(`/api/expenses/claims/${id}/lines/${lineId}/receipt`, { responseType: 'blob' })
    .then((res) => saveBlob(res, 'receipt')),

  managerQueue: () => axiosClient.get('/api/expenses/approvals/manager').then((res) => res.data),
  financeQueue: () => axiosClient.get('/api/expenses/approvals/finance').then((res) => res.data),
  managerApprove: (id, note) => axiosClient.post(`/api/expenses/claims/${id}/manager-approve`, { note }).then((res) => res.data),
  approve: (id, note) => axiosClient.post(`/api/expenses/claims/${id}/approve`, { note }).then((res) => res.data),
  reject: (id, reason) => axiosClient.post(`/api/expenses/claims/${id}/reject`, { reason }).then((res) => res.data),
  reimburse: (id, paymentReference) => axiosClient
    .post(`/api/expenses/claims/${id}/reimburse`, { paymentReference })
    .then((res) => res.data),

  list: (filters = {}) => axiosClient.get('/api/expenses/claims', { params: cleanParams(filters) }).then((res) => res.data),
  exportCsv: (filters = {}) => axiosClient
    .get('/api/expenses/claims/export', { params: cleanParams(filters), responseType: 'blob' })
    .then((res) => saveBlob(res, 'expense-claims.csv')),
};

function cleanParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}
