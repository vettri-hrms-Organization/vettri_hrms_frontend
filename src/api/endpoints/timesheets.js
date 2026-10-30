import { axiosClient } from '../axiosClient';

/** Timesheets (see TimesheetController). Employee writes return the refreshed week. */
export const timesheetsApi = {
  myWeek: (date) => axiosClient.get('/api/timesheets/me', { params: date ? { date } : {} }).then((res) => res.data),
  saveEntry: (entry) => axiosClient.put('/api/timesheets/me/entries', entry).then((res) => res.data),
  deleteEntry: (id) => axiosClient.delete(`/api/timesheets/me/entries/${id}`).then((res) => res.data),
  submit: (date) => axiosClient.post('/api/timesheets/me/submit', null, { params: { date } }).then((res) => res.data),
  recall: (date) => axiosClient.post('/api/timesheets/me/recall', null, { params: { date } }).then((res) => res.data),
  settings: () => axiosClient.get('/api/timesheets/settings').then((res) => res.data),
  updateSettings: (settings) => axiosClient.put('/api/timesheets/settings', settings).then((res) => res.data),

  approvals: () => axiosClient.get('/api/timesheets/approvals').then((res) => res.data),
  week: (id) => axiosClient.get(`/api/timesheets/weeks/${id}`).then((res) => res.data),
  employeeWeek: (employeeId, date) => axiosClient.get(`/api/timesheets/employees/${employeeId}`, { params: { date } }).then((res) => res.data),
  approve: (id, note) => axiosClient.post(`/api/timesheets/weeks/${id}/approve`, { note: note || null }).then((res) => res.data),
  reject: (id, note) => axiosClient.post(`/api/timesheets/weeks/${id}/reject`, { note }).then((res) => res.data),
  team: (date) => axiosClient.get('/api/timesheets/team', { params: { date } }).then((res) => res.data),
  projectReport: (from, to, projectId) =>
    axiosClient.get('/api/timesheets/reports/projects', { params: { from, to, projectId: projectId ?? undefined } }).then((res) => res.data),

  projects: () => axiosClient.get('/api/timesheets/projects').then((res) => res.data),
  saveProject: (project) => (project.id
    ? axiosClient.put(`/api/timesheets/projects/${project.id}`, project)
    : axiosClient.post('/api/timesheets/projects', project)).then((res) => res.data),
  archiveProject: (id) => axiosClient.post(`/api/timesheets/projects/${id}/archive`).then((res) => res.data),
  restoreProject: (id) => axiosClient.post(`/api/timesheets/projects/${id}/restore`).then((res) => res.data),
  saveTask: (projectId, task) => (task.id
    ? axiosClient.put(`/api/timesheets/projects/${projectId}/tasks/${task.id}`, task)
    : axiosClient.post(`/api/timesheets/projects/${projectId}/tasks`, task)).then((res) => res.data),
};

/** 450 -> "7:30"; 0 -> "". */
export function toHhMm(minutes) {
  if (!minutes) return '';
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 450 -> "7h 30m". */
export function formatHours(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** Accepts "7", "7.5", "7:30", "7h 30m", "45m"; returns minutes, or null when it can't be read. */
export function parseHours(text) {
  const value = String(text ?? '').trim().toLowerCase();
  if (!value) return 0;
  let match = value.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  match = value.match(/^(?:(\d{1,2})\s*h)?\s*(?:(\d{1,3})\s*m)?$/);
  if (match && (match[1] || match[2])) return Number(match[1] || 0) * 60 + Number(match[2] || 0);
  if (/^\d{1,2}(\.\d{1,2})?$/.test(value)) return Math.round(Number(value) * 60);
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s) => new Date(`${s}T00:00:00`);

/** Monday of the week containing the date (local time). */
export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return isoDate(d);
}

export function addDaysIso(iso, days) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export const TIMESHEET_STATUS = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  NOT_STARTED: { label: 'Not started', variant: 'neutral' },
  SUBMITTED: { label: 'Waiting for approval', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Sent back', variant: 'danger' },
};
