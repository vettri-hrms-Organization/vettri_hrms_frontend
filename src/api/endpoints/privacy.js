import { axiosClient } from '../axiosClient';

/** Public legal document links (marketing site). Kept in sync with app.legal.* on the backend. */
export const LEGAL_LINKS = {
  terms: 'https://vettrihrms.in/terms',
  privacy: 'https://vettrihrms.in/privacy',
  dpa: 'https://vettrihrms.in/dpa',
  refund: 'https://vettrihrms.in/refund-policy',
  security: 'https://vettrihrms.in/security',
};

/** Saves an axios blob response as a file. */
export function saveBlobResponse(response, fallbackName) {
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

export const legalApi = {
  status: () => axiosClient.get('/api/legal/status').then((res) => res.data),
  accept: (documentTypes) => axiosClient.post('/api/legal/accept', { documentTypes }).then((res) => res.data),
  myAcceptances: () => axiosClient.get('/api/legal/acceptances/me').then((res) => res.data),
};

export const privacyApi = {
  contact: () => axiosClient.get('/api/privacy/contact').then((res) => res.data),
  monitoringConsent: () => axiosClient.get('/api/privacy/monitoring-consent').then((res) => res.data),
  grantMonitoringConsent: () => axiosClient.post('/api/privacy/monitoring-consent').then((res) => res.data),
  withdrawMonitoringConsent: (reason) =>
    axiosClient.post('/api/privacy/monitoring-consent/withdraw', { reason }).then((res) => res.data),
  myRequests: () => axiosClient.get('/api/privacy/requests').then((res) => res.data),
  createRequest: (type, details) => axiosClient.post('/api/privacy/requests', { type, details }).then((res) => res.data),
  erasureEligibility: () => axiosClient.get('/api/privacy/requests/erasure-eligibility').then((res) => res.data),
  downloadExport: (id) =>
    axiosClient.get(`/api/privacy/requests/${id}/download`, { responseType: 'blob' })
      .then((res) => saveBlobResponse(res, `my-personal-data-${id}.zip`)),

  // HR / admin
  settings: () => axiosClient.get('/api/privacy/admin/settings').then((res) => res.data),
  updateSettings: (body) => axiosClient.put('/api/privacy/admin/settings', body).then((res) => res.data),
  queue: () => axiosClient.get('/api/privacy/admin/requests').then((res) => res.data),
  updateRequest: (id, status, resolutionNote) =>
    axiosClient.patch(`/api/privacy/admin/requests/${id}`, { status, resolutionNote }).then((res) => res.data),
  requestErasureEligibility: (id) =>
    axiosClient.get(`/api/privacy/admin/requests/${id}/erasure-eligibility`).then((res) => res.data),
  erase: (id) => axiosClient.post(`/api/privacy/admin/requests/${id}/erase`).then((res) => res.data),
  consents: () => axiosClient.get('/api/privacy/admin/consents').then((res) => res.data),
  acceptances: () => axiosClient.get('/api/privacy/admin/acceptances').then((res) => res.data),
  companyExport: () =>
    axiosClient.get('/api/privacy/admin/company-export', { responseType: 'blob' })
      .then((res) => saveBlobResponse(res, 'vettri-company-export.zip')),
  deletionStatus: () =>
    axiosClient.get('/api/privacy/admin/account-deletion').then((res) => (res.status === 204 ? null : res.data)),
  requestDeletion: (reason, confirmCompanyName) =>
    axiosClient.post('/api/privacy/admin/account-deletion', { reason, confirmCompanyName }).then((res) => res.data),
  cancelDeletion: () => axiosClient.delete('/api/privacy/admin/account-deletion').then((res) => res.data),
  allDeletions: () => axiosClient.get('/api/privacy/admin/account-deletions/all').then((res) => res.data),
};
