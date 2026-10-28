import axios from 'axios';
import { tokenStorage } from '../auth/tokenStorage';
import { tenantStorage } from '../auth/tenantStorage';
import { isAuthenticationEndpoint, isPublicAuthEndpoint, isPublicAuthRoute } from '../auth/authRoutes';
import { notifyableStatus, userFacingError } from '../utils/userFacingError';
import {
  ConnectionState,
  flushQueuedRequests,
  getConnectionState,
  queueRequestForRetry,
  readQueue,
  scheduleQueueFlush,
  setConnectionState,
  setConnectedStatus,
} from '../utils/offlineRequestQueue';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.vettrihrms.in';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {},
});

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

function emitApiError(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vettri:api-error', { detail }));
  }
}

axiosClient.interceptors.request.use((config) => {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isFormData) {
    config._skipOfflineQueue = true;
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const path = config.url || '';
  const isCompanyIndependent = path.includes('/api/auth/') || path.startsWith('/api/admin/') || path.startsWith('/api/careers/');
  const selectedCompanyId = tenantStorage.getSelectedCompanyId();
  if (selectedCompanyId && !isCompanyIndependent) {
    config.headers['X-Company-Id'] = selectedCompanyId;
  }
  if (config._queueReplayed) {
    config.headers = { ...config.headers };
  }
  return config;
});

// Queues concurrent requests that 401'd while a single refresh is in
// flight, instead of firing one refresh call per failed request.
let isRefreshing = false;
let pendingQueue = [];
let sessionExpirationHandled = false;

export function resetSessionExpirationHandling() {
  sessionExpirationHandled = false;
  pendingQueue = [];
  isRefreshing = false;
}

function clearAuthenticationState() {
  tokenStorage.clear();
  tenantStorage.clear();
}

function handleSessionExpiration(error, options = {}) {
  const { suppressToast = false } = options;

  if (isPublicAuthRoute()) {
    clearAuthenticationState();
    resetSessionExpirationHandling();
    return;
  }

  if (sessionExpirationHandled) return;

  sessionExpirationHandled = true;
  setConnectionState(ConnectionState.AUTHENTICATION_REQUIRED);
  clearAuthenticationState();

  if (!suppressToast && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vettri:session-expired', {
      detail: { message: userFacingError(error) },
    }));
  }
}

function resolveQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  pendingQueue = [];
}

/**
 * Refresh tokens rotate on every use and the old one is revoked, while all tabs
 * share localStorage. Without coordination two tabs refresh with the same token,
 * the loser gets a 401 and logs everybody out. So refreshes are serialised with a
 * cross-tab lock, and a tab that finds the token already rotated just reuses it.
 */
async function refreshAcrossTabs(startingRefreshToken, originalError, usedAccessToken) {
  const run = async () => {
    const current = tokenStorage.getRefreshToken();
    const stored = tokenStorage.getAccessToken();
    if (stored && usedAccessToken && stored !== usedAccessToken) {
      return stored;
    }
    if (current && current !== startingRefreshToken && stored) {
      return tokenStorage.getAccessToken();
    }
    if (!current) {
      throw originalError;
    }
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken: current });
      const accessToken = data.accessToken || data.token;
      tokenStorage.setTokens(accessToken, data.refreshToken);
      return accessToken;
    } catch (refreshError) {
      // Another tab without lock support may have rotated it in the meantime.
      const latest = tokenStorage.getRefreshToken();
      if (latest && latest !== current && tokenStorage.getAccessToken()) {
        return tokenStorage.getAccessToken();
      }
      throw refreshError;
    }
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('vettri-token-refresh', run);
  }
  return run();
}

function shouldQueueForOfflineRetry(config, status) {
  if (!config || config._queueReplayed || config._skipOfflineQueue) return false;
  // Only transient failures are worth retrying; every 4xx (incl. 409 conflicts) is final.
  return status == null || status >= 500;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestPath = originalRequest?.url?.split('?')[0];
    const isPublicAuthRequest = isPublicAuthEndpoint(requestPath);
    const isPublicRoute = isPublicAuthRoute();
    const status = error.response?.status;
    const safeMessage = userFacingError(error);
    error.userMessage = safeMessage;
    error.message = safeMessage;
    if (error.response?.data && typeof error.response.data === 'object') {
      error.apiMessage = String(error.response.data.message || '').trim() || null;
      error.response.data = { ...error.response.data, message: safeMessage };
    }

    // A stale token can be present while a public auth page is bootstrapping.
    // Clear it, but keep the page clean and let the page's own error handling
    // decide what to show for the auth request.
    if (status === 401 && (isPublicRoute || isPublicAuthRequest)) {
      clearAuthenticationState();
      resetSessionExpirationHandling();
      return Promise.reject(error);
    }

    if (status === 401 && !isPublicAuthRequest && !originalRequest?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest._retry = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const usedHeader = String(originalRequest.headers?.Authorization || '');
        const accessToken = await refreshAcrossTabs(tokenStorage.getRefreshToken(), error, usedHeader.replace(/^Bearer\s+/i, ''));
        resetSessionExpirationHandling();
        resolveQueue(null, accessToken);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        handleSessionExpiration(refreshError, { suppressToast: isPublicAuthRoute() || isPublicAuthEndpoint(requestPath) });
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 401 && !isPublicAuthRequest) {
      handleSessionExpiration(error);
      return Promise.reject(error);
    }

    // Background requests (banners, badges, optional widgets) handle their own failure quietly:
    // no toast, no "offline" state, no retry queue.
    if (originalRequest?._silent) {
      return Promise.reject(error);
    }

    if (!error.response && !originalRequest?._queueReplayed) {
      if (isAuthenticationEndpoint(requestPath)) {
        return Promise.reject(error);
      }
      emitApiError({ message: safeMessage, status: null });
      setConnectedStatus(false);
      if (originalRequest?._skipOfflineQueue) {
        return Promise.reject(error);
      }
      const queued = queueRequestForRetry({
        ...originalRequest,
        _queueId: originalRequest?._queueId || `${Date.now()}-${Math.random()}`,
      }, error);
      if (queued) {
        scheduleQueueFlush(axiosClient);
      }
      return Promise.reject(error);
    }

    if (shouldQueueForOfflineRetry(originalRequest, status)) {
      if (notifyableStatus(error)) {
        emitApiError({ message: safeMessage, status });
      }
      setConnectionState(status === 429 ? ConnectionState.CONNECTING : status >= 500 ? ConnectionState.OFFLINE : getConnectionState());
      const queued = queueRequestForRetry({
        ...originalRequest,
        _queueId: originalRequest?._queueId || `${Date.now()}-${Math.random()}`,
      }, error);
      if (queued) {
        scheduleQueueFlush(axiosClient);
      }
      return Promise.reject(error);
    }

    // 402 = subscription inactive (workspace read-only). Show one friendly toast and
    // let the subscription banner refresh; never queue or retry the write.
    if (status === 402) {
      emitApiError({ message: safeMessage, status });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vettri:subscription-inactive', { detail: { message: safeMessage } }));
      }
      return Promise.reject(error);
    }

    // A 403 means "not allowed", not "connection broken", so the connection
    // state is left alone. Only a refused action (POST/PUT/PATCH/DELETE) is
    // surfaced as a toast; a refused read is a background permission probe
    // that the page already handles with its own empty/denied state.
    if (status === 403) {
      const method = String(originalRequest?.method || 'get').toLowerCase();
      if (method !== 'get' && method !== 'head') {
        emitApiError({ message: safeMessage, status });
      }
      return Promise.reject(error);
    }

    if (status >= 500) {
      emitApiError({ message: safeMessage, status });
      setConnectionState(ConnectionState.OFFLINE);
      if (!originalRequest?._skipOfflineQueue) {
        const queued = queueRequestForRetry({
          ...originalRequest,
          _queueId: originalRequest?._queueId || `${Date.now()}-${Math.random()}`,
        }, error);
        if (queued) {
          scheduleQueueFlush(axiosClient);
        }
      }
      return Promise.reject(error);
    }

    if (notifyableStatus(error)) {
      emitApiError({ message: safeMessage, status });
    }
    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setConnectedStatus(true);
    flushQueuedRequests(axiosClient).catch(() => undefined);
  });
  window.addEventListener('offline', () => {
    setConnectedStatus(false);
  });
  if (readQueue().length) {
    scheduleQueueFlush(axiosClient);
  }
}

export { getConnectionState, ConnectionState };
