import { axiosClient } from '../axiosClient';

const data = (res) => res.data;

/** Slack/Teams, webhooks and API keys (see IntegrationController). */
export const integrationsApi = {
  chat: () => axiosClient.get('/api/integrations/chat').then(data),
  saveChat: (body) => axiosClient.put('/api/integrations/chat', body).then(data),
  testChat: () => axiosClient.post('/api/integrations/chat/test').then(data),
  webhooks: () => axiosClient.get('/api/integrations/webhooks').then(data),
  createWebhook: (body) => axiosClient.post('/api/integrations/webhooks', body).then(data),
  updateWebhook: (id, body) => axiosClient.put(`/api/integrations/webhooks/${id}`, body).then(data),
  deleteWebhook: (id) => axiosClient.delete(`/api/integrations/webhooks/${id}`).then(data),
  testWebhook: (id) => axiosClient.post(`/api/integrations/webhooks/${id}/test`).then(data),
  keys: () => axiosClient.get('/api/integrations/api-keys').then(data),
  createKey: (body) => axiosClient.post('/api/integrations/api-keys', body).then(data),
  revokeKey: (id) => axiosClient.post(`/api/integrations/api-keys/${id}/revoke`).then(data),
};

/** Personal calendar subscription link. */
export const calendarApi = {
  link: () => axiosClient.get('/api/calendar/link').then(data),
  reset: () => axiosClient.post('/api/calendar/link').then(data),
  remove: () => axiosClient.delete('/api/calendar/link').then(data),
};

/** Custom report builder (see ReportBuilderController). */
export const reportBuilderApi = {
  datasets: () => axiosClient.get('/api/report-builder/datasets').then(data),
  run: (def) => axiosClient.post('/api/report-builder/run', def).then(data),
  export: (def) => axiosClient.post('/api/report-builder/export', def, { responseType: 'blob' }).then(data),
  saved: () => axiosClient.get('/api/report-builder/saved').then(data),
  save: (id, body) => (id ? axiosClient.put(`/api/report-builder/saved/${id}`, body) : axiosClient.post('/api/report-builder/saved', body)).then(data),
  remove: (id) => axiosClient.delete(`/api/report-builder/saved/${id}`).then(data),
};

/** Project billing (see ProjectBillingController). */
export const billingApi = {
  rates: () => axiosClient.get('/api/timesheets/billing/rates').then(data),
  setRates: (projectId, body) => axiosClient.put(`/api/timesheets/billing/rates/${projectId}`, body).then(data),
  preview: (body) => axiosClient.post('/api/timesheets/billing/invoices/preview', body).then(data),
  createInvoice: (body) => axiosClient.post('/api/timesheets/billing/invoices', body).then(data),
  invoices: () => axiosClient.get('/api/timesheets/billing/invoices').then(data),
  setStatus: (id, status) => axiosClient.post(`/api/timesheets/billing/invoices/${id}/status`, { status }).then(data),
  utilization: (from, to) => axiosClient.get('/api/timesheets/billing/utilization', { params: { from, to } }).then(data),
};

/** Absolute URL for a server path, using the API base when the API is on another origin. */
export function absoluteApiUrl(path) {
  const base = axiosClient.defaults.baseURL;
  if (base && /^https?:\/\//.test(base)) return new URL(path, base).toString();
  return new URL(path, window.location.origin).toString();
}

export const EVENT_LABELS = {
  LEAVE_APPROVED: 'Leave approved',
  EMPLOYEE_JOINED: 'New joiner',
  KUDOS_POSTED: 'Public kudos',
  ANNOUNCEMENT_PUBLISHED: 'Announcement published',
  PAYROLL_PROCESSED: 'Payroll processed',
  HELPDESK_TICKET_RAISED: 'Helpdesk ticket raised',
};

export const SCOPE_LABELS = {
  'employees:read': 'Employees',
  'leave:read': 'Approved leave',
  'attendance:read': 'Daily attendance',
  'holidays:read': 'Holidays',
};
