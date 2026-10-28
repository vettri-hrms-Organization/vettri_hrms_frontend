import { axiosClient } from '../axiosClient';

export const CUSTOM_FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Dropdown (single choice)' },
  { value: 'MULTISELECT', label: 'Multi-select' },
  { value: 'BOOLEAN', label: 'Yes / No' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
];

export const customFieldsApi = {
  definitions: () => axiosClient.get('/api/custom-fields/definitions').then((res) => res.data),
  createDefinition: (payload) => axiosClient.post('/api/custom-fields/definitions', payload).then((res) => res.data),
  updateDefinition: (id, payload) => axiosClient.put(`/api/custom-fields/definitions/${id}`, payload).then((res) => res.data),
  deleteDefinition: (id) => axiosClient.delete(`/api/custom-fields/definitions/${id}`),
  reorder: (ids) => axiosClient.put('/api/custom-fields/definitions/order', { ids }).then((res) => res.data),
  employeeValues: (employeeId) => axiosClient.get(`/api/custom-fields/employees/${employeeId}`).then((res) => res.data),
  saveEmployeeValues: (employeeId, values) =>
    axiosClient.put(`/api/custom-fields/employees/${employeeId}`, { values }).then((res) => res.data),
  validate: (values) => axiosClient.post('/api/custom-fields/validate', { values }).then((res) => res.data),
  exportValues: () => axiosClient.get('/api/custom-fields/export').then((res) => res.data),
};

/** Display text for a stored value (lists joined, booleans as Yes/No). */
export function formatCustomFieldValue(type, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'MULTISELECT') return Array.isArray(value) && value.length ? value.join(', ') : '—';
  if (type === 'BOOLEAN') return value === true || value === 'true' ? 'Yes' : 'No';
  return String(value);
}

/** Client-side check mirroring the server's required rule; the server validates every type fully. */
export function missingRequired(definitions, values) {
  const errors = {};
  (definitions || []).forEach((definition) => {
    if (!definition.required) return;
    const value = values?.[definition.key];
    const empty = value === undefined || value === null || value === ''
      || (Array.isArray(value) && value.length === 0);
    if (empty && definition.type !== 'BOOLEAN') errors[definition.key] = `${definition.label} is required`;
  });
  return errors;
}
