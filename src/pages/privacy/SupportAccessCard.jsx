import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, ShieldCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { supportAccessApi } from '../../api/endpoints/supportAccess';
import { formatDateTimeIST } from '../../utils/formatDateTime';

const DURATIONS = [1, 4, 24, 72];

/** Company admin control: Vettri support can only open this workspace while access is allowed here. */
export default function SupportAccessCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [hours, setHours] = useState(4);
  const [level, setLevel] = useState('READ_ONLY');
  const [reason, setReason] = useState('');
  const status = useQuery({ queryKey: ['support-access-status', 'own'], queryFn: supportAccessApi.status });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['support-access-status'] });
  const grant = useMutation({
    mutationFn: () => supportAccessApi.grant({ hours, accessLevel: level, reason: reason.trim() || null }),
    onSuccess: () => { toast.success('Vettri support access allowed'); setReason(''); refresh(); },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not allow support access'),
  });
  const revoke = useMutation({
    mutationFn: supportAccessApi.revoke,
    onSuccess: () => { toast.success('Vettri support access removed'); refresh(); },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not remove support access'),
  });
  const current = status.data;

  return (
    <Card title="Vettri support access" subtitle="Vettri staff cannot see your employees, salaries or attendance unless you allow it here.">
      <div className="d-flex flex-column gap-4">
        <div className="d-flex align-items-start gap-3 p-3" style={{ borderRadius: 12, background: current?.active ? 'var(--hz-warning-50)' : 'var(--hz-success-50)' }}>
          {current?.active ? <LifeBuoy size={22} color="var(--hz-warning-600)" aria-hidden="true" /> : <ShieldCheck size={22} color="var(--hz-success-600)" aria-hidden="true" />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>
              {current?.active
                ? `Support has ${current.accessLevel === 'FULL' ? 'full' : 'read-only'} access until ${formatDateTimeIST(current.expiresAt)}`
                : 'Support access is off. Your data is private to your company.'}
            </div>
            {current?.active && (
              <div style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>
                Allowed by {current.grantedByName || 'an administrator'}{current.reason ? ` · ${current.reason}` : ''}. Every support action is recorded in your Audit Logs.
              </div>
            )}
          </div>
          {current?.active && <Button variant="danger" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate()}>Remove access now</Button>}
        </div>

        <form className="row g-3 align-items-end" onSubmit={(event) => { event.preventDefault(); grant.mutate(); }}>
          <div className="col-12 col-md-3">
            <label className="form-label mb-1" htmlFor="support-hours">Allow for</label>
            <select id="support-hours" className="form-select" value={hours} onChange={(event) => setHours(Number(event.target.value))}>
              {DURATIONS.map((value) => <option key={value} value={value}>{value === 1 ? '1 hour' : value < 24 ? `${value} hours` : `${value / 24} day${value === 24 ? '' : 's'}`}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label mb-1" htmlFor="support-level">Access</label>
            <select id="support-level" className="form-select" value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="READ_ONLY">View only (recommended)</option>
              <option value="FULL">View and fix</option>
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label mb-1" htmlFor="support-reason">Reason (optional)</label>
            <input id="support-reason" className="form-control" maxLength={500} placeholder="e.g. Payroll for October looks wrong" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="col-12 col-md-2 d-grid">
            <Button type="submit" loading={grant.isPending}>{current?.active ? 'Replace' : 'Allow'}</Button>
          </div>
        </form>
        <p className="mb-0" style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>
          Access ends automatically at the time shown. While it is on, everyone in your company sees a notice at the top of the app.
        </p>
      </div>
    </Card>
  );
}
