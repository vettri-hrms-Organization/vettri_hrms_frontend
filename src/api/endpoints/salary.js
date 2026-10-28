import { axiosClient } from '../axiosClient';

export const salaryStructuresApi = {
  getCurrent: (employeeId) => axiosClient.get(`/api/salary/structures/employee/${employeeId}/current`).then((res) => res.data),
  getHistory: (employeeId) => axiosClient.get(`/api/salary/structures/employee/${employeeId}`).then((res) => res.data),
  upsert: (payload) => axiosClient.post('/api/salary/structures', payload).then((res) => res.data),
};

export const employeeSalaryApi = {
  list: ({ search, departmentId, status, sortBy, sortDir, page = 0, size = 10 } = {}) =>
    axiosClient
      .get('/api/salary/employees', { params: { search: search || undefined, departmentId: departmentId || undefined, status: status || undefined, sortBy, sortDir, page, size } })
      .then((res) => res.data),
  getDetail: (employeeId) => axiosClient.get(`/api/salary/employees/${employeeId}`).then((res) => res.data),
};

export const payrollApi = {
  listRuns: () => axiosClient.get('/api/salary/payroll-runs').then((res) => res.data),
  getRun: (runId) => axiosClient.get(`/api/salary/payroll-runs/${runId}`).then((res) => res.data),
  createRun: (payload) => axiosClient.post('/api/salary/payroll-runs', payload).then((res) => res.data),
  setItemHold: (runId, itemId, payload) => axiosClient.patch(`/api/salary/payroll-runs/${runId}/items/${itemId}/hold`, payload).then((res) => res.data),
  process: (runId) => axiosClient.post(`/api/salary/payroll-runs/${runId}/process`).then((res) => res.data),
  markPaid: (runId, payload) => axiosClient.post(`/api/salary/payroll-runs/${runId}/mark-paid`, payload || {}).then((res) => res.data),
  cancel: (runId) => axiosClient.delete(`/api/salary/payroll-runs/${runId}`).then((res) => res.data),
  // Both stream a file (auth header required, so not a plain link) and trigger a browser download.
  downloadPayslipPdf: (itemId, filename = `payslip-${itemId}.pdf`) =>
    axiosClient.get(`/api/salary/payroll-items/${itemId}/payslip.pdf`, { responseType: 'blob' }).then((res) => saveBlob(res.data, filename)),
  downloadBankTransferCsv: (runId, filename = `bank-transfer-${runId}.csv`) =>
    axiosClient.get(`/api/salary/payroll-runs/${runId}/bank-transfer.csv`, { responseType: 'blob' }).then((res) => saveBlob(res.data, filename)),
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const salaryDashboardApi = {
  summary: () => axiosClient.get('/api/salary/dashboard/summary').then((res) => res.data),
};

/** Company PF/ESI/PT/TDS settings (SALARY_MANAGE, organization scope). */
export const statutorySettingsApi = {
  get: () => axiosClient.get('/api/salary/statutory-settings').then((res) => res.data),
  update: (payload) => axiosClient.put('/api/salary/statutory-settings', payload).then((res) => res.data),
};

/** Monthly statutory return files for a payroll run (SALARY_MANAGE, organization scope). */
export const statutoryReturnsApi = {
  summary: (runId) => axiosClient.get(`/api/salary/payroll-runs/${runId}/statutory/summary`).then((res) => res.data),
  download: (runId, kind, filename) =>
    axiosClient
      .get(`/api/salary/payroll-runs/${runId}/statutory/${kind}`, { responseType: 'blob' })
      .then((res) => saveBlob(res.data, filename || kind)),
};

/** Tax regime + investment declarations (fy = FY start year, e.g. 2026 for FY 2026-27) and Form 16 Part B. */
export const taxDeclarationApi = {
  getMine: (fy) => axiosClient.get('/api/salary/tax-declarations/me', { params: { fy } }).then((res) => res.data),
  saveMine: (fy, payload) => axiosClient.put('/api/salary/tax-declarations/me', payload, { params: { fy } }).then((res) => res.data),
  projectMine: (fy) => axiosClient.get('/api/salary/tax-declarations/me/projection', { params: { fy } }).then((res) => res.data),
  list: (fy) => axiosClient.get('/api/salary/tax-declarations', { params: { fy } }).then((res) => res.data),
  getForEmployee: (employeeId, fy) =>
    axiosClient.get(`/api/salary/tax-declarations/employee/${employeeId}`, { params: { fy } }).then((res) => res.data),
  saveForEmployee: (employeeId, fy, payload) =>
    axiosClient.put(`/api/salary/tax-declarations/employee/${employeeId}`, payload, { params: { fy } }).then((res) => res.data),
  projectForEmployee: (employeeId, fy) =>
    axiosClient.get(`/api/salary/tax-declarations/employee/${employeeId}/projection`, { params: { fy } }).then((res) => res.data),
  downloadMyForm16: (fy) =>
    axiosClient.get('/api/salary/form16/me.pdf', { params: { fy }, responseType: 'blob' })
      .then((res) => saveBlob(res.data, `form16-partB-FY${fy}-${String((fy + 1) % 100).padStart(2, '0')}.pdf`)),
  downloadForm16: (employeeId, fy) =>
    axiosClient.get(`/api/salary/form16/employee/${employeeId}/form16.pdf`, { params: { fy }, responseType: 'blob' })
      .then((res) => saveBlob(res.data, `form16-partB-${employeeId}-FY${fy}.pdf`)),
};

/** Current Indian financial year start (Apr-Mar) in IST, e.g. 2026 for 28 Oct 2026. */
export function currentFinancialYear(now = new Date()) {
  const ist = new Date(now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000);
  return ist.getMonth() >= 3 ? ist.getFullYear() : ist.getFullYear() - 1;
}

export function financialYearLabel(fy) {
  return `FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`;
}
