import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Pencil, Trash2, Send, Eye } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { expensesApi } from '../../api/endpoints/expenses';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateIST } from '../../utils/formatDateTime';
import ClaimEditor from './ClaimEditor';
import ClaimDetail from './ClaimDetail';
import { apiErrorMessage, expenseStatusMeta } from './expenseMeta';

export default function MyExpenses() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | claim
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: claims, isLoading, isError, refetch } = useQuery({ queryKey: ['expense-claims-my'], queryFn: expensesApi.myClaims });
  const { data: settings } = useQuery({ queryKey: ['expense-settings'], queryFn: expensesApi.settings, retry: false });
  const list = Array.isArray(claims) ? claims : [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['expense-claims-my'] });

  const submit = useMutation({
    mutationFn: (id) => expensesApi.submit(id),
    onSuccess: (claim) => {
      invalidate();
      toast.success(claim.policyIssues?.length ? `Submitted with ${claim.policyIssues.length} policy note(s).` : 'Claim submitted for approval.');
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not submit the claim.')),
  });

  const remove = useMutation({
    mutationFn: (id) => expensesApi.remove(id),
    onSuccess: () => { setDeleting(null); invalidate(); toast.success('Draft deleted.'); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not delete the draft.')),
  });

  const sum = (statuses) => list.filter((claim) => statuses.includes(claim.status)).reduce((total, claim) => total + Number(claim.totalAmount || 0), 0);

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="My workspace"
        title="My expenses"
        description={settings?.reimbursementMode === 'PAYROLL'
          ? 'Claim business expenses. Approved claims are paid with your salary.'
          : 'Claim business expenses. Approved claims are reimbursed by finance.'}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>New claim</Button>}
      />

      {!isLoading && !isError && list.length > 0 && (
        <div className="hz-inline-summary" aria-label="Expense summary">
          <div className="hz-inline-summary__item hz-inline-summary__item--warning"><strong>{formatCurrency(sum(['SUBMITTED', 'MANAGER_APPROVED']))}</strong><span>In approval</span></div>
          <div className="hz-inline-summary__item hz-inline-summary__item--neutral"><strong>{formatCurrency(sum(['APPROVED']))}</strong><span>Approved, awaiting payment</span></div>
          <div className="hz-inline-summary__item hz-inline-summary__item--success"><strong>{formatCurrency(sum(['REIMBURSED']))}</strong><span>Reimbursed</span></div>
        </div>
      )}

      <Card bodyClassName="p-0">
        {isLoading && <div className="p-4"><SkeletonText lines={5} /></div>}
        {isError && <ErrorState description="Couldn't load your expense claims." onRetry={refetch} />}
        {!isLoading && !isError && list.length === 0 && (
          <EmptyState icon={Receipt} title="No expense claims yet" description="Create a claim for travel, food, stay, mileage and other business expenses." action={<Button icon={Plus} onClick={() => setEditing('new')}>New claim</Button>} />
        )}
        {!isLoading && !isError && list.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="My expense claims">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th className="ps-4">Claim</th>
                  <th>Lines</th>
                  <th className="text-end">Total</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="pe-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((claim) => {
                  const meta = expenseStatusMeta(claim.status);
                  const isDraft = claim.status === 'DRAFT';
                  return (
                    <tr key={claim.id}>
                      <td className="ps-4">
                        <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{claim.title}</div>
                        {claim.status === 'REJECTED' && claim.rejectionReason && <div style={{ fontSize: 12, color: 'var(--hz-danger-600)' }}>Reason: {claim.rejectionReason}</div>}
                      </td>
                      <td style={{ fontSize: 'var(--hz-text-sm)' }}>{claim.lines?.length || 0}</td>
                      <td className="text-end" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{formatCurrency(claim.totalAmount)}</td>
                      <td><StatusBadge status={claim.status} variant={meta.variant}>{meta.label}</StatusBadge></td>
                      <td style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{formatDateIST(claim.reimbursedAt || claim.rejectedAt || claim.approvedAt || claim.submittedAt || claim.createdAt)}</td>
                      <td className="pe-4 text-end">
                        <div className="d-flex justify-content-end gap-2">
                          {isDraft ? (
                            <>
                              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(claim)} aria-label={`Edit ${claim.title}`}>Edit</Button>
                              <Button size="sm" variant="secondary" icon={Trash2} onClick={() => setDeleting(claim)} aria-label={`Delete ${claim.title}`}>Delete</Button>
                              <Button size="sm" icon={Send} loading={submit.isPending && submit.variables === claim.id} onClick={() => submit.mutate(claim.id)} aria-label={`Submit ${claim.title}`}>Submit</Button>
                            </>
                          ) : (
                            <Button size="sm" variant="secondary" icon={Eye} onClick={() => setViewing(claim)} aria-label={`View ${claim.title}`}>View</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <ClaimEditor claim={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} size="lg" title="Expense claim">
        <ClaimDetail claim={viewing} />
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete draft claim?"
        description={deleting ? `"${deleting.title}" and its lines will be removed.` : ''}
        confirmLabel="Delete draft"
        irreversible
      />
    </div>
  );
}
