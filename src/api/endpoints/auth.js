import { axiosClient } from '../axiosClient';

export const authApi = {
  // deviceToken: optional "remember this device" token from an earlier two-factor sign-in.
  login: (username, password, deviceToken) =>
    axiosClient
      .post('/api/auth/login', deviceToken ? { username, password, deviceToken } : { username, password })
      .then((res) => res.data),

  // Two-factor: second login step (public) ...
  verifyMfa: ({ mfaToken, method, code, rememberDevice = false }) =>
    axiosClient.post('/api/auth/mfa/verify', { mfaToken, method, code, rememberDevice }).then((res) => res.data),
  sendMfaEmailCode: (mfaToken) => axiosClient.post('/api/auth/mfa/email/send', { mfaToken }).then((res) => res.data),

  // ... self-service ...
  mfaStatus: () => axiosClient.get('/api/auth/mfa/status').then((res) => res.data),
  enrollTotp: () => axiosClient.post('/api/auth/mfa/totp/enroll').then((res) => res.data),
  confirmTotp: (code) => axiosClient.post('/api/auth/mfa/totp/confirm', { code }).then((res) => res.data),
  sendMfaSetupEmail: () => axiosClient.post('/api/auth/mfa/email/setup/send').then((res) => res.data),
  enableEmailMfa: (code) => axiosClient.post('/api/auth/mfa/email/enable', { code }).then((res) => res.data),
  disableMfa: ({ currentPassword, method, code }) =>
    axiosClient.post('/api/auth/mfa/disable', { currentPassword, method, code }).then((res) => res.data),
  regenerateRecoveryCodes: (currentPassword) =>
    axiosClient.post('/api/auth/mfa/recovery-codes/regenerate', { currentPassword }).then((res) => res.data),
  forgetTrustedDevices: () => axiosClient.delete('/api/auth/mfa/trusted-devices').then((res) => res.data),

  // ... and company admin (COMPANY_ADMIN or USER_MANAGE with organisation scope).
  mfaPolicy: () => axiosClient.get('/api/auth/mfa/policy').then((res) => res.data),
  updateMfaPolicy: (policy) => axiosClient.put('/api/auth/mfa/policy', { policy }).then((res) => res.data),
  resetUserMfa: (userId) => axiosClient.post(`/api/auth/mfa/users/${userId}/reset`).then((res) => res.data),

  logout: (refreshToken) => axiosClient.post('/api/auth/logout', { refreshToken }),

  me: () => axiosClient.get('/api/auth/me').then((res) => res.data),

  changePassword: (currentPassword, newPassword) =>
    axiosClient.post('/api/auth/change-password', { currentPassword, newPassword }).then((res) => res.data),

  inspectInvitation: (token) => axiosClient.get('/api/auth/activate/inspect', { params: { token } }).then((res) => res.data),
  activateAccount: (token, password) => axiosClient.post('/api/auth/activate', { token, password }).then((res) => res.data),
  requestPasswordReset: (identifier) => axiosClient.post('/api/auth/forgot-password', { identifier }),
  resetPassword: (token, password) => axiosClient.post('/api/auth/reset-password', { token, password }).then((res) => res.data),
  verifyEmail: (token) => axiosClient.get('/api/auth/verify-email', { params: { token } }).then((res) => res.data),
};
