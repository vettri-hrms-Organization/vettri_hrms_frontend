import Badge from './Badge';

// Keys are normalised (upper case, spaces/hyphens -> underscores) so that the
// backend's Title Case employee statuses ("On Leave", "Notice Period") match
// the same entries as enum-style values (ON_LEAVE). Anything unlisted falls
// back to neutral; the text label always carries the meaning, colour only
// reinforces it.
const STATUS_VARIANTS = {
  // Success: done, healthy, approved
  ACTIVE: 'success',
  APPROVED: 'success',
  COMPLETED: 'success',
  PRESENT: 'success',
  PAID: 'success',
  CAPTURED: 'success',
  VERIFIED: 'success',
  CONNECTED: 'success',
  INSTALLED: 'success',
  INSTALLATION_COMPLETED: 'success',
  ALREADY_INSTALLED: 'success',
  READY: 'success',
  HIRED: 'success',
  SELECTED: 'success',
  ONLINE: 'success',

  // Warning: waiting on someone or in flight
  PENDING: 'warning',
  INVITED: 'warning',
  PROCESSING: 'warning',
  ON_LEAVE: 'warning',
  PENDING_PAYMENT: 'warning',
  PAST_DUE: 'warning',
  QUEUED: 'warning',
  REQUESTED: 'warning',
  CONNECTING: 'warning',
  RUNNING: 'warning',
  DOWNLOADING: 'warning',
  INSTALLING: 'warning',
  VERIFYING: 'warning',
  IN_PROGRESS: 'warning',
  HALF_DAY: 'warning',
  LATE: 'warning',
  ON_HOLD: 'warning',

  // Info: informational state, not a problem
  INTERVIEW: 'info',
  SCHEDULED: 'info',
  NOTICE_PERIOD: 'info',
  TRIAL: 'info',
  TRIALING: 'info',
  OPEN: 'info',
  OFFERED: 'info',
  SHORTLISTED: 'info',
  WFH: 'info',

  // Neutral: closed, inactive or historical
  DRAFT: 'neutral',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
  CANCELLED: 'neutral',
  CLOSED: 'neutral',
  DISCONNECTED: 'neutral',
  DISABLED: 'neutral',
  RESIGNED: 'neutral',
  REFUNDED: 'neutral',
  USED: 'neutral',
  OFFLINE: 'neutral',

  // Danger: failed, refused or needs fixing
  REJECTED: 'danger',
  FAILED: 'danger',
  ABSENT: 'danger',
  TERMINATED: 'danger',
  EXPIRED: 'danger',
  REVOKED: 'danger',
  SUSPENDED: 'danger',
  TIMEOUT: 'danger',
  DEVICE_OFFLINE: 'danger',
  NOT_INSTALLED: 'danger',
};

export function normalizeStatusKey(status) {
  return String(status ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function statusVariant(status) {
  return STATUS_VARIANTS[normalizeStatusKey(status)] || 'neutral';
}

export function formatStatusLabel(status) {
  return String(status ?? 'UNKNOWN').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StatusBadge({ status, variant, dot = true, children, ...rest }) {
  const safeStatus = status ?? 'UNKNOWN';
  return <Badge variant={variant || statusVariant(safeStatus)} dot={dot} {...rest}>{children ?? formatStatusLabel(safeStatus)}</Badge>;
}
