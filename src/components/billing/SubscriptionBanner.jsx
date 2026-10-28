import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { billingApi } from '../../api/endpoints/billing';
import { useAuth } from '../../hooks/useAuth';
import { usePayNow } from './usePayNow';

const TONES = {
  info: { background: 'var(--hz-primary-50, #eef2ff)', border: 'var(--hz-primary-200, #c7d2fe)', color: 'var(--hz-primary-800, #1e3a8a)' },
  warning: { background: 'var(--hz-warning-50, #fffbeb)', border: 'var(--hz-warning-200, #fde68a)', color: 'var(--hz-warning-800, #92400e)' },
  danger: { background: 'var(--hz-danger-50, #fef2f2)', border: 'var(--hz-danger-200, #fecaca)', color: 'var(--hz-danger-800, #991b1b)' },
};

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

/** Describes what the banner should say for a billing status; null = no banner. Exported for tests. */
export function bannerFor(status) {
  if (!status || !status.status) return null;
  const days = status.daysLeft;
  switch (status.status) {
    case 'TRIALING':
    case 'TRIAL':
      if (days == null || days > 14) return null;
      return {
        tone: days <= 3 ? 'warning' : 'info',
        icon: Clock,
        text: days <= 0 ? 'Your free trial ends today.' : `Your free trial ends in ${days} day${days === 1 ? '' : 's'} (${formatDate(status.renewalDate)}).`,
        action: 'Choose a plan',
      };
    case 'PAST_DUE':
      return {
        tone: 'warning',
        icon: AlertTriangle,
        text: `Your subscription payment is overdue. Pay by ${formatDate(status.graceEndsOn)} to avoid the workspace becoming read-only.`,
        action: 'Pay now',
      };
    case 'SUSPENDED':
      return { tone: 'danger', icon: Lock, text: 'This workspace is read-only because the subscription is unpaid. Pay to restore full access.', action: 'Pay to restore' };
    case 'EXPIRED':
      return { tone: 'danger', icon: Lock, text: 'Your free trial has ended and the workspace is read-only. Choose a plan and pay to continue.', action: 'Pay to restore' };
    case 'CANCELLED':
      return { tone: 'danger', icon: Lock, text: 'This subscription has been cancelled and the workspace is read-only.', action: 'Renew' };
    case 'ACTIVE':
      if (status.cancelAtPeriodEnd && days != null && days <= 14) {
        return { tone: 'info', icon: Clock, text: `Your subscription ends on ${formatDate(status.renewalDate)}.`, action: 'Manage' };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Global subscription banner (trial days left / past due / read-only),
 * visible to every signed-in user; only a COMPANY_ADMIN gets the pay action.
 */
export default function SubscriptionBanner() {
  const { isAuthenticated, hasRole } = useAuth();
  const isSuperAdmin = hasRole?.('SUPER_ADMIN');
  const status = useQuery({
    queryKey: ['billing-status'],
    queryFn: billingApi.status,
    enabled: !!isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const { payNow, paying } = usePayNow();
  const { refetch } = status;
  useEffect(() => {
    const onInactive = () => refetch();
    window.addEventListener('vettri:subscription-inactive', onInactive);
    return () => window.removeEventListener('vettri:subscription-inactive', onInactive);
  }, [refetch]);
  const banner = bannerFor(status.data);
  if (!banner) return null;
  const tone = TONES[banner.tone];
  const Icon = banner.icon;
  const canPay = !!status.data?.canPay;
  const hasDueInvoice = !!status.data?.dueInvoiceId;

  return (
    <div
      role={banner.tone === 'danger' ? 'alert' : 'status'}
      className="hz-subscription-banner d-flex align-items-center gap-2 flex-wrap"
      style={{ background: tone.background, borderBottom: `1px solid ${tone.border}`, color: tone.color, padding: '8px 16px', fontSize: 14 }}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="flex-grow-1">{banner.text}{!canPay && !isSuperAdmin && banner.tone !== 'info' ? ' Ask your company admin to complete the payment.' : ''}</span>
      {canPay && (hasDueInvoice || banner.action === 'Pay to restore' || banner.action === 'Pay now') ? (
        <button type="button" className="btn btn-sm btn-primary" onClick={payNow} disabled={paying}>
          {paying ? 'Opening checkout...' : banner.action === 'Choose a plan' ? 'Pay now' : banner.action}
        </button>
      ) : null}
      {canPay || isSuperAdmin ? <Link to="/billing" className="btn btn-sm btn-outline-secondary">Billing</Link> : null}
    </div>
  );
}
