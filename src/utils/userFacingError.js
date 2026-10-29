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

// Which part of Vettri a request belongs to, so a server error can say what failed
// ("We couldn't load attendance…") instead of a vague "could not complete your request".
const AREAS = [
  [['/api/devices', '/api/monitoring', '/api/agent-tokens', '/api/device-enrollments', '/api/admin/devices'], 'device information'],
  [['/api/software'], 'software'],
  [['/api/attendance', '/api/worksession'], 'attendance'],
  [['/api/leave', '/api/comp-off', '/api/holidays'], 'leave'],
  [['/api/salary', '/api/payroll', '/api/tax-declarations', '/api/settlements'], 'payroll'],
  [['/api/expenses'], 'expenses'],
  [['/api/employees'], 'employee records'],
  [['/api/recruitment', '/api/candidates', '/api/interviews', '/api/requirements'], 'recruitment'],
  [['/api/performance'], 'performance reviews'],
  [['/api/notifications'], 'notifications'],
  [['/api/reports', '/api/executive'], 'reports'],
  [['/api/announcements'], 'announcements'],
  [['/api/documents'], 'documents'],
];

function areaOf(error) {
  let path = requestPath(error);
  const schemeEnd = path.indexOf('://');
  if (schemeEnd >= 0) path = path.slice(path.indexOf('/', schemeEnd + 3) >>> 0);
  const match = AREAS.find(([prefixes]) => prefixes.some((prefix) => path.startsWith(prefix)));
  return match ? match[1] : null;
}

function isRead(error) {
  return !error?.config?.method || String(error.config.method).toLowerCase() === 'get';
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

  if (status === 402) {
    // Subscription inactive (SUBSCRIPTION_INACTIVE): the workspace is read-only.
    return isSafeUserMessage(message)
      ? message
      : 'This workspace is read-only because the subscription is inactive. A company admin can pay under Billing to restore full access.';
  }

  if (status === 403) {
    return vettriMicrocopy.permission.generic;
  }

  if (status === 405) {
    // The app asked for something this server version does not have yet.
    return vettriMicrocopy.error.outdatedServer;
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
    const area = areaOf(error);
    if (!area) return vettriMicrocopy.error.generic;
    return isRead(error)
      ? `We couldn't load ${area} right now. Please try again in a moment.`
      : `We couldn't save your ${area} change right now. Nothing was changed - please try again in a moment.`;
  }

  return isBusinessSafe(message) ? message : vettriMicrocopy.error.request;
}

export function notifyableStatus(error) {
  const status = error?.response?.status;
  return !error?.response || [401, 402, 403, 404, 405, 409, 429].includes(status) || status >= 500;
}
