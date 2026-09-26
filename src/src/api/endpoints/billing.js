import { axiosClient } from '../axiosClient';

export const billingApi = {
  invoices: ({ status = 'ALL', search = '' } = {}) =>
    axiosClient.get('/api/billing/invoices', { params: { status, ...(search.trim() ? { search: search.trim() } : {}) } }).then((res) => res.data),
  invoice: (id) => axiosClient.get(`/api/billing/invoices/${id}`).then((res) => res.data),
  invoicePdf: (id) => axiosClient.get(`/api/billing/invoices/${id}/pdf`, { responseType: 'blob' }).then((res) => res.data),
  emailInvoice: (id) => axiosClient.post(`/api/billing/invoices/${id}/email`).then((res) => res.data),
};
