import axios from 'axios';
import { tokenStorage } from '../auth/tokenStorage';
import { tenantStorage } from '../auth/tenantStorage';
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

function resolveQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  pendingQueue = [];
}

function shouldQueueForOfflineRetry(config, status) {
  if (status === 401) return false;
  if (status === 403) return false;
  if (status === 429) return false;
  if (status === 400 || status === 404 || status === 422) return false;
  if (!config || config._queueReplayed || config._skipOfflineQueue) return false;
  return true;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestPath = originalRequest?.url?.split('?')[0];
    const isAuthEndpointWithoutRefresh = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
    ].includes(requestPath);
    const status = error.response?.status;
    const safeMessage = userFacingError(error);
    error.userMessage = safeMessage;
    error.message = safeMessage;
    if (error.response?.data && typeof error.response.data === 'object') {
      error.response.data = { ...error.response.data, message: safeMessage };
    }

    if (status === 401 && !isAuthEndpointWithoutRefresh && !originalRequest?._retry) {
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
        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw error;
        }
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
        const accessToken = data.accessToken || data.token;
        tokenStorage.setTokens(accessToken, data.refreshToken);
        resolveQueue(null, accessToken);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        emitApiError({ message: userFacingError(refreshError), status: 401 });
        setConnectionState(ConnectionState.AUTHENTICATION_REQUIRED);
        tokenStorage.clear();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (!error.response && !originalRequest?._queueReplayed) {
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

    if (status === 403) {
      emitApiError({ message: safeMessage, status });
      setConnectionState(ConnectionState.DISABLED);
      return Promise.reject(error);
    }

    if (status >= 500) {
      emitApiError({ message: safeMessage, status });
      setConnectionState(ConnectionState.OFFLINE);
      const queued = queueRequestForRetry({
        ...originalRequest,
        _queueId: originalRequest?._queueId || `${Date.now()}-${Math.random()}`,
      }, error);
      if (queued) {
        scheduleQueueFlush(axiosClient);
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
