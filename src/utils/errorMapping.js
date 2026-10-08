import { vettriMicrocopy } from './vettriMicrocopy.js';

/**
 * mapLoginError
 * Converts backend API errors into user-friendly messages
 * Never exposes technical details (stack traces, SQL errors, JWT exceptions, etc)
 * Maps to clear, actionable messages that help users understand what went wrong
 */
export function mapLoginError(error, step = 'login') {
  // Handle network errors
  if (error.message === 'Network Error' || !error.response) {
    return vettriMicrocopy.error.network;
  }

  const status = error.response?.status;
  const data = error.response?.data;
  const message = data?.message || '';

  // 401 - Unauthorized (wrong credentials, account issues)
  if (status === 401) {
    if (message.includes('account') || message.includes('Account')) {
      if (message.includes('not activated') || message.includes('not active')) {
        return 'Your account has not been activated yet. Please check your email for an activation link.';
      }
      if (message.includes('disabled') || message.includes('inactive')) {
        return 'Your account has been deactivated. Contact your HR administrator.';
      }
      if (message.includes('suspended')) {
        return 'Your account has been suspended. Contact your HR administrator.';
      }
    }
    if (message.includes('password')) {
      return 'Invalid password. Please try again.';
    }
    if (message.includes('not found') || message.includes('does not exist')) {
      return 'No account found with this email or employee ID.';
    }
    // Default unauthorized message
    return 'Invalid email/employee ID or password.';
  }

  // 400 - Bad request
  if (status === 400) {
    if (message.includes('identifier') || message.includes('email') || message.includes('username')) {
      return 'Please enter a valid email address or employee ID.';
    }
    if (message.includes('password')) {
      return 'Please enter your password.';
    }
    return 'Please check your input and try again.';
  }

  // 403 - Forbidden (permission issues)
  if (status === 403) {
    if (message.includes('workspace') || message.includes('tenant')) {
      return 'You are not authorized to access this workspace.';
    }
    if (message.includes('permission')) {
      return 'Your account does not have permission to access VETTRI HRMS.';
    }
    return vettriMicrocopy.permission.generic;
  }

  // 429 - Too many attempts
  if (status === 429) {
    return 'Too many login attempts. Please try again in a few minutes.';
  }

  // 500+ - Server errors
  if (status >= 500) {
    return vettriMicrocopy.error.generic;
  }

  // Fallback
  return vettriMicrocopy.error.request;
}

/**
 * mapIdentifierError
 * Specific error handling for the identifier/username step
 */
export function mapIdentifierError(error) {
  if (!error?.response || error?.message === 'Network Error') {
    return vettriMicrocopy.error.network;
  }

  const status = error.response?.status;
  const message = error.response?.data?.message || '';

  if (status === 400 || status === 422) {
    return 'Please enter a valid email address or employee ID.';
  }

  if (status === 404 || message.includes('not found')) {
    return 'No account found with this identifier.';
  }

  if (status === 401) {
    return 'This account cannot access VETTRI HRMS.';
  }

  if (status >= 500) {
    return vettriMicrocopy.error.generic;
  }

  return vettriMicrocopy.error.request;
}

/**
 * mapPasswordError
 * Specific error handling for the password step
 */
export function mapPasswordError(error) {
  if (!error?.response || error?.message === 'Network Error') {
    return vettriMicrocopy.error.network;
  }

  const status = error.response?.status;
  const message = error.response?.data?.message || '';

  if (status === 401) {
    if (message.includes('password') || message.includes('credentials')) {
      return 'Invalid password. Please try again.';
    }
    if (message.includes('account') || message.includes('inactive')) {
      return 'Your account is no longer active. Contact your HR administrator.';
    }
    return 'Invalid credentials. Please try again.';
  }

  if (status === 403) {
    return vettriMicrocopy.permission.generic;
  }

  if (status === 429) {
    return 'Too many login attempts. Please try again in a few minutes.';
  }

  if (status >= 500) {
    return vettriMicrocopy.error.generic;
  }

  return vettriMicrocopy.error.request;
}
