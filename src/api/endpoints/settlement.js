import { axiosClient } from '../axiosClient';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Full & Final settlement + gratuity (HR: SALARY_VIEW / SALARY_MANAGE organization scope; employee: /me). */
export const settlementApi = {
  list: () => axiosClient.get('/api/settlements').then((res) => res.data),
  eligible: () => axiosClient.get('/api/settlements/eligible').then((res) => res.data),
  mine: () => axiosClient.get('/api/settlements/me').then((res) => res.data),
  get: (id) => axiosClient.get(`/api/settlements/${id}`).then((res) => res.data),
  create: (payload) => axiosClient.post('/api/settlements', payload).then((res) => res.data),
  update: (id, payload) => axiosClient.put(`/api/settlements/${id}`, payload).then((res) => res.data),
  review: (id) => axiosClient.post(`/api/settlements/${id}/review`).then((res) => res.data),
  reopen: (id) => axiosClient.post(`/api/settlements/${id}/reopen`).then((res) => res.data),
  approve: (id) => axiosClient.post(`/api/settlements/${id}/approve`).then((res) => res.data),
  markPaid: (id, payload) => axiosClient.post(`/api/settlements/${id}/mark-paid`, payload).then((res) => res.data),
  cancel: (id) => axiosClient.delete(`/api/settlements/${id}`),
  downloadStatement: (id, filename = `full-and-final-${id}.pdf`) =>
    axiosClient.get(`/api/settlements/${id}/statement.pdf`, { responseType: 'blob' }).then((res) => saveBlob(res.data, filename)),
  getSettings: () => axiosClient.get('/api/settlements/settings').then((res) => res.data),
  updateSettings: (payload) => axiosClient.put('/api/settlements/settings', payload).then((res) => res.data),
  gratuity: (employeeId) => axiosClient.get(`/api/settlements/gratuity/employee/${employeeId}`).then((res) => res.data),
};

/** Payroll run accounting export + ledger mapping (SALARY_MANAGE organization scope). */
export const accountingApi = {
  getLedgers: () => axiosClient.get('/api/salary/accounting/ledgers').then((res) => res.data),
  updateLedgers: (payload) => axiosClient.put('/api/salary/accounting/ledgers', payload).then((res) => res.data),
  preview: (runId) => axiosClient.get(`/api/salary/accounting/payroll-runs/${runId}/journal`).then((res) => res.data),
  download: (runId, format, filename) =>
    axiosClient
      .get(`/api/salary/accounting/payroll-runs/${runId}/export`, { params: { format }, responseType: 'blob' })
      .then((res) => saveBlob(res.data, filename)),
};

/** Employee work location (drives location-specific holidays). */
export const workLocationApi = {
  get: (employeeId) => axiosClient.get(`/api/employees/${employeeId}/work-location`).then((res) => res.data),
  update: (employeeId, officeLocationId) =>
    axiosClient.put(`/api/employees/${employeeId}/work-location`, { officeLocationId: officeLocationId || null }).then((res) => res.data),
};

/** Holiday calendar with locations / optional holidays and employee picks. */
export const holidayCalendarApi = {
  list: () => axiosClient.get('/api/holidays').then((res) => res.data),
  create: (payload) => axiosClient.post('/api/holidays', payload).then((res) => res.data),
  update: (id, payload) => axiosClient.put(`/api/holidays/${id}`, payload).then((res) => res.data),
  remove: (id) => axiosClient.delete(`/api/holidays/${id}`),
  mine: (year) => axiosClient.get('/api/holidays/me', { params: year ? { year } : {} }).then((res) => res.data),
  forEmployee: (employeeId, year) =>
    axiosClient.get(`/api/holidays/employee/${employeeId}`, { params: year ? { year } : {} }).then((res) => res.data),
  pick: (id) => axiosClient.post(`/api/holidays/${id}/pick`).then((res) => res.data),
  unpick: (id) => axiosClient.delete(`/api/holidays/${id}/pick`).then((res) => res.data),
  getSettings: () => axiosClient.get('/api/holidays/settings').then((res) => res.data),
  updateSettings: (payload) => axiosClient.put('/api/holidays/settings', payload).then((res) => res.data),
};

export function formatINR(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
}
