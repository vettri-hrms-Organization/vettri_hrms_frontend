import { axiosClient } from '../axiosClient';

/** Loans and salary advances (see LoanController). */
export const loansApi = {
  mine: () => axiosClient.get('/api/loans/me').then((res) => res.data),
  request: (body) => axiosClient.post('/api/loans/me', body).then((res) => res.data),
  cancelMine: (id) => axiosClient.post(`/api/loans/me/${id}/cancel`).then((res) => res.data),
  preview: (amount, months, rate, firstMonth) =>
    axiosClient.get('/api/loans/preview', { params: { amount, months, rate: rate || undefined, firstMonth: firstMonth || undefined } }).then((res) => res.data),
  list: (status) => axiosClient.get('/api/loans', { params: status ? { status } : {} }).then((res) => res.data),
  get: (id) => axiosClient.get(`/api/loans/${id}`).then((res) => res.data),
  create: (body) => axiosClient.post('/api/loans', body).then((res) => res.data),
  approve: (id, body) => axiosClient.post(`/api/loans/${id}/approve`, body).then((res) => res.data),
  reject: (id, note) => axiosClient.post(`/api/loans/${id}/reject`, { note }).then((res) => res.data),
  disburse: (id, body) => axiosClient.post(`/api/loans/${id}/disburse`, body).then((res) => res.data),
  defer: (id, installmentId, note) => axiosClient.post(`/api/loans/${id}/installments/${installmentId}/defer`, { note }).then((res) => res.data),
  payment: (id, body) => axiosClient.post(`/api/loans/${id}/payments`, body).then((res) => res.data),
  cancel: (id, note) => axiosClient.post(`/api/loans/${id}/cancel`, { note }).then((res) => res.data),
};

export const LOAN_STATUS = {
  REQUESTED: { label: 'Requested', variant: 'warning' },
  APPROVED: { label: 'Approved · to be paid out', variant: 'info' },
  ACTIVE: { label: 'Repaying', variant: 'primary' },
  CLOSED: { label: 'Repaid', variant: 'success' },
  REJECTED: { label: 'Declined', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

export const INSTALLMENT_STATUS = {
  PENDING: { label: 'Due', variant: 'neutral' },
  DEDUCTED: { label: 'Deducted from salary', variant: 'success' },
  PAID_MANUALLY: { label: 'Paid directly', variant: 'success' },
  DEFERRED: { label: 'Deferred', variant: 'warning' },
  WAIVED: { label: 'Waived', variant: 'neutral' },
};

export const loanLabel = (type) => (type === 'ADVANCE' ? 'Salary advance' : 'Loan');
export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const monthLabel = (ym) => (ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—');
export const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
