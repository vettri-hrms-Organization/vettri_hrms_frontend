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
  return /invitation|employee.*already exists|already registered|subscription is inactive|invoice.*not found|account has been|account is already|email.*verified|plan selection|payment.*unavailable|billing cycle|employee count|permission|access|super admin|company admin|cannot assign|not authorized|role assignment/i.test(message);
}

export function userFacingError(error) {
  const status = error?.response?.status;
  const message = rawMessage(error);

  if (!error?.response || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Connection Problem: We could not connect to Vettri right now. Please check your internet connection and try again.';
  }

  if (status === 401) {
    if (requestPath(error) === '/api/auth/login') {
      return 'Invalid email, employee ID, or password. Please try again.';
    }
    return AUTH_PATHS.includes(requestPath(error))
      ? (message || 'Authentication could not be completed. Please try again.')
      : 'Session Expired: Your session has expired. Please sign in again to continue.';
  }

  if (status === 403) {
    if (message && isBusinessSafe(message)) return message;
    return "Access Restricted: You don't have permission to access this page or perform this action. Please contact your HR/Admin if you need access.";
  }

  if (status === 404) {
    return "Not Found: We couldn't find the requested information. It may have been removed or you may no longer have access to it.";
  }

  if (status === 409) {
    if (isBusinessSafe(message)) return message;
    return 'Already Exists: This information is already registered. Please use a different value.';
  }

  if (status === 400 || status === 422) {
    if (isBusinessSafe(message)) return message;
    if (message) return message;
    return 'Please check the highlighted fields and try again.';
  }

  if (status === 429) {
    return 'Too Many Requests: Please wait a moment and try again.';
  }

  if (status >= 500) {
    return "Something Went Wrong: We couldn't complete your request right now. Please try again in a moment.";
  }

  return message && isBusinessSafe(message) ? message : 'We could not complete your request. Please try again.';
}

export function notifyableStatus(error) {
  const status = error?.response?.status;
  return !error?.response || [401, 403, 404, 409, 429].includes(status) || status >= 500;
}
