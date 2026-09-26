import { axiosClient, API_BASE_URL } from '../axiosClient';
import { tokenStorage } from '../../auth/tokenStorage';

export const attendanceApi = {
  byDate: (date) => axiosClient.get('/api/attendance', { params: date ? { date } : {} }).then((res) => res.data),
  byEmployee: (employeeId) => axiosClient.get(`/api/attendance/employee/${employeeId}`).then((res) => res.data),
  unmapped: () => axiosClient.get('/api/attendance/unmapped').then((res) => res.data),
  exceptions: (date) => axiosClient.get('/api/attendance/exceptions', { params: date ? { date } : {} }).then((res) => res.data),
  checkIn: (payload) => axiosClient.post('/api/attendance/check-in', payload).then((res) => res.data),
  checkOut: (payload) => axiosClient.post('/api/attendance/check-out', payload).then((res) => res.data),
  today: () => axiosClient.get('/api/attendance/today').then((res) => res.data),
  officeLocations: () => axiosClient.get('/api/attendance/office-locations').then((res) => res.data),
  createOfficeLocation: (payload) => axiosClient.post('/api/attendance/office-locations', payload).then((res) => res.data),
    updateOfficeLocation: (id, payload) => axiosClient.put(`/api/attendance/office-locations/${id}`, payload).then((res) => res.data),
  setOfficeLocationStatus: (id, active) => axiosClient.patch(`/api/attendance/office-locations/${id}/status`, null, { params: { active } }).then((res) => res.data),
    searchOfficeLocations: (query, signal) => axiosClient.get('/api/attendance/geocoding/search', { params: { query }, signal }).then((res) => res.data),
    reverseGeocode: (latitude, longitude, signal) => axiosClient.get('/api/attendance/geocoding/reverse', { params: { latitude, longitude }, signal }).then((res) => res.data),
  team: (date) => axiosClient.get('/api/attendance/team', { params: date ? { date } : {} }).then((res) => res.data),
  myWfh: () => axiosClient.get('/api/attendance/wfh/my').then((res) => res.data),
  teamWfh: () => axiosClient.get('/api/attendance/wfh/team').then((res) => res.data),
  requestWfh: (payload) => axiosClient.post('/api/attendance/wfh/request', payload).then((res) => res.data),
  approveWfh: (id, note) => axiosClient.patch(`/api/attendance/wfh/${id}/approve`, null, { params: note ? { note } : {} }).then((res) => res.data),
  rejectWfh: (id, note) => axiosClient.patch(`/api/attendance/wfh/${id}/reject`, null, { params: note ? { note } : {} }).then((res) => res.data),
  // EventSource can't set an Authorization header, so the access token
  // rides along as a query param for this one connection - see the
  // matching comment in JwtAuthenticationFilter on the backend.
  streamUrl: () => `${API_BASE_URL}/api/attendance/stream?token=${encodeURIComponent(tokenStorage.getAccessToken() || '')}`,
};

export const workSessionApi = {
  start: (workingMode = 'OFFICE') => axiosClient.post('/api/worksession/start', { workingMode }).then((res) => res.data),
  stop: () => axiosClient.post('/api/worksession/stop').then((res) => res.data),
};

export const devicesApi = {
  list: () => axiosClient.get('/api/devices').then((res) => res.data),
  rename: (id, deviceName) => axiosClient.patch(`/api/devices/${id}/rename`, { deviceName }).then((res) => res.data),
};
