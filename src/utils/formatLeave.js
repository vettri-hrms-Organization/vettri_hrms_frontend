export const HALF_DAY_SESSION_LABELS = {
  FIRST_HALF: 'First half',
  SECOND_HALF: 'Second half',
};

/** "Half day (First half)" for half-day requests, otherwise "N day(s)". */
export function formatLeaveDuration(request) {
  if (!request) return '';
  if (request.halfDay) {
    const session = HALF_DAY_SESSION_LABELS[request.halfDaySession];
    return session ? `Half day (${session})` : 'Half day';
  }
  return `${request.days} day(s)`;
}
