import { axiosClient } from '../axiosClient';

const data = (res) => res.data;

/** Multi-level approval chains (see ApprovalWorkflowController). */
export const approvalWorkflowApi = {
  get: (module) => axiosClient.get(`/api/approval-workflows/${module}`).then(data),
  save: (module, body) => axiosClient.put(`/api/approval-workflows/${module}`, body).then(data),
};

/** Probation and confirmation (see ProbationController). */
export const probationApi = {
  list: () => axiosClient.get('/api/probation').then(data),
  mine: () => axiosClient.get('/api/probation/me').then(data),
  settings: () => axiosClient.get('/api/probation/settings').then(data),
  saveSettings: (body) => axiosClient.put('/api/probation/settings', body).then(data),
  start: (body) => axiosClient.post('/api/probation', body).then(data),
  recommend: (id, body) => axiosClient.post(`/api/probation/${id}/recommend`, body).then(data),
  decide: (id, body) => axiosClient.post(`/api/probation/${id}/decide`, body).then(data),
};

/** HR helpdesk (see HelpdeskController). */
export const helpdeskApi = {
  categories: () => axiosClient.get('/api/helpdesk/categories').then(data),
  saveCategory: (c) => (c.id ? axiosClient.put(`/api/helpdesk/categories/${c.id}`, c) : axiosClient.post('/api/helpdesk/categories', c)).then(data),
  mine: () => axiosClient.get('/api/helpdesk/tickets/mine').then(data),
  raise: (body) => axiosClient.post('/api/helpdesk/tickets', body).then(data),
  queue: (status) => axiosClient.get('/api/helpdesk/tickets', { params: status ? { status } : {} }).then(data),
  summary: () => axiosClient.get('/api/helpdesk/summary').then(data),
  get: (id) => axiosClient.get(`/api/helpdesk/tickets/${id}`).then(data),
  comment: (id, body) => axiosClient.post(`/api/helpdesk/tickets/${id}/comments`, body).then(data),
  update: (id, body) => axiosClient.patch(`/api/helpdesk/tickets/${id}`, body).then(data),
  rate: (id, body) => axiosClient.post(`/api/helpdesk/tickets/${id}/rate`, body).then(data),
};

/** Click-to-sign (see EsignController). */
export const esignApi = {
  list: () => axiosClient.get('/api/esign').then(data),
  mine: () => axiosClient.get('/api/esign/mine').then(data),
  send: (body) => axiosClient.post('/api/esign', body).then(data),
  document: (id) => axiosClient.get(`/api/esign/${id}/document`, { responseType: 'blob' }).then(data),
  sign: (id, body) => axiosClient.post(`/api/esign/${id}/sign`, body).then(data),
  decline: (id, reason) => axiosClient.post(`/api/esign/${id}/decline`, { reason }).then(data),
  cancel: (id) => axiosClient.post(`/api/esign/${id}/cancel`).then(data),
};

/** Travel requests and advances (see TravelController). */
export const travelApi = {
  mine: () => axiosClient.get('/api/travel/mine').then(data),
  create: (body) => axiosClient.post('/api/travel', body).then(data),
  cancel: (id) => axiosClient.post(`/api/travel/${id}/cancel`).then(data),
  queue: (status) => axiosClient.get('/api/travel', { params: status ? { status } : {} }).then(data),
  decide: (id, approve, note) => axiosClient.post(`/api/travel/${id}/decision`, { approve, note: note || null }).then(data),
  payAdvance: (id, reference) => axiosClient.post(`/api/travel/${id}/advance/pay`, { reference }).then(data),
  settle: (id, body) => axiosClient.post(`/api/travel/${id}/settle`, body).then(data),
};

/** Surveys, polls and eNPS (see SurveyController). */
export const surveyApi = {
  list: () => axiosClient.get('/api/surveys').then(data),
  mine: () => axiosClient.get('/api/surveys/mine').then(data),
  save: (s) => (s.id ? axiosClient.put(`/api/surveys/${s.id}`, s) : axiosClient.post('/api/surveys', s)).then(data),
  remove: (id) => axiosClient.delete(`/api/surveys/${id}`).then(data),
  publish: (id) => axiosClient.post(`/api/surveys/${id}/publish`).then(data),
  close: (id) => axiosClient.post(`/api/surveys/${id}/close`).then(data),
  results: (id) => axiosClient.get(`/api/surveys/${id}/results`).then(data),
  answer: (id, answers) => axiosClient.post(`/api/surveys/${id}/answers`, answers).then(data),
};

export const errorText = (e, fallback) => e?.response?.data?.message || fallback;
export const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
export const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
