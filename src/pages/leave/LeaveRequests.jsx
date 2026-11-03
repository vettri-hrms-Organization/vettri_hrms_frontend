import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { CalendarPlus, Check, X as XIcon, Calendar } from 'lucide-react';
import { exportToCsv } from '../../utils/exportToCsv';
import { formatDateIST, toISTDateInputValue } from '../../utils/formatDateTime';
import { leaveRequestsApi } from '../../api/endpoints/leave';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import ApplyLeaveModal from './ApplyLeaveModal';
import { leaveStatusMeta } from './leaveStatusMeta';
import { formatLeaveDuration } from '../../utils/formatLeave';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import PageHeader from '../../components/ui/PageHeader';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import Tabs from '../../components/ui/Tabs';
import { CompOffApprovals, EncashmentApprovals } from './LeaveExtraApprovals';

const TABS = [
  { key: 'PENDING', label: 'Pending Approval' },
  { key: '', label: 'All Requests' },
];

/** One CSV row of the leave register export (dates in IST). */
function toLeaveExportRow(r) {
  const meta = leaveStatusMeta(r.status);
  const appliedOn = r.appliedOn || r.appliedAt || r.createdAt;
  return {
    Employee: r.employeeName || '',
    'Employee Code': r.employeeCode || '',
    Department: r.departmentName || '',
    'Leave Type': r.leaveTypeName || '',
    Start: r.startDate ? formatDateIST(r.startDate) : '',
    End: r.endDate ? formatDateIST(r.endDate) : '',
    Days: r.halfDay ? formatLeaveDuration(r) : r.days ?? '',
    Status: meta?.label || r.status || '',
    'Applied On': appliedOn ? formatDateIST(appliedOn) : '',
    'Decided By': r.decidedByName || '',
    'Decided On': r.decidedAt ? formatDateIST(r.decidedAt) : '',
    Note: r.decisionNote || '',
  };
}

// Routing gate only - hooks live in LeaveManagement so they always run in the same order.
export default function LeaveRequests() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('LEAVE_VIEW') || hasPermission('LEAVE_APPROVE') || hasPermission('LEAVE_MANAGE');
  if (!canView) return <Navigate to="/my-leave" replace />;
  return <LeaveManagement />;
}

function LeaveManagement() {
  const [tab, setTab] = useState('PENDING');
  const [showApply, setShowApply] = useState(false);
  const [decision, setDecision] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canDecide = hasPermission('LEAVE_APPROVE');
  const canApplyForOthers = hasPermission('LEAVE_APPLY');
  const [section, setSection] = useState('leave');
  const sectionTabs = [
    { key: 'leave', label: 'Leave requests' },
    ...(canDecide ? [{ key: 'compoff', label: 'Comp-off' }] : []),
    ...(hasPermission('LEAVE_MANAGE') ? [{ key: 'encashment', label: 'Encashment' }] : []),
  ];

  // A Manager (LEAVE_APPROVE without the broader LEAVE_MANAGE HR/Admin
  // hold) should only see their own team's requests here - the plain
  // listAll endpoint is org-wide and gated on LEAVE_VIEW, which MANAGER
  // also has, so calling it directly would show every employee's leave
  // company-wide. Same distinction already used for the Dashboard's My
  // Team widget, applied here since this page is the one people actually
  // use day-to-day.
  const isTeamScoped = hasPermission('LEAVE_APPROVE') && !hasPermission('LEAVE_MANAGE');

  const { data: requests, isLoading, isError, refetch } = useQuery({
    queryKey: ['leave-requests', tab, isTeamScoped],
    queryFn: () => (isTeamScoped ? leaveRequestsApi.teamList(tab || undefined) : leaveRequestsApi.list(tab || undefined)),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve, note }) => (approve ? leaveRequestsApi.approve(id, note) : leaveRequestsApi.reject(id, note)),
    onSuccess: () => {
      setDecision(null);
      setDecisionNote('');
      toast.success('Leave request updated.');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-my-team'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update the leave request.'),
  });

  // Search, sorting and paging happen in DataTable on the list already loaded for the status tab
  // (the endpoint is not paged). Department is a hidden column so it is still searchable.
  const columns = useMemo(() => [
    {
      key: 'employee', label: 'Employee', className: 'ps-4', headerClassName: 'ps-4', hideable: false,
      value: (r) => r.employeeName,
      render: (r) => (
        <Link to={`/employees/${r.employeeId}`} className="d-flex align-items-center gap-2 text-decoration-none">
          <Avatar name={r.employeeName} size="sm" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>{r.employeeName}</div>
            <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.departmentName || '—'}</div>
          </div>
        </Link>
      ),
    },
    { key: 'departmentName', label: 'Department', defaultHidden: true },
    { key: 'leaveTypeName', label: 'Leave Type' },
    {
      key: 'dates', label: 'Dates', value: (r) => r.startDate, searchable: false,
      render: (r) => (
        <span style={{ color: 'var(--hz-text-secondary)' }}>
          {new Date(r.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – {new Date(r.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    { key: 'days', label: 'Days', render: (r) => (r.halfDay ? formatLeaveDuration(r) : r.days) },
    {
      key: 'status', label: 'Status', value: (r) => leaveStatusMeta(r.status).label,
      render: (r) => {
        const meta = leaveStatusMeta(r.status);
        return <StatusBadge status={r.status} variant={meta.variant} dot>{meta.label}</StatusBadge>;
      },
    },
    {
      key: 'appliedOn', label: 'Applied On', defaultHidden: true, searchable: false,
      value: (r) => r.appliedOn || r.appliedAt || r.createdAt,
      render: (r) => { const at = r.appliedOn || r.appliedAt || r.createdAt; return at ? formatDateIST(at) : '—'; },
    },
    {
      key: 'actions', label: 'Actions', className: 'pe-4 text-end', headerClassName: 'pe-4 text-end', hideable: false, sortable: false, searchable: false,
      render: (r) => canDecide && r.status === 'PENDING' && (
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            onClick={() => setDecision({ id: r.id, approve: false, employeeName: r.employeeName })}
            disabled={decide.isPending}
            aria-label={`Reject ${r.employeeName}'s leave request`}
          >
            <XIcon size={14} aria-hidden="true" /> Reject
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
            onClick={() => setDecision({ id: r.id, approve: true, employeeName: r.employeeName })}
            disabled={decide.isPending}
            aria-label={`Approve ${r.employeeName}'s leave request`}
          >
            <Check size={14} aria-hidden="true" /> Approve
          </button>
        </div>
      ),
    },
  // decide.isPending changes the buttons, so the columns follow it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canDecide, decide.isPending]);

  return (
    <div className="hz-module-page hz-module-page--leave d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Workforce"
        title={isTeamScoped ? 'Team Leave' : 'Leave Management'}
        description={isTeamScoped ? "Your team's requests, approvals, and balances" : 'Requests, approvals, and balances'}
        actions={canApplyForOthers && <Button icon={CalendarPlus} onClick={() => setShowApply(true)}>Request leave</Button>}
      />

      {sectionTabs.length > 1 && <Tabs items={sectionTabs} value={section} onChange={setSection} ariaLabel="Leave workflows" />}
      {section === 'compoff' && <CompOffApprovals />}
      {section === 'encashment' && <EncashmentApprovals />}

      {section === 'leave' && (<>
      {!isLoading && !isError && requests && (
        <div className="hz-inline-summary" aria-label="Leave request summary">
          <InlineSummary label="Total requests" value={requests.length} />
          <InlineSummary label="Pending" value={requests.filter((request) => request.status === 'PENDING').length} tone="warning" />
          <InlineSummary label="Approved" value={requests.filter((request) => request.status === 'APPROVED').length} tone="success" />
          <InlineSummary label="Rejected" value={requests.filter((request) => request.status === 'REJECTED').length} tone="danger" />
        </div>
      )}

      <Card bodyClassName="p-0">
        <DataTable
          flush
          columns={columns}
          rows={requests}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          ariaLabel="Leave requests"
          storageKey="leave-requests"
          searchPlaceholder="Filter by name, type, dept…"
          toolbar={<Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="Leave request status" />}
          onExport={(rows) => exportToCsv(`leave-register-${tab ? tab.toLowerCase() : 'all'}-${toISTDateInputValue()}`, rows.map(toLeaveExportRow))}
          emptyIcon={Calendar}
          emptyTitle={tab === 'PENDING' ? 'Nothing pending' : 'No leave requests yet'}
          emptyDescription={tab === 'PENDING'
            ? isTeamScoped ? 'None of your direct reports have pending requests.' : 'New requests will show up here for approval.'
            : 'Apply for leave to get started.'}
        />
      </Card>
      </>)}

      {showApply && <ApplyLeaveModal onClose={() => setShowApply(false)} />}
      <Dialog open={!!decision} onClose={() => setDecision(null)} title={decision?.approve ? 'Approve leave request' : 'Reject leave request'} description={`${decision?.employeeName || 'This employee'} · add context for the request record.`}>
        <form onSubmit={(event) => { event.preventDefault(); decide.mutate({ ...decision, note: decisionNote.trim() || undefined }); }}>
          <FormField as="textarea" label={decision?.approve ? 'Approval note (optional)' : 'Rejection reason'} required={!decision?.approve} rows={4} value={decisionNote} onChange={setDecisionNote} placeholder={decision?.approve ? 'Add a note for the employee...' : 'Explain why this request cannot be approved...'} />
          <div className="d-flex justify-content-end gap-2 mt-3"><Button type="button" variant="secondary" onClick={() => setDecision(null)}>Cancel</Button><Button type="submit" variant={decision?.approve ? 'primary' : 'danger'} loading={decide.isPending}>{decision?.approve ? 'Approve request' : 'Reject request'}</Button></div>
        </form>
      </Dialog>
    </div>
  );
}

function InlineSummary({ label, value, tone = 'neutral' }) {
  return <div className={`hz-inline-summary__item hz-inline-summary__item--${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
