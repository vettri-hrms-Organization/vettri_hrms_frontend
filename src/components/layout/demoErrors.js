/** Server message for a failed demo request, or a plain fallback. */
export function userFacingMessage(error) {
  return error?.response?.data?.message || 'Something went wrong. Please try again.';
}

/** Whole days left until an ISO date-time, never below zero. */
export function daysLeft(isoDateTime, now = new Date()) {
  if (!isoDateTime) return null;
  const ms = new Date(isoDateTime).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
