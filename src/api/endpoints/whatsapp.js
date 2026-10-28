import { axiosClient } from '../axiosClient';

export const WHATSAPP_EVENTS = {
  LEAVE_DECISION: 'Leave approved / rejected',
  PAYSLIP_PUBLISHED: 'Payslip published',
  ANNOUNCEMENT_URGENT: 'Urgent announcements',
  EXPENSE_DECISION: 'Expense claim decisions',
  CHECK_IN_REMINDER: 'Check-in reminder',
};

export const whatsappApi = {
  optIn: () => axiosClient.get('/api/notifications/whatsapp/opt-in').then((res) => res.data),
  updateOptIn: (optIn, phone) =>
    axiosClient.put('/api/notifications/whatsapp/opt-in', { optIn, phone }).then((res) => res.data),
  settings: () => axiosClient.get('/api/notifications/whatsapp/settings').then((res) => res.data),
  updateSettings: (payload) => axiosClient.put('/api/notifications/whatsapp/settings', payload).then((res) => res.data),
  deliveries: () => axiosClient.get('/api/notifications/whatsapp/deliveries').then((res) => res.data),
};
