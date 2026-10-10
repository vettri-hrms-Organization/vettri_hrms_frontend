import { axiosClient } from '../axiosClient';

export const auditApi = {
  logs: ({ page = 0, size = 50, entityName } = {}) =>
    axiosClient.get('/api/audit/logs', {
      params: { page, size, ...(entityName ? { entityName } : {}) },
    }).then((response) => response.data),
};
