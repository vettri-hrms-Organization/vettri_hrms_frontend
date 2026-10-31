import { axiosClient } from '../axiosClient';

/** Resignation and exit (see ResignationController). */
export const resignationsApi = {
  mine: () => axiosClient.get('/api/resignations/me').then((res) => res.data),
  submit: (body) => axiosClient.post('/api/resignations/me', body).then((res) => res.data),
  withdraw: (id) => axiosClient.post(`/api/resignations/me/${id}/withdraw`).then((res) => res.data),
  exitInterview: (id, answers) => axiosClient.post(`/api/resignations/me/${id}/exit-interview`, answers).then((res) => res.data),
  list: (status) => axiosClient.get('/api/resignations', { params: status ? { status } : {} }).then((res) => res.data),
  pending: () => axiosClient.get('/api/resignations/pending').then((res) => res.data),
  summary: () => axiosClient.get('/api/resignations/summary').then((res) => res.data),
  settings: () => axiosClient.get('/api/resignations/settings').then((res) => res.data),
  updateSettings: (body) => axiosClient.put('/api/resignations/settings', body).then((res) => res.data),
  approve: (id, note, lastWorkingDate) => axiosClient.post(`/api/resignations/${id}/approve`, { note: note || null, lastWorkingDate: lastWorkingDate || null }).then((res) => res.data),
  retain: (id, note) => axiosClient.post(`/api/resignations/${id}/retain`, { note }).then((res) => res.data),
  cancel: (id, note) => axiosClient.post(`/api/resignations/${id}/cancel`, { note }).then((res) => res.data),
};

export const RESIGNATION_STATUS = {
  PENDING_MANAGER: { label: 'With manager', variant: 'warning' },
  PENDING_HR: { label: 'With HR', variant: 'warning' },
  ACCEPTED: { label: 'Accepted', variant: 'info' },
  RETAINED: { label: 'Retained', variant: 'success' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

export const RATING_QUESTIONS = [
  ['role', 'My role and the work I did'],
  ['manager', 'Support from my manager'],
  ['growth', 'Learning and career growth'],
  ['compensation', 'Pay and benefits'],
  ['culture', 'Team and company culture'],
  ['workLife', 'Work-life balance'],
];

export const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
