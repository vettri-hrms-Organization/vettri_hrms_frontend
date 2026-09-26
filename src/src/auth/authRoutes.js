export const PUBLIC_AUTH_ROUTES = Object.freeze([
  '/login',
  '/signup',
  '/activate-account',
  '/reset-password',
  '/verify-email',
]);

const PUBLIC_AUTH_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/activate/inspect',
  '/api/auth/activate',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
]);

const PROTECTED_AUTH_ENDPOINTS = new Set([
  '/api/auth/me',
  '/api/auth/change-password',
]);

function cleanPath(path = '') {
  return path.split('?')[0].replace(/\/$/, '') || '/';
}

export function isPublicAuthRoute(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  return PUBLIC_AUTH_ROUTES.includes(cleanPath(pathname));
}

export function isPublicAuthEndpoint(path) {
  return PUBLIC_AUTH_ENDPOINTS.has(cleanPath(path));
}

export function isAuthenticationEndpoint(path) {
  const normalizedPath = cleanPath(path);
  return isPublicAuthEndpoint(normalizedPath) || PROTECTED_AUTH_ENDPOINTS.has(normalizedPath);
}
