import { toISTDateInputValue, formatTimeIST } from '../../utils/formatDateTime';

/** yyyy-mm-dd for today in IST. */
export function istToday() {
  return toISTDateInputValue(new Date());
}

/** Adds days to a yyyy-mm-dd string (calendar arithmetic, timezone-free). */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing dateStr. */
export function weekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

export function monthStart(dateStr) {
  return `${dateStr.slice(0, 7)}-01`;
}

/** e.g. "Mon 14" */
export function shortDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return `${date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })} ${d}`;
}

/** e.g. "14 Oct 2026" from yyyy-mm-dd. */
export function formatDay(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** 95 -> "1h 35m"; 0/null -> "—". */
export function formatMinutes(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Times come with a +05:30 offset from the evaluation API. */
export function formatPunch(value) {
  return value ? formatTimeIST(value) : '—';
}

export const DAY_STATUS_VARIANT = {
  PRESENT: 'success',
  HALF_DAY: 'warning',
  ABSENT: 'danger',
  WEEK_OFF: 'neutral',
  HOLIDAY: 'info',
  LEAVE: 'info',
};

export const OT_STATUS_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  PAID: 'info',
};

export function apiError(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}
