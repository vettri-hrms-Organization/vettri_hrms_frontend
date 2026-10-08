import { vettriMicrocopy } from './vettriMicrocopy.js';

const AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/activate/inspect',
  '/api/auth/activate',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
];

function requestPath(error) {
  return error?.config?.url?.split('?')[0] || '';
}

function rawMessage(error) {
  return String(error?.response?.data?.message || '').trim();
}

function isBusinessSafe(message) {
  return isSafeUserMessage(message)
    && /invitation|employee.*already exists|already registered|subscription is inactive|invoice.*not found|account has been|account is already|email.*verified|plan selection|payment.*unavailable|billing cycle|employee count|permission|access|super admin|company admin|cannot assign|not authorized|role assignment/i.test(message);
}

function containsTechnicalDetail(message) {
  return /(?:exception|stack trace|traceback|sql\b|select\s+.+\s+from|database|postgres(?:ql)?|aws\b|s3\b|axios|http\s?\d{3}|\b[1-5]\d{2}\s+(?:bad gateway|internal server error|service unavailable)\b|java\.|org\.spring|internal server|connection refused|econn(?:refused|reset)|(?:^|\n)\s*at\s+[\w.$]+|[A-Z]:\\|(?:^|\s)\/(?:var|home|usr|etc|opt|app|tmp|srv)\/\S+)/i.test(message);
}

function isSafeUserMessage(message) {
  return Boolean(message)
    && message.length <= 240
    && !/[{}<>]/.test(message)
    && !containsTechnicalDetail(message);
}

export function userFacingError(error) {
  const status = error?.response?.status;
  const message = rawMessage(error);

  if (!error?.response || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return vettriMicrocopy.error.network;
  }

  if (status === 401) {
    if (requestPath(error) === '/api/auth/login') {
      return 'Invalid email, employee ID, or password. Please try again.';
    }
    return AUTH_PATHS.includes(requestPath(error))
      ? (isSafeUserMessage(message) ? message : vettriMicrocopy.error.authentication)
      : vettriMicrocopy.error.sessionExpired;
  }

  if (status === 403) {
    return vettriMicrocopy.permission.generic;
  }

  if (status === 404) {
    return vettriMicrocopy.error.notFound;
  }

  if (status === 409) {
    if (isBusinessSafe(message)) return message;
    return vettriMicrocopy.error.conflict;
  }

  if (status === 400 || status === 422) {
    if (isBusinessSafe(message)) return message;
    return isSafeUserMessage(message) ? message : vettriMicrocopy.error.validation;
  }

  if (status === 429) {
    return vettriMicrocopy.error.rateLimit;
  }

  if (status >= 500) {
    return vettriMicrocopy.error.generic;
  }

  return isBusinessSafe(message) ? message : vettriMicrocopy.error.request;
}

export function notifyableStatus(error) {
  const status = error?.response?.status;
  return !error?.response || [401, 403, 404, 409, 429].includes(status) || status >= 500;
}
