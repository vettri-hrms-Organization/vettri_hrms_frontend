import { axiosClient } from '../axiosClient';

export const leaveRequestsApi = {
  list: (status) => axiosClient.get('/api/leave-requests', { params: status ? { status } : {} }).then((res) => res.data),
  teamList: (status) => axiosClient.get('/api/leave-requests/team', { params: status ? { status } : {} }).then((res) => res.data),
  byEmployee: (employeeId) => axiosClient.get(`/api/leave-requests/employee/${employeeId}`).then((res) => res.data),
  balance: (employeeId, year) =>
    axiosClient.get(`/api/leave-requests/employee/${employeeId}/balance`, { params: year ? { year } : {} }).then((res) => res.data),
  apply: (payload) => axiosClient.post('/api/leave-requests', payload).then((res) => res.data),
  approve: (id, note) => axiosClient.patch(`/api/leave-requests/${id}/approve`, { note }).then((res) => res.data),
  reject: (id, note) => axiosClient.patch(`/api/leave-requests/${id}/reject`, { note }).then((res) => res.data),
  cancel: (id) => axiosClient.patch(`/api/leave-requests/${id}/cancel`).then((res) => res.data),
};

export const leaveTypesApi = {
  list: () => axiosClient.get('/api/leave-types').then((res) => res.data),
  create: (payload) => axiosClient.post('/api/leave-types', payload).then((res) => res.data),
  update: (id, payload) => axiosClient.put(`/api/leave-types/${id}`, payload).then((res) => res.data),
};

export const holidaysApi = {
  list: () => axiosClient.get('/api/holidays').then((res) => res.data),
  create: (payload) => axiosClient.post('/api/holidays', payload).then((res) => res.data),
  remove: (id) => axiosClient.delete(`/api/holidays/${id}`),
};

// ---- Leave policies (V45): policy per type, ledger, adjustments, year-end, comp-off, encashment ----
export const leavePolicyApi = {
  updatePolicy: (leaveTypeId, payload) => axiosClient.put(`/api/leave-types/${leaveTypeId}/policy`, payload).then((res) => res.data),
  ensureCompOffType: () => axiosClient.post('/api/leave-policy/comp-off-type').then((res) => res.data),
  ledger: (employeeId, year) =>
    axiosClient.get(`/api/leave-policy/ledger/${employeeId}`, { params: year ? { year } : {} }).then((res) => res.data),
  adjust: (payload) => axiosClient.post('/api/leave-policy/adjustments', payload).then((res) => res.data),
  yearEndPreview: (year) => axiosClient.get('/api/leave-policy/year-end', { params: { year } }).then((res) => res.data),
  runYearEnd: (year) => axiosClient.post('/api/leave-policy/year-end/run', null, { params: { year } }).then((res) => res.data),
  runAccruals: () => axiosClient.post('/api/leave-policy/accruals/run').then((res) => res.data),
  finalSettlement: (employeeId) => axiosClient.get(`/api/leave-policy/final-settlement/${employeeId}`).then((res) => res.data),
};

export const compOffApi = {
  apply: (payload) => axiosClient.post('/api/comp-off', payload).then((res) => res.data),
  byEmployee: (employeeId) => axiosClient.get(`/api/comp-off/employee/${employeeId}`).then((res) => res.data),
  approvals: (status) => axiosClient.get('/api/comp-off/approvals', { params: status ? { status } : {} }).then((res) => res.data),
  approve: (id, note) => axiosClient.patch(`/api/comp-off/${id}/approve`, { note }).then((res) => res.data),
  reject: (id, note) => axiosClient.patch(`/api/comp-off/${id}/reject`, { note }).then((res) => res.data),
  cancel: (id) => axiosClient.patch(`/api/comp-off/${id}/cancel`).then((res) => res.data),
};

export const encashmentApi = {
  request: (payload) => axiosClient.post('/api/leave-encashments', payload).then((res) => res.data),
  byEmployee: (employeeId) => axiosClient.get(`/api/leave-encashments/employee/${employeeId}`).then((res) => res.data),
  list: (status) => axiosClient.get('/api/leave-encashments', { params: status ? { status } : {} }).then((res) => res.data),
  approve: (id, note) => axiosClient.patch(`/api/leave-encashments/${id}/approve`, { note }).then((res) => res.data),
  reject: (id, note) => axiosClient.patch(`/api/leave-encashments/${id}/reject`, { note }).then((res) => res.data),
  cancel: (id) => axiosClient.patch(`/api/leave-encashments/${id}/cancel`).then((res) => res.data),
};
