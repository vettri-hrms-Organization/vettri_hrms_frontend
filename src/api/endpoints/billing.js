import { axiosClient } from '../axiosClient';

export const billingApi = {
  invoices: ({ status = 'ALL', search = '' } = {}) =>
    axiosClient.get('/api/billing/invoices', { params: { status, ...(search.trim() ? { search: search.trim() } : {}) } }).then((res) => res.data),
  invoice: (id) => axiosClient.get(`/api/billing/invoices/${id}`).then((res) => res.data),
  invoicePdf: (id) => axiosClient.get(`/api/billing/invoices/${id}/pdf`, { responseType: 'blob' }).then((res) => res.data),
  emailInvoice: (id) => axiosClient.post(`/api/billing/invoices/${id}/email`).then((res) => res.data),

  // Subscription lifecycle (any signed-in user can read status; changes are COMPANY_ADMIN only)
  // Background check for the subscription banner - never toast on failure.
  status: () => axiosClient.get('/api/billing/status', { _silent: true }).then((res) => res.data),
  subscription: () => axiosClient.get('/api/billing/subscription').then((res) => res.data),
  payNow: () => axiosClient.post('/api/billing/subscription/pay-now', null, { _skipOfflineQueue: true }).then((res) => res.data),
  verifyRenewal: (payload) => axiosClient.post('/api/billing/subscription/verify', payload, { _skipOfflineQueue: true }).then((res) => res.data),
  changePlan: (payload) => axiosClient.post('/api/billing/subscription/change-plan', payload).then((res) => res.data),
  cancelSubscription: () => axiosClient.post('/api/billing/subscription/cancel').then((res) => res.data),
  resumeSubscription: () => axiosClient.post('/api/billing/subscription/resume').then((res) => res.data),
  startAutoDebit: () => axiosClient.post('/api/billing/subscription/auto-debit', null, { _skipOfflineQueue: true }).then((res) => res.data),
  cancelAutoDebit: () => axiosClient.delete('/api/billing/subscription/auto-debit').then((res) => res.data),
  profile: () => axiosClient.get('/api/billing/profile').then((res) => res.data),
  updateProfile: (payload) => axiosClient.put('/api/billing/profile', payload).then((res) => res.data),
};

export const platformBillingApi = {
  companies: () => axiosClient.get('/api/admin/billing/companies').then((res) => res.data),
  extend: (subscriptionId, payload) => axiosClient.post(`/api/admin/billing/subscriptions/${subscriptionId}/extend`, payload).then((res) => res.data),
  suspend: (subscriptionId, payload) => axiosClient.post(`/api/admin/billing/subscriptions/${subscriptionId}/suspend`, payload).then((res) => res.data),
  reactivate: (subscriptionId, payload) => axiosClient.post(`/api/admin/billing/subscriptions/${subscriptionId}/reactivate`, payload).then((res) => res.data),
  creditNote: (invoiceId, payload) => axiosClient.post(`/api/admin/billing/invoices/${invoiceId}/credit-note`, payload).then((res) => res.data),
  runLifecycle: () => axiosClient.post('/api/admin/billing/run-lifecycle').then((res) => res.data),
};

let razorpayLoader = null;

/** Loads Razorpay checkout.js once. */
export function loadRazorpay() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!razorpayLoader) {
    razorpayLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => {
        razorpayLoader = null;
        reject(new Error('Unable to load Razorpay checkout.'));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayLoader;
}
