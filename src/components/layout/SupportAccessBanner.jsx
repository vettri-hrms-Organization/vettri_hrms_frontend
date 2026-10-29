import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { supportAccessApi } from '../../api/endpoints/supportAccess';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTimeIST } from '../../utils/formatDateTime';

/**
 * Always-visible notice while Vettri support can see this workspace:
 * company users see who allowed it and until when; platform staff see which company they are in.
 */
export default function SupportAccessBanner() {
  const { user, hasRole, selectedCompanyId, setSelectedCompanyId } = useAuth();
  const isPlatformAdmin = hasRole('SUPER_ADMIN');
  const enabled = Boolean(user) && (!isPlatformAdmin || Boolean(selectedCompanyId));
  const { data } = useQuery({
    queryKey: ['support-access-status', selectedCompanyId || 'own'],
    queryFn: supportAccessApi.status,
    enabled,
    refetchInterval: 60_000,
    retry: false,
  });

  if (!enabled) return null;
  if (isPlatformAdmin) {
    return (
      <div role="status" className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2 mx-3 mt-2" style={{ borderRadius: 12, background: 'var(--hz-warning-50)', color: 'var(--hz-warning-600)', fontSize: 14, fontWeight: 600 }}>
        <span className="d-flex align-items-center gap-2">
          <LifeBuoy size={16} aria-hidden="true" />
          {data?.active
            ? `Support session: ${data.accessLevel === 'FULL' ? 'full' : 'read-only'} access until ${formatDateTimeIST(data.expiresAt)}. Every action is in the company's audit log.`
            : 'Demo workspace - opened by platform staff.'}
        </span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedCompanyId(null)}>Leave company</button>
      </div>
    );
  }
  if (!data?.active) return null;
  return (
    <div role="status" className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2 mx-3 mt-2" style={{ borderRadius: 12, background: 'var(--hz-warning-50)', color: 'var(--hz-warning-600)', fontSize: 14, fontWeight: 600 }}>
      <span className="d-flex align-items-center gap-2">
        <LifeBuoy size={16} aria-hidden="true" />
        Vettri support has {data.accessLevel === 'FULL' ? 'full' : 'read-only'} access to this workspace until {formatDateTimeIST(data.expiresAt)}
        {data.grantedByName ? ` (allowed by ${data.grantedByName})` : ''}.
      </span>
      <Link to="/settings/privacy?tab=support" className="btn btn-sm btn-outline-secondary">Manage</Link>
    </div>
  );
}
