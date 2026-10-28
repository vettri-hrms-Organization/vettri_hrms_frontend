import { axiosClient } from '../axiosClient';

function form(file) {
  const body = new FormData();
  body.append('file', file);
  return body;
}

function optionParams({ replace, leaveMode } = {}) {
  const params = {};
  if (replace) params.replace = true;
  if (leaveMode) params.leaveMode = leaveMode;
  return params;
}

export const importsApi = {
  types: () => axiosClient.get('/api/imports/types').then((res) => res.data),
  downloadTemplate: (type) => axiosClient.get(`/api/imports/${type}/template`, { responseType: 'blob' }).then((res) => {
    const url = URL.createObjectURL(res.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${type}-import-template.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }),
  preview: (type, file, options) => axiosClient
    .post(`/api/imports/${type}/preview`, form(file), { params: optionParams(options) })
    .then((res) => res.data),
  commit: (type, file, { allOrNothing = false, ...options } = {}) => axiosClient
    .post(`/api/imports/${type}/commit`, form(file), { params: { allOrNothing, ...optionParams(options) } })
    .then((res) => res.data),
  batches: (type, limit = 50) => axiosClient
    .get('/api/imports/batches', { params: { type: type || undefined, limit } })
    .then((res) => res.data),
  batch: (id) => axiosClient.get(`/api/imports/batches/${id}`).then((res) => res.data),
  openingYtd: (fy) => axiosClient.get('/api/imports/opening-ytd', { params: { fy: fy || undefined } }).then((res) => res.data),
  deleteOpeningYtd: (id) => axiosClient.delete(`/api/imports/opening-ytd/${id}`).then((res) => res.data),
};
