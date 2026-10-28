import { axiosClient } from '../axiosClient';

export const LETTER_TYPE_LABEL = {
  OFFER: 'Offer',
  APPOINTMENT: 'Appointment',
  CONFIRMATION: 'Confirmation',
  SALARY_REVISION: 'Salary revision',
  EXPERIENCE: 'Experience',
  RELIEVING: 'Relieving',
  EMPLOYMENT_VERIFICATION: 'Employment verification',
  CUSTOM: 'Custom',
};

export const lettersApi = {
  templates: () => axiosClient.get('/api/letters/templates').then((res) => res.data),
  offerTemplates: () => axiosClient.get('/api/letters/offer-templates').then((res) => res.data),
  createTemplate: (payload) => axiosClient.post('/api/letters/templates', payload).then((res) => res.data),
  updateTemplate: (id, payload) => axiosClient.put(`/api/letters/templates/${id}`, payload).then((res) => res.data),
  deleteTemplate: (id) => axiosClient.delete(`/api/letters/templates/${id}`),
  placeholders: () => axiosClient.get('/api/letters/placeholders').then((res) => res.data),

  letterhead: () => axiosClient.get('/api/letters/letterhead').then((res) => res.data),
  updateLetterhead: (payload) => axiosClient.put('/api/letters/letterhead', payload).then((res) => res.data),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/api/letters/letterhead/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },
  removeLogo: () => axiosClient.delete('/api/letters/letterhead/logo').then((res) => res.data),
  logo: () => axiosClient.get('/api/letters/letterhead/logo', { responseType: 'blob' }),

  // payload: { templateId, employeeId, customFields, title?, sendEmail? }
  preview: (payload) => axiosClient.post('/api/letters/preview', payload).then((res) => res.data),
  generate: (payload) => axiosClient.post('/api/letters/generate', payload).then((res) => res.data),
  recent: () => axiosClient.get('/api/letters').then((res) => res.data),
  my: () => axiosClient.get('/api/letters/my').then((res) => res.data),
  forEmployee: (employeeId) => axiosClient.get(`/api/letters/employee/${employeeId}`).then((res) => res.data),
  download: (id) => axiosClient.get(`/api/letters/${id}/download`, { responseType: 'blob' }),
  email: (id) => axiosClient.post(`/api/letters/${id}/email`).then((res) => res.data),

  // Candidate offer letters (recruitment)
  previewOffer: (candidateId, payload) => axiosClient.post(`/api/letters/candidates/${candidateId}/offer-letter/preview`, payload).then((res) => res.data),
  generateOffer: (candidateId, payload) => axiosClient.post(`/api/letters/candidates/${candidateId}/offer-letter`, payload).then((res) => res.data),
  forCandidate: (candidateId) => axiosClient.get(`/api/letters/candidates/${candidateId}`).then((res) => res.data),
};

/** Saves a blob response (from download()) as a file. */
export function saveBlobResponse(response, fallbackName = 'letter.pdf') {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : fallbackName;
  link.click();
  window.URL.revokeObjectURL(url);
}

/** Backend validation messages for letters/onboarding are written for end users; show them as-is. */
export function apiMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || fallback;
}

/** Placeholders found in a template body, in order. */
export function placeholdersIn(body) {
  const names = [];
  const re = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body || '')) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

export function customFieldsIn(body) {
  return placeholdersIn(body).filter((n) => n.startsWith('custom.')).map((n) => n.slice('custom.'.length));
}

/** Client-side preview with sample values (the server renders the real letter). */
export const SAMPLE_VALUES = {
  'employee.fullName': 'Priya Sharma',
  'employee.firstName': 'Priya',
  'employee.code': 'EMP0042',
  'employee.email': 'priya.sharma@example.com',
  'employee.designation': 'Senior Accountant',
  'employee.department': 'Finance',
  'employee.dateOfJoining': '01 April 2024',
  'employee.lastWorkingDate': '30 September 2026',
  'employee.address': '12, 3rd Cross, Indiranagar, Bengaluru 560038',
  'company.name': 'Your Company Pvt Ltd',
  'company.address': 'Company address',
  'salary.annualCtc': 'INR 9,60,000.00',
  'salary.monthlyGross': 'INR 80,000.00',
  today: '28 October 2026',
  'signatory.name': 'Signatory name',
  'signatory.designation': 'HR Manager',
  'candidate.fullName': 'Rahul Verma',
  'candidate.firstName': 'Rahul',
  'candidate.email': 'rahul@example.com',
  'candidate.position': 'Software Engineer',
  'candidate.department': 'Engineering',
  'candidate.offerAmount': 'INR 12,00,000.00',
  'candidate.joiningDate': '15 November 2026',
};

export function renderSample(body, overrides = {}) {
  const values = { ...SAMPLE_VALUES, ...overrides };
  return (body || '').replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (whole, name) => {
    if (name.startsWith('custom.')) return `[${name.slice(7)}]`;
    return values[name] ?? `[unknown: ${name}]`;
  });
}
