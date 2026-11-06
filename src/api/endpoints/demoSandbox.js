import { axiosClient } from '../axiosClient';

/** Customer demo workspace (see DemoSandboxController on the backend). */
export const demoSandboxApi = {
  status: () => axiosClient.get('/api/demo-sandbox').then((res) => res.data),
  create: () => axiosClient.post('/api/demo-sandbox').then((res) => res.data),
  choose: (choice) => axiosClient.post('/api/demo-sandbox/choice', { choice }).then((res) => res.data),
  current: () => axiosClient.get('/api/demo-sandbox/current').then((res) => res.data),
  session: (role) => axiosClient.post('/api/demo-sandbox/session', { role }).then((res) => res.data),
};
