import { axiosClient } from '../axiosClient';

/** Home page data gathered from every module for the signed-in person (see HomeController). */
export const homeApi = {
  todos: () => axiosClient.get('/api/home/todos').then((res) => res.data),
  today: () => axiosClient.get('/api/home/today').then((res) => res.data),
  setup: () => axiosClient.get('/api/home/setup').then((res) => res.data),
};

/** Opens the Ask Vettri panel from anywhere (the top bar listens for this event). */
export function askVettri(query = '') {
  window.dispatchEvent(new CustomEvent('vettri:ask', { detail: { query } }));
}
