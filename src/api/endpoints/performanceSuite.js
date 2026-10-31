import { axiosClient } from '../axiosClient';

const data = (res) => res.data;
const base = '/api/performance';

/** Review cycles, OKRs, 1:1s, feedback, PIPs and compensation planning (see PerformanceSuiteController). */
export const perfApi = {
  me: () => axiosClient.get(`${base}/me`).then(data),
  people: () => axiosClient.get(`${base}/people`).then(data),

  cycles: () => axiosClient.get(`${base}/cycles`).then(data),
  createCycle: (body) => axiosClient.post(`${base}/cycles`, body).then(data),
  advanceCycle: (id) => axiosClient.post(`${base}/cycles/${id}/advance`).then(data),
  releaseCycle: (id) => axiosClient.post(`${base}/cycles/${id}/release`).then(data),
  participants: (cycleId) => axiosClient.get(`${base}/cycles/${cycleId}/participants`).then(data),
  calibrate: (participantId, finalRating, note) => axiosClient.post(`${base}/participants/${participantId}/calibrate`, { finalRating, note }).then(data),
  addPeers: (participantId, peerIds) => axiosClient.post(`${base}/participants/${participantId}/peers`, peerIds).then(data),
  acknowledgeReview: (participantId) => axiosClient.post(`${base}/participants/${participantId}/acknowledge`).then(data),
  reviewTasks: () => axiosClient.get(`${base}/reviews/tasks`).then(data),
  submitReview: (responseId, body) => axiosClient.post(`${base}/reviews/${responseId}`, body).then(data),
  myReviews: () => axiosClient.get(`${base}/reviews/mine`).then(data),

  okrs: (period) => axiosClient.get(`${base}/okrs`, { params: { period } }).then(data),
  createOkr: (body) => axiosClient.post(`${base}/okrs`, body).then(data),
  updateOkr: (id, body) => axiosClient.put(`${base}/okrs/${id}`, body).then(data),
  okrStatus: (id, status) => axiosClient.post(`${base}/okrs/${id}/status`, { status }).then(data),
  deleteOkr: (id) => axiosClient.delete(`${base}/okrs/${id}`).then(data),
  addKeyResult: (id, body) => axiosClient.post(`${base}/okrs/${id}/key-results`, body).then(data),
  removeKeyResult: (id) => axiosClient.delete(`${base}/key-results/${id}`).then(data),
  checkIn: (id, body) => axiosClient.post(`${base}/key-results/${id}/check-in`, body).then(data),

  meetings: () => axiosClient.get(`${base}/one-on-ones`).then(data),
  scheduleMeeting: (body) => axiosClient.post(`${base}/one-on-ones`, body).then(data),
  updateMeeting: (id, body) => axiosClient.put(`${base}/one-on-ones/${id}`, body).then(data),
  meetingStatus: (id, status) => axiosClient.post(`${base}/one-on-ones/${id}/status`, { status }).then(data),

  giveFeedback: (body) => axiosClient.post(`${base}/feedback`, body).then(data),
  wall: () => axiosClient.get(`${base}/feedback/wall`).then(data),
  received: (employeeId) => axiosClient.get(`${base}/feedback/received`, { params: employeeId ? { employeeId } : {} }).then(data),
  given: () => axiosClient.get(`${base}/feedback/given`).then(data),

  pips: () => axiosClient.get(`${base}/pips`).then(data),
  myPips: () => axiosClient.get(`${base}/pips/mine`).then(data),
  createPip: (body) => axiosClient.post(`${base}/pips`, body).then(data),
  pipCheckIn: (id, body) => axiosClient.post(`${base}/pips/${id}/check-in`, body).then(data),
  closePip: (id, body) => axiosClient.post(`${base}/pips/${id}/close`, body).then(data),
  acknowledgePip: (id) => axiosClient.post(`${base}/pips/${id}/acknowledge`).then(data),

  compRounds: () => axiosClient.get(`${base}/compensation`).then(data),
  compRound: (id) => axiosClient.get(`${base}/compensation/${id}`).then(data),
  createCompRound: (body) => axiosClient.post(`${base}/compensation`, body).then(data),
  regenerateComp: (id, guidelines) => axiosClient.post(`${base}/compensation/${id}/regenerate`, guidelines || null).then(data),
  updateRecommendation: (id, recId, body) => axiosClient.put(`${base}/compensation/${id}/recommendations/${recId}`, body).then(data),
  applyComp: (id) => axiosClient.post(`${base}/compensation/${id}/apply`).then(data),
};

/** Current quarter as "2026-Q4". */
export const currentQuarter = (d = new Date()) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;

export const ratingLabel = (r) => {
  if (r == null) return '—';
  const n = Number(r);
  const word = n >= 4.5 ? 'Outstanding' : n >= 3.5 ? 'Exceeds' : n >= 2.5 ? 'Meets' : n >= 1.5 ? 'Partly meets' : 'Below';
  return `${n.toFixed(1)} · ${word}`;
};

export const errorText = (e, fallback) => e?.response?.data?.message || fallback;
