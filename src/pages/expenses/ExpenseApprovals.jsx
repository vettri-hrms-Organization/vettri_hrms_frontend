import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X as XIcon, Eye, Download, Banknote, Receipt } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import Tabs from '../../components/ui/Tabs';
import FilterBar from '../../components/ui/FilterBar';
import StatusBadge from '../../components/ui/StatusBadge';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { expensesApi } from '../../api/endpoints/expenses';
import { departmentsApi } from '../../api/endpoints/organization';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateIST } from '../../utils/formatDateTime';
import ClaimDetail from './ClaimDetail';
import { apiErrorMessage, expenseStatusMeta, EXPENSE_STATUS_OPTIONS } from './expenseMeta';

const ACTIONS = {
  'manager-approve': { title: 'Approve claim', field: 'Note for the employee (optional)', required: false, cta: 'Approve', variant: 'primary' },
  approve: { title: 'Final approval', field: 'Approval note (optional)', required: false, cta: 'Approve for payment', variant: 'primary' },
  reject: { title: 'Reject claim', field: 'Rejection reason', required: true, cta: 'Reject claim', variant: 'danger' },
  reimburse: { title: 'Mark as reimbursed', field: 'Payment reference (UTR / cheque / transaction id)', required: true, cta: 'Mark reimbursed', variant: 'primary' },
};

export default function ExpenseApprovals() {
  const { hasPermission } = useAuth();
  const isFinance = hasPermission('EXPENSE_MANAGE');
  const canManagerReview = hasPermission('EXPENSE_APPROVE') || isFinance;
  const tabs = [
    canManagerReview && { key: 'manager', label: 'Manager approvals' },
    isFinance && { key: 'finance', label: 'Finance' },
    isFinance && { key: 'all', label: 'All claims' },
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.key || 'manager');
  const [viewing, setViewing] = useState(null);
  const [action, setAction] = useState(null); // { type, claim }
  const [text, setText] = useState('');
  const [filters, setFilters] = useState({ from: '', to: '', status: '', departmentId: '' });
  const toast = useToast();
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ['expense-approvals', tab, tab === 'all' ? filters : null],
    queryFn: () => (tab === 'manager' ? expensesApi.managerQueue() : tab === 'finance' ? expensesApi.financeQueue() : expensesApi.list(filters)),
    enabled: tabs.length > 0,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
    enabled: tab === 'all',
    retry: false,
  });
  const claims = Array.isArray(queue.data) ? queue.data : [];

  const financeGroups = useMemo(() => ({
    review: claims.filter((claim) => claim.status !== 'APPROVED'),
    payout: claims.filter((claim) => claim.status === 'APPROVED'),
  }), [claims]);

  const decide = useMutation({
    mutationFn: ({ type, claim, value }) => {
      if (type === 'manager-approve') return expensesApi.managerApprove(claim.id, value || null);
      if (type === 'approve') return expensesApi.approve(claim.id, value || null);
      if (type === 'reject') return expensesApi.reject(claim.id, value);
      return expensesApi.reimburse(claim.id, value);
    },
    onSuccess: () => {
      toast.success('Claim updated.');
      setAction(null);
      setText('');
      queryClient.invalidateQueries({ queryKey: ['expense-approvals'] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the claim.')),
  });

  const open = (type, claim) => { setAction({ type, claim }); setText(''); };
  const config = action ? ACTIONS[action.type] : null;

  const exportCsv = async () => {
    try {
      await expensesApi.exportCsv(filters);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not export claims.'));
    }
  };

  const actionsFor = (claim) => {
    const buttons = [<Button key="view" size="sm" variant="secondary" icon={Eye} onClick={() => setViewing(claim)} aria-label={`View ${claim.title}`}>View</Button>];
    if (tab === 'manager' && claim.status === 'SUBMITTED') {
      buttons.push(<Button key="reject" size="sm" variant="secondary" icon={XIcon} onClick={() => open('reject', claim)}>Reject</Button>);
      buttons.push(<Button key="approve" size="sm" icon={Check} onClick={() => open('manager-approve', claim)}>Approve</Button>);
    }
    if (tab === 'finance') {
      if (claim.status === 'MANAGER_APPROVED' || claim.status === 'SUBMITTED') {
        buttons.push(<Button key="reject" size="sm" variant="secondary" icon={XIcon} onClick={() => open('reject', claim)}>Reject</Button>);
        buttons.push(<Button key="approve" size="sm" icon={Check} onClick={() => open('approve', claim)}>Approve</Button>);
      }
      if (claim.status === 'APPROVED') {
        buttons.push(<Button key="reject" size="sm" variant="secondary" icon={XIcon} onClick={() => open('reject', claim)}>Reject</Button>);
        buttons.push(<Button key="pay" size="sm" icon={Banknote} onClick={() => open('reimburse', claim)}>Mark reimbursed</Button>);
      }
    }
    return <div className="d-flex justify-content-end gap-2 flex-wrap">{buttons}</div>;
  };

  if (tabs.length === 0) {
    return <EmptyState icon={Receipt} title="No approval access" description="You don't have permission to review expense claims." />;
  }

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Expenses"
        title="Expense approvals"
        description="Review team claims, give final approval, and record reimbursements"
        actions={tab === 'all' ? <Button variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button> : null}
      />

      <FilterBar className="justify-content-between flex-wrap gap-2">
        <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Expense approval queues" />
        {tab === 'all' && (
          <div className="d-flex gap-2 flex-wrap align-items-end">
            <label className="d-flex flex-column" style={{ fontSize: 12 }}>From<input type="date" className="form-control form-control-sm" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
            <label className="d-flex flex-column" style={{ fontSize: 12 }}>To<input type="date" className="form-control form-control-sm" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
            <label className="d-flex flex-column" style={{ fontSize: 12 }}>Status
              <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="">All (excl. drafts)</option>
                {EXPENSE_STATUS_OPTIONS.filter((option) => option.value !== 'DRAFT').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="d-flex flex-column" style={{ fontSize: 12 }}>Department
              <select className="form-select form-select-sm" value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}>
                <option value="">All departments</option>
                {(Array.isArray(departments) ? departments : []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
          </div>
        )}
      </FilterBar>

      {queue.isLoading && <Card><SkeletonText lines={6} /></Card>}
      {queue.isError && <Card><ErrorState description="Couldn't load expense claims." onRetry={queue.refetch} /></Card>}
      {!queue.isLoading && !queue.isError && (
        tab === 'finance' ? (
          <>
            <ClaimTable title="Awaiting final approval" claims={financeGroups.review} actionsFor={actionsFor} emptyText="Nothing waiting for final approval." />
            <ClaimTable title="Approved – awaiting reimbursement" claims={financeGroups.payout} actionsFor={actionsFor} emptyText="No approved claims are waiting to be paid." />
          </>
        ) : (
          <ClaimTable claims={claims} actionsFor={actionsFor} emptyText={tab === 'manager' ? 'No claims from your team are waiting for you.' : 'No claims match these filters.'} />
        )
      )}

      <Dialog open={!!viewing} onClose={() => setViewing(null)} size="lg" title="Expense claim">
        <ClaimDetail claim={viewing} showEmployee />
      </Dialog>

      <Dialog open={!!action} onClose={() => setAction(null)} title={config?.title} description={action ? `${action.claim.employeeName} · ${action.claim.title} · ${formatCurrency(action.claim.totalAmount)}` : ''}>
        {action && (
          <form onSubmit={(event) => { event.preventDefault(); decide.mutate({ ...action, value: text.trim() }); }}>
            {action.claim.policyIssues?.length > 0 && (
              <div className="alert alert-warning py-2" style={{ fontSize: 'var(--hz-text-sm)' }}>
                {action.claim.policyIssues.map((issue, index) => <div key={index}>{issue.message}</div>)}
              </div>
            )}
            <FormField as={action.type === 'reimburse' ? 'input' : 'textarea'} rows={3} label={config.field} required={config.required} value={text} onChange={setText} maxLength={action.type === 'reimburse' ? 120 : 500} />
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
              <Button type="submit" variant={config.variant} loading={decide.isPending} disabled={config.required && !text.trim()}>{config.cta}</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function ClaimTable({ title, claims, actionsFor, emptyText }) {
  return (
    <Card title={title} bodyClassName="p-0">
      {claims.length === 0 ? (
        <EmptyState icon={Receipt} title="All clear" description={emptyText} />
      ) : (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label={title || 'Expense claims'}>
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th className="ps-4">Employee</th>
                <th>Claim</th>
                <th className="text-end">Total</th>
                <th>Status</th>
                <th>Submitted</th>
                <th className="pe-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => {
                const meta = expenseStatusMeta(claim.status);
                return (
                  <tr key={claim.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <Avatar name={claim.employeeName} size="sm" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{claim.employeeName}</div>
                          <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{claim.departmentName || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>
                      {claim.title}
                      {claim.policyIssues?.length > 0 && <div style={{ fontSize: 12, color: 'var(--hz-warning-600, #b45309)' }}>{claim.policyIssues.length} policy note(s)</div>}
                    </td>
                    <td className="text-end" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{formatCurrency(claim.totalAmount)}</td>
                    <td><StatusBadge status={claim.status} variant={meta.variant}>{meta.label}</StatusBadge></td>
                    <td style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{formatDateIST(claim.submittedAt)}</td>
                    <td className="pe-4 text-end">{actionsFor(claim)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
