import { axiosClient } from '../axiosClient';

export const OWNER_TYPE_LABEL = {
  NEW_HIRE: 'Employee',
  HR: 'HR',
  MANAGER: 'Manager',
  IT: 'IT',
  USER: 'Specific user',
};

export const onboardingApi = {
  templates: () => axiosClient.get('/api/onboarding/templates').then((res) => res.data),
  createTemplate: (payload) => axiosClient.post('/api/onboarding/templates', payload).then((res) => res.data),
  updateTemplate: (id, payload) => axiosClient.put(`/api/onboarding/templates/${id}`, payload).then((res) => res.data),
  deleteTemplate: (id) => axiosClient.delete(`/api/onboarding/templates/${id}`),

  dashboard: () => axiosClient.get('/api/onboarding/dashboard').then((res) => res.data),
  // payload: { employeeId, templateId?, checklistType?, anchorDate? }
  start: (payload) => axiosClient.post('/api/onboarding/checklists', payload).then((res) => res.data),
  cancel: (id) => axiosClient.post(`/api/onboarding/checklists/${id}/cancel`).then((res) => res.data),
  forEmployee: (employeeId) => axiosClient.get(`/api/onboarding/employee/${employeeId}`).then((res) => res.data),
  my: () => axiosClient.get('/api/onboarding/my').then((res) => res.data),
  myTasks: () => axiosClient.get('/api/onboarding/my-tasks').then((res) => res.data),

  complete: (taskId, payload = {}) => axiosClient.post(`/api/onboarding/tasks/${taskId}/complete`, payload).then((res) => res.data),
  reopen: (taskId) => axiosClient.post(`/api/onboarding/tasks/${taskId}/reopen`).then((res) => res.data),
  uploadDocument: (taskId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(`/api/onboarding/tasks/${taskId}/document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },
};
