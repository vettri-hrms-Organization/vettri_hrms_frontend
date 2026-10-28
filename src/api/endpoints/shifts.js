import { axiosClient } from '../axiosClient';

export const shiftsApi = {
  list: () => axiosClient.get('/api/attendance/shifts').then((res) => res.data),
  create: (payload) => axiosClient.post('/api/attendance/shifts', payload).then((res) => res.data),
  update: (id, payload) => axiosClient.put(`/api/attendance/shifts/${id}`, payload).then((res) => res.data),
  remove: (id) => axiosClient.delete(`/api/attendance/shifts/${id}`).then((res) => res.data),
  makeDefault: (id) => axiosClient.post(`/api/attendance/shifts/${id}/default`).then((res) => res.data),
  assignments: () => axiosClient.get('/api/attendance/shifts/assignments').then((res) => res.data),
  saveAssignment: (payload) => axiosClient.post('/api/attendance/shifts/assignments', payload).then((res) => res.data),
  removeAssignment: (id) => axiosClient.delete(`/api/attendance/shifts/assignments/${id}`).then((res) => res.data),
  settings: () => axiosClient.get('/api/attendance/shifts/settings').then((res) => res.data),
  updateSettings: (payload) => axiosClient.put('/api/attendance/shifts/settings', payload).then((res) => res.data),
};

export const rosterApi = {
  get: (from, to, departmentId) => axiosClient
    .get('/api/attendance/roster', { params: { from, to, departmentId: departmentId || undefined } })
    .then((res) => res.data),
  update: (cells) => axiosClient.put('/api/attendance/roster', { cells }).then((res) => res.data),
  copyWeek: (payload) => axiosClient.post('/api/attendance/roster/copy-week', payload).then((res) => res.data),
};

export const dailyAttendanceApi = {
  mine: (from, to) => axiosClient.get('/api/attendance/daily/me', { params: { from, to } }).then((res) => res.data),
  forEmployee: (employeeId, from, to) => axiosClient
    .get(`/api/attendance/daily/employee/${employeeId}`, { params: { from, to } })
    .then((res) => res.data),
  lateEarly: (from, to) => axiosClient.get('/api/attendance/late-early', { params: { from, to } }).then((res) => res.data),
};

export const overtimeApi = {
  mine: () => axiosClient.get('/api/attendance/overtime/mine').then((res) => res.data),
  claim: (date, note) => axiosClient.post('/api/attendance/overtime/claim', { date, note }).then((res) => res.data),
  list: (status, from, to) => axiosClient
    .get('/api/attendance/overtime', { params: { status: status || undefined, from, to } })
    .then((res) => res.data),
  review: (id, approved, approvedMinutes, note) => axiosClient
    .patch(`/api/attendance/overtime/${id}/review`, { approved, approvedMinutes: approvedMinutes || null, note })
    .then((res) => res.data),
  generate: (date) => axiosClient.post('/api/attendance/overtime/generate', null, { params: { date } }).then((res) => res.data),
};
