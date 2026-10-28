import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { platformBillingApi } from '../../api/endpoints/billing';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';

function inr(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

/** SUPER_ADMIN: every company's plan / status / renewal / MRR with audited extend, suspend and reactivate. */
export default function PlatformBillingPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const companies = useQuery({ queryKey: ['platform-billing'], queryFn: platformBillingApi.companies });
  const [filter, setFilter] = useState('ALL');
  const done = (message) => () => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ['platform-billing'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
  };
  const onError = (error) => toast.error(error.userMessage || error.message || 'Action failed.');
  const extend = useMutation({ mutationFn: ({ id, days, reason }) => platformBillingApi.extend(id, { days, reason }), onSuccess: done('Subscription extended.'), onError });
  const suspend = useMutation({ mutationFn: ({ id, reason }) => platformBillingApi.suspend(id, { reason }), onSuccess: done('Subscription suspended.'), onError });
  const reactivate = useMutation({ mutationFn: ({ id, reason }) => platformBillingApi.reactivate(id, { reason }), onSuccess: done('Subscription reactivated.'), onError });
  const run = useMutation({ mutationFn: platformBillingApi.runLifecycle, onSuccess: (res) => done(`Lifecycle processed ${res.processed} subscription(s).`)(), onError });

  const rows = useMemo(() => (companies.data || []).filter((row) => filter === 'ALL' || row.status === filter), [companies.data, filter]);
  const totalMrr = (companies.data || []).reduce((sum, row) => sum + Number(row.mrr || 0), 0);

  function askReason(action) {
    const reason = window.prompt(`Reason to ${action} (saved in the audit log):`);
    return reason === null ? null : reason.trim();
  }

  return (
    <Card title="Billing overview" subtitle={`Total MRR (ex-GST): ${inr(totalMrr)}`}
      actions={<>
        <select className="form-select form-select-sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
          {['ALL', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT'].map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>)}
        </select>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => run.mutate()} loading={run.isPending}>Run lifecycle</Button>
      </>}>
      {companies.isLoading ? <p className="text-secondary-hz mb-0">Loading billing...</p> : companies.isError ? <p className="text-danger mb-0">Billing overview could not be loaded.</p> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0 hz-table" aria-label="Company billing">
            <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>Renewal</th><th>Seats (paid / active)</th><th className="text-end">MRR</th><th /></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.companyId}>
                <td>{row.companyName}</td>
                <td>{row.plan || '—'}{row.billingCycle ? <small className="d-block text-secondary-hz">{row.billingCycle}{row.autoDebit ? ' · auto-debit' : ''}</small> : null}</td>
                <td><StatusBadge status={row.status} />{row.graceEndsOn && row.status === 'PAST_DUE' ? <small className="d-block text-secondary-hz">grace to {formatDate(row.graceEndsOn)}</small> : null}</td>
                <td>{formatDate(row.renewalDate)}</td>
                <td>{row.paidSeats ?? '—'} / {row.billableSeats}</td>
                <td className="text-end">{inr(row.mrr)}</td>
                <td>{row.subscriptionId ? (
                  <div className="d-flex gap-1 justify-content-end">
                    <Button size="sm" variant="ghost" onClick={() => {
                      const days = Number(window.prompt('Extend by how many days?', '14'));
                      if (!days) return;
                      const reason = askReason('extend');
                      if (reason !== null) extend.mutate({ id: row.subscriptionId, days, reason });
                    }}>Extend</Button>
                    {['SUSPENDED', 'EXPIRED', 'CANCELLED'].includes(row.status)
                      ? <Button size="sm" variant="secondary" onClick={() => { const reason = askReason('reactivate'); if (reason !== null) reactivate.mutate({ id: row.subscriptionId, reason }); }}>Reactivate</Button>
                      : <Button size="sm" variant="ghost" onClick={() => { const reason = askReason('suspend'); if (reason !== null) suspend.mutate({ id: row.subscriptionId, reason }); }}>Suspend</Button>}
                  </div>
                ) : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
