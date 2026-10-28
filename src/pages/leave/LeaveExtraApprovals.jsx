import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Coins, Gift, X as XIcon } from 'lucide-react';
import { compOffApi, encashmentApi } from '../../api/endpoints/leave';
import Card from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDateIST } from '../../utils/formatDateTime';
import { leaveStatusMeta } from './leaveStatusMeta';

const STATUS_TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: '', label: 'All' },
];

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0');
const inr = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function DecisionDialog({ decision, onClose, onSubmit, pending, noun }) {
  const [note, setNote] = useState('');
  return (
    <Dialog open={!!decision} onClose={onClose} title={decision?.approve ? `Approve ${noun}` : `Reject ${noun}`} description={decision?.employeeName}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(note.trim() || undefined); }}>
        <FormField as="textarea" label={decision?.approve ? 'Note (optional)' : 'Reason'} required={!decision?.approve} rows={3} value={note} onChange={setNote} />
        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={decision?.approve ? 'primary' : 'danger'} loading={pending}>{decision?.approve ? 'Approve' : 'Reject'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function DecideButtons({ row, onDecide, disabled }) {
  return (
    <div className="d-flex justify-content-end gap-2">
      <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" disabled={disabled}
        onClick={() => onDecide({ id: row.id, approve: false, employeeName: row.employeeName })} aria-label={`Reject ${row.employeeName}'s request`}>
        <XIcon size={14} aria-hidden="true" /> Reject
      </button>
      <button type="button" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" disabled={disabled}
        onClick={() => onDecide({ id: row.id, approve: true, employeeName: row.employeeName })} aria-label={`Approve ${row.employeeName}'s request`}>
        <Check size={14} aria-hidden="true" /> Approve
      </button>
    </div>
  );
}

/** Comp-off approvals for LEAVE_APPROVE holders (team-scoped for managers by the backend). */
export function CompOffApprovals() {
  const [status, setStatus] = useState('PENDING');
  const [decision, setDecision] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['comp-off-approvals', status], queryFn: () => compOffApi.approvals(status || undefined) });
  const decide = useMutation({
    mutationFn: ({ id, approve, note }) => (approve ? compOffApi.approve(id, note) : compOffApi.reject(id, note)),
    onSuccess: () => {
      setDecision(null);
      toast.success('Comp-off request updated.');
      queryClient.invalidateQueries({ queryKey: ['comp-off-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['comp-off'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update the comp-off request.'),
  });
  const rows = Array.isArray(data) ? data : [];
  return (
    <Card bodyClassName="p-0">
      <div className="p-3"><Tabs items={STATUS_TABS} value={status} onChange={setStatus} ariaLabel="Comp-off status" /></div>
      {isLoading && <div className="p-4"><SkeletonText lines={4} /></div>}
      {isError && <ErrorState description="Couldn't load comp-off requests." onRetry={refetch} />}
      {!isLoading && !isError && rows.length === 0 && <EmptyState icon={Gift} title={status ? 'Nothing pending' : 'No comp-off requests'} />}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Comp-off approvals">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th className="ps-4">Employee</th><th>Worked on</th><th>Credit</th><th>Attendance</th><th>Status</th><th className="pe-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = leaveStatusMeta(r.status);
                return (
                  <tr key={r.id} style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <td className="ps-4"><Link to={`/employees/${r.employeeId}`} className="text-decoration-none" style={{ fontWeight: 600, color: 'var(--hz-text-primary)' }}>{r.employeeName}</Link><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.departmentName || '—'}</div></td>
                    <td>{formatDateIST(r.workDate)} · {r.dayType === 'HOLIDAY' ? 'Holiday' : 'Weekly off'}<div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.reason}</div></td>
                    <td>{fmt(r.days)} day{r.days === 1 ? '' : 's'}{r.hours ? ` (${fmt(r.hours)} h)` : ''}</td>
                    <td>{r.attendanceVerified === true ? 'Verified' : r.attendanceVerified === false ? 'Not found' : 'No data'}</td>
                    <td><StatusBadge status={r.status} variant={meta.variant} dot>{meta.label}</StatusBadge></td>
                    <td className="pe-4 text-end">{r.status === 'PENDING' && <DecideButtons row={r} onDecide={setDecision} disabled={decide.isPending} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {decision && <DecisionDialog key={`${decision.id}-${decision.approve}`} decision={decision} noun="comp-off" pending={decide.isPending} onClose={() => setDecision(null)} onSubmit={(note) => decide.mutate({ ...decision, note })} />}
    </Card>
  );
}

/** Encashment approvals for HR (organization-scope LEAVE_MANAGE). */
export function EncashmentApprovals() {
  const [status, setStatus] = useState('PENDING');
  const [decision, setDecision] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['leave-encashment-approvals', status], queryFn: () => encashmentApi.list(status || undefined) });
  const decide = useMutation({
    mutationFn: ({ id, approve, note }) => (approve ? encashmentApi.approve(id, note) : encashmentApi.reject(id, note)),
    onSuccess: () => {
      setDecision(null);
      toast.success('Encashment request updated.');
      queryClient.invalidateQueries({ queryKey: ['leave-encashment-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['leave-encashments'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update the encashment request.'),
  });
  const rows = Array.isArray(data) ? data : [];
  return (
    <Card bodyClassName="p-0">
      <div className="p-3"><Tabs items={[...STATUS_TABS.slice(0, 1), { key: 'APPROVED', label: 'Approved (unpaid)' }, ...STATUS_TABS.slice(1)]} value={status} onChange={setStatus} ariaLabel="Encashment status" /></div>
      {isLoading && <div className="p-4"><SkeletonText lines={4} /></div>}
      {isError && <ErrorState description="Couldn't load encashment requests." onRetry={refetch} />}
      {!isLoading && !isError && rows.length === 0 && <EmptyState icon={Coins} title={status === 'PENDING' ? 'Nothing pending' : 'No encashment requests'} />}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Encashment approvals">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th className="ps-4">Employee</th><th>Leave type</th><th className="text-end">Days</th><th className="text-end">Amount</th><th>Status</th><th className="pe-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = leaveStatusMeta(r.status);
                return (
                  <tr key={r.id} style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <td className="ps-4"><Link to={`/employees/${r.employeeId}`} className="text-decoration-none" style={{ fontWeight: 600, color: 'var(--hz-text-primary)' }}>{r.employeeName}</Link><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{formatDateIST(r.createdAt)}</div></td>
                    <td>{r.leaveTypeName} ({r.leaveYear})<div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.reason}</div></td>
                    <td className="text-end">{fmt(r.days)}</td>
                    <td className="text-end">{r.amount !== null && r.amount !== undefined ? inr(r.amount) : <span style={{ color: 'var(--hz-text-muted)' }}>On approval</span>}</td>
                    <td><StatusBadge status={r.status} variant={meta.variant} dot>{meta.label}</StatusBadge></td>
                    <td className="pe-4 text-end">{r.status === 'PENDING' && <DecideButtons row={r} onDecide={setDecision} disabled={decide.isPending} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {decision && <DecisionDialog key={`${decision.id}-${decision.approve}`} decision={decision} noun="encashment" pending={decide.isPending} onClose={() => setDecision(null)} onSubmit={(note) => decide.mutate({ ...decision, note })} />}
    </Card>
  );
}
