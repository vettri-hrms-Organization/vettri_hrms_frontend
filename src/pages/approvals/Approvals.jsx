import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCheck, ClipboardCheck, RefreshCw, X as XIcon } from 'lucide-react';
import { compOffApi, encashmentApi, leaveRequestsApi } from '../../api/endpoints/leave';
import { attendanceApi } from '../../api/endpoints/attendance';
import { overtimeApi } from '../../api/endpoints/shifts';
import { expensesApi } from '../../api/endpoints/expenses';
import { profileApi } from '../../api/endpoints/profile';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateIST } from '../../utils/formatDateTime';
import { formatLeaveDuration } from '../../utils/formatLeave';
import { addDays, formatDay, formatMinutes, istToday } from '../attendance/shiftUtils';

/** Pending overtime older than this is out of the inbox window (the list endpoint requires a range). */
const OVERTIME_LOOKBACK_DAYS = 365;

const fmtNumber = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0');
const plural = (n, word) => `${fmtNumber(n)} ${word}${Number(n) === 1 ? '' : 's'}`;
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
/** Account numbers show only their last 4 digits in the list; the full value is on the profile. */
const showValue = (field, value) => (!value ? 'blank' : field === 'bankAccountNumber' && value.length > 4 ? `••••${value.slice(-4)}` : value);

/** A source the caller may not reach (401/403) is just an empty queue, never a broken page. */
async function forbiddenAsEmpty(request) {
  try {
    const data = await request();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401 || status === 403) return [];
    throw error;
  }
}

function joinDetails(...parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * One entry per approval queue. `enabled` mirrors the permission the
 * existing page for that queue uses, so we never call an endpoint the user
 * can't reach. `toItems` maps the real DTO fields into one row shape.
 */
function buildSources(hasPermission) {
  const leaveTeamScoped = hasPermission('LEAVE_APPROVE') && !hasPermission('LEAVE_MANAGE');
  const isFinance = hasPermission('EXPENSE_MANAGE');
  const canManagerReviewExpenses = hasPermission('EXPENSE_APPROVE') || isFinance;
  const otTo = istToday();
  const otFrom = addDays(otTo, -OVERTIME_LOOKBACK_DAYS);

  return [
    {
      key: 'leave',
      label: 'Leave',
      variant: 'primary',
      enabled: hasPermission('LEAVE_APPROVE'),
      fetch: () => (leaveTeamScoped ? leaveRequestsApi.teamList('PENDING') : leaveRequestsApi.list('PENDING')),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: r.leaveTypeName || 'Leave',
        details: joinDetails(
          r.startDate === r.endDate ? formatDay(r.startDate) : `${formatDay(r.startDate)} – ${formatDay(r.endDate)}`,
          r.halfDay ? formatLeaveDuration(r) : plural(r.days, 'day'),
        ),
        reason: r.reason,
      })),
      approve: (item, note) => leaveRequestsApi.approve(item.id, note),
      reject: (item, note) => leaveRequestsApi.reject(item.id, note),
      invalidate: [['leave-requests'], ['dashboard-summary'], ['dashboard-my-team'], ['leave-balance']],
    },
    {
      key: 'wfh',
      label: 'WFH',
      variant: 'info',
      enabled: hasPermission('LEAVE_APPROVE'),
      fetch: () => attendanceApi.teamWfh(),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        title: 'Work from home',
        details: formatDay(r.workDate),
        reason: r.reason,
      })),
      approve: (item, note) => attendanceApi.approveWfh(item.id, note),
      reject: (item, note) => attendanceApi.rejectWfh(item.id, note),
      invalidate: [['attendance-wfh-team']],
    },
    {
      key: 'regularization',
      label: 'Attendance corrections',
      variant: 'warning',
      enabled: hasPermission('ATTENDANCE_MANAGE'),
      fetch: () => attendanceApi.pendingRegularizations(),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        title: 'Attendance correction',
        details: joinDetails(
          formatDay(r.attendanceDate),
          r.requestedCheckIn && `${r.requestedCheckIn}${r.requestedCheckOut ? ` – ${r.requestedCheckOut}` : ''}`,
        ),
        reason: r.reason,
      })),
      approve: (item, note) => attendanceApi.reviewRegularization(item.id, true, note),
      reject: (item, note) => attendanceApi.reviewRegularization(item.id, false, note),
      invalidate: [['attendance-regularizations-pending'], ['attendance-exceptions']],
    },
    {
      key: 'overtime',
      label: 'Overtime',
      variant: 'neutral',
      enabled: hasPermission('OVERTIME_APPROVE'),
      fetch: () => overtimeApi.list('PENDING', otFrom, otTo),
      toItems: (rows, user) => rows
        .filter((r) => r.status === 'PENDING')
        // Your own overtime can't be reviewed by you (same rule as the Overtime page).
        .filter((r) => !(user?.employeeId && String(user.employeeId) === String(r.employeeId)))
        .map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          subtitle: joinDetails(r.employeeCode, r.departmentName),
          title: r.source === 'EMPLOYEE' ? 'Overtime claim' : 'Overtime',
          details: joinDetails(formatDay(r.workDate), `${formatMinutes(r.computedMinutes)} computed`, r.shiftName),
          reason: r.employeeNote,
        })),
      // approvedMinutes null = approve the full computed overtime.
      approve: (item, note) => overtimeApi.review(item.id, true, null, note || null),
      reject: (item, note) => overtimeApi.review(item.id, false, null, note || null),
      invalidate: [['overtime']],
    },
    {
      key: 'expense',
      label: 'Expenses',
      variant: 'success',
      enabled: canManagerReviewExpenses,
      rejectNoteRequired: true,
      fetch: async () => {
        const [managerRows, financeRows] = await Promise.all([
          forbiddenAsEmpty(() => expensesApi.managerQueue()),
          isFinance ? forbiddenAsEmpty(() => expensesApi.financeQueue()) : Promise.resolve([]),
        ]);
        // Finance items win when a claim is in both queues (a submitted claim
        // with no active manager goes straight to final approval).
        const byId = new Map();
        managerRows.filter((c) => c.status === 'SUBMITTED').forEach((c) => byId.set(c.id, { ...c, _stage: 'manager' }));
        financeRows
          .filter((c) => c.status === 'SUBMITTED' || c.status === 'MANAGER_APPROVED')
          .forEach((c) => byId.set(c.id, { ...c, _stage: 'finance' }));
        return [...byId.values()];
      },
      toItems: (rows) => rows.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        subtitle: c.departmentName,
        title: c._stage === 'finance' ? 'Expense · final approval' : 'Expense claim',
        details: joinDetails(c.title, formatCurrency(c.totalAmount)),
        reason: c.purpose,
        submittedAt: c.submittedAt,
        stage: c._stage,
      })),
      approve: (item, note) => (item.stage === 'finance'
        ? expensesApi.approve(item.id, note || null)
        : expensesApi.managerApprove(item.id, note || null)),
      reject: (item, note) => expensesApi.reject(item.id, note),
      invalidate: [['expense-approvals']],
    },
    {
      key: 'compoff',
      label: 'Comp-off',
      variant: 'primary',
      enabled: hasPermission('LEAVE_APPROVE'),
      fetch: () => compOffApi.approvals('PENDING'),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: 'Comp-off credit',
        details: joinDetails(
          `Worked ${formatDay(r.workDate)}${r.dayType === 'HOLIDAY' ? ' (holiday)' : r.dayType ? ' (weekly off)' : ''}`,
          plural(r.days, 'day'),
          r.attendanceVerified === true ? 'Attendance verified' : r.attendanceVerified === false ? 'No attendance found' : null,
        ),
        reason: r.reason,
        submittedAt: r.createdAt,
      })),
      approve: (item, note) => compOffApi.approve(item.id, note),
      reject: (item, note) => compOffApi.reject(item.id, note),
      invalidate: [['comp-off-approvals'], ['comp-off'], ['leave-balance']],
    },
    {
      key: 'encashment',
      label: 'Encashment',
      variant: 'warning',
      enabled: hasPermission('LEAVE_MANAGE'),
      fetch: () => encashmentApi.list('PENDING'),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: 'Leave encashment',
        details: joinDetails(
          `${r.leaveTypeName}${r.leaveYear ? ` (${r.leaveYear})` : ''}`,
          plural(r.days, 'day'),
          r.amount != null ? formatCurrency(r.amount) : null,
        ),
        reason: r.reason,
        submittedAt: r.createdAt,
      })),
      approve: (item, note) => encashmentApi.approve(item.id, note),
      reject: (item, note) => encashmentApi.reject(item.id, note),
      invalidate: [['leave-encashment-approvals'], ['leave-encashments'], ['leave-balance']],
    },
    {
      key: 'profile',
      label: 'Profile changes',
      variant: 'neutral',
      enabled: hasPermission('EMPLOYEE_MANAGE'),
      fetch: () => profileApi.pendingChanges(),
      toItems: (rows) => rows.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.employeeCode,
        title: r.section === 'BANK' ? 'Bank details change' : 'Personal details change',
        details: r.changes.map((c) => `${c.label}: ${showValue(c.field, c.from)} → ${showValue(c.field, c.to)}`).join(' · '),
        reason: r.reason,
        submittedAt: r.requestedAt,
      })),
      approve: (item, note) => profileApi.approveChange(item.id, note),
      reject: (item, note) => profileApi.rejectChange(item.id, note),
      rejectNoteRequired: true,
      invalidate: [['profile'], ['employee']],
    },
  ];
}

export default function Approvals() {
  const { hasPermission, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);

  const sources = useMemo(() => buildSources(hasPermission).filter((s) => s.enabled), [hasPermission]);

  const results = useQueries({
    queries: sources.map((source) => ({
      queryKey: ['approvals-inbox', source.key],
      queryFn: () => forbiddenAsEmpty(source.fetch),
      retry: false,
    })),
  });

  const sections = sources.map((source, index) => {
    const result = results[index] || {};
    const items = (result.data ? source.toItems(result.data, user) : []).map((item) => ({
      ...item,
      uid: `${source.key}:${item.id}`,
      source,
    }));
    return { source, result, items };
  });

  const allItems = sections.flatMap((s) => s.items);
  const visibleItems = filter === 'all' ? allItems : (sections.find((s) => s.source.key === filter)?.items || []);
  const isLoading = sections.some((s) => s.result.isLoading);
  const failed = sections.filter((s) => s.result.isError);
  const total = allItems.length;

  const visibleSelected = visibleItems.filter((item) => selected.has(item.uid));
  const allVisibleSelected = visibleItems.length > 0 && visibleSelected.length === visibleItems.length;

  const tabs = [
    { key: 'all', label: 'All', count: total },
    ...sections.map((s) => ({ key: s.source.key, label: s.source.label, count: s.items.length })),
  ];

  const markBusy = (uids, on) => setBusy((prev) => {
    const next = new Set(prev);
    uids.forEach((uid) => (on ? next.add(uid) : next.delete(uid)));
    return next;
  });

  const refreshSources = (touched) => {
    touched.forEach((source) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-inbox', source.key] });
      source.invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    });
  };

  const toggle = (uid) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });

  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleItems.forEach((item) => next.delete(item.uid));
    else visibleItems.forEach((item) => next.add(item.uid));
    return next;
  });

  async function approveOne(item) {
    markBusy([item.uid], true);
    try {
      await item.source.approve(item, undefined);
      toast.success(`Approved ${item.employeeName}'s ${item.title.toLowerCase()}.`);
      setSelected((prev) => { const next = new Set(prev); next.delete(item.uid); return next; });
    } catch (error) {
      toast.error(errorMessage(error, `Could not approve ${item.employeeName}'s request.`));
    } finally {
      markBusy([item.uid], false);
      refreshSources([item.source]);
    }
  }

  async function submitReject(event) {
    event.preventDefault();
    const item = rejecting;
    if (!item) return;
    const note = rejectNote.trim();
    if (item.source.rejectNoteRequired && !note) return;
    markBusy([item.uid], true);
    try {
      await item.source.reject(item, note || undefined);
      toast.success(`Rejected ${item.employeeName}'s ${item.title.toLowerCase()}.`);
      setSelected((prev) => { const next = new Set(prev); next.delete(item.uid); return next; });
      setRejecting(null);
      setRejectNote('');
    } catch (error) {
      toast.error(errorMessage(error, `Could not reject ${item.employeeName}'s request.`));
    } finally {
      markBusy([item.uid], false);
      refreshSources([item.source]);
    }
  }

  async function approveSelected() {
    const items = visibleSelected;
    if (!items.length) return;
    setBulkRunning(true);
    markBusy(items.map((i) => i.uid), true);
    const outcomes = await Promise.allSettled(items.map((item) => item.source.approve(item, undefined)));
    const succeeded = items.filter((_, i) => outcomes[i].status === 'fulfilled');
    const failedCount = items.length - succeeded.length;
    setSelected((prev) => {
      const next = new Set(prev);
      succeeded.forEach((item) => next.delete(item.uid));
      return next;
    });
    markBusy(items.map((i) => i.uid), false);
    setBulkRunning(false);
    refreshSources([...new Set(items.map((i) => i.source))]);
    if (failedCount === 0) {
      toast.success(`Approved ${plural(succeeded.length, 'request')}.`);
    } else if (succeeded.length === 0) {
      toast.error(`None of the ${plural(failedCount, 'request')} could be approved. They're still in the list.`);
    } else {
      toast.info(`Approved ${succeeded.length}, ${failedCount} failed. Failed requests are still in the list.`);
    }
  }

  const description = sources.length === 0
    ? "You don't have any approval permissions."
    : isLoading
      ? 'Everything waiting on your decision, in one place.'
      : `${plural(total, 'request')} waiting on your decision across leave, attendance and expenses.`;

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Workspace"
        title="Approvals"
        description={description}
        actions={sources.length > 0 && (
          <>
            <span className="hz-badge hz-badge--warning" aria-live="polite" data-testid="approvals-total">
              {isLoading ? 'Loading…' : `${total} pending`}
            </span>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => results.forEach((r) => r.refetch?.())}>Refresh</Button>
          </>
        )}
      />

      {sources.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="No approval access" description="Approvals appear here once you're given permission to review requests." /></Card>
      ) : (
        <>
          <div className="hz-tabs d-flex gap-1 overflow-auto" role="tablist" aria-label="Filter approvals by type">
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setFilter(tab.key)}
                  className={`hz-tab d-inline-flex align-items-center gap-2 text-nowrap ${active ? 'hz-tab--active' : ''}`}
                >
                  {tab.label}
                  <span className={`hz-badge ${active ? 'hz-badge--primary' : 'hz-badge--neutral'}`} aria-label={`${tab.count} pending`}>{isLoading ? '…' : tab.count}</span>
                </button>
              );
            })}
          </div>

          {failed.length > 0 && (
            <div className="alert alert-warning d-flex align-items-center justify-content-between flex-wrap gap-2 mb-0" role="alert">
              <span className="d-inline-flex align-items-center gap-2">
                <AlertTriangle size={16} aria-hidden="true" />
                Couldn't load {failed.map((s) => s.source.label).join(', ')}. Other approvals are shown below.
              </span>
              <Button variant="secondary" size="sm" onClick={() => failed.forEach((s) => s.result.refetch?.())}>Retry</Button>
            </div>
          )}

          <Card bodyClassName="p-0">
            {isLoading && allItems.length === 0 ? (
              <div className="d-flex flex-column" aria-busy="true" aria-label="Loading approvals">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="d-flex align-items-center gap-3 p-3" style={{ borderBottom: '1px solid var(--hz-border)' }}>
                    <Skeleton width={36} height={36} radius="50%" />
                    <div className="flex-grow-1 d-flex flex-column gap-2">
                      <Skeleton height={12} width="35%" />
                      <Skeleton height={10} width="60%" />
                    </div>
                    <Skeleton width={150} height={30} radius={8} />
                  </div>
                ))}
              </div>
            ) : visibleItems.length === 0 ? (
              <EmptyState
                icon={CheckCheck}
                title="You're all caught up"
                description={filter === 'all' ? 'Nothing is waiting on your decision right now.' : `No pending ${tabs.find((t) => t.key === filter)?.label.toLowerCase()} requests.`}
              />
            ) : (
              <>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--hz-border)', background: 'var(--hz-surface-muted, transparent)' }}>
                  <label className="d-inline-flex align-items-center gap-2 mb-0" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible requests"
                    />
                    {visibleSelected.length > 0 ? `${visibleSelected.length} selected` : 'Select all'}
                  </label>
                  <Button size="sm" icon={CheckCheck} onClick={approveSelected} loading={bulkRunning} disabled={visibleSelected.length === 0}>
                    Approve selected{visibleSelected.length > 0 ? ` (${visibleSelected.length})` : ''}
                  </Button>
                </div>
                <ul className="list-unstyled mb-0" aria-label="Pending approvals">
                  {visibleItems.map((item) => (
                    <ApprovalRow
                      key={item.uid}
                      item={item}
                      checked={selected.has(item.uid)}
                      busy={busy.has(item.uid)}
                      onToggle={() => toggle(item.uid)}
                      onApprove={() => approveOne(item)}
                      onReject={() => { setRejecting(item); setRejectNote(''); }}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.title.toLowerCase()}` : 'Reject request'}
        description={rejecting ? joinDetails(rejecting.employeeName, rejecting.details) : undefined}
      >
        {rejecting && (
          <form onSubmit={submitReject}>
            <FormField
              as="textarea"
              rows={3}
              label={rejecting.source.rejectNoteRequired ? 'Rejection reason' : 'Note for the employee (optional)'}
              required={!!rejecting.source.rejectNoteRequired}
              value={rejectNote}
              onChange={setRejectNote}
              maxLength={500}
              placeholder="Explain why this request can't be approved…"
            />
            <div className="d-flex justify-content-end gap-2 mt-2">
              <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                type="submit"
                variant="danger"
                loading={busy.has(rejecting.uid)}
                disabled={rejecting.source.rejectNoteRequired && !rejectNote.trim()}
              >
                Reject
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function ApprovalRow({ item, checked, busy, onToggle, onApprove, onReject }) {
  const who = item.employeeName || 'Employee';
  const what = item.title.toLowerCase();
  return (
    <li className="d-flex flex-column flex-md-row align-items-md-center gap-3 p-3" style={{ borderBottom: '1px solid var(--hz-border)' }}>
      <div className="d-flex align-items-start gap-3 flex-grow-1 min-w-0">
        <input
          type="checkbox"
          className="form-check-input mt-2 flex-shrink-0"
          checked={checked}
          onChange={onToggle}
          disabled={busy}
          aria-label={`Select ${who}'s ${what}`}
        />
        <Avatar name={who} size="sm" />
        <div className="min-w-0 flex-grow-1">
          <div className="d-flex align-items-center flex-wrap gap-2">
            {item.employeeId ? (
              <Link to={`/employees/${item.employeeId}`} className="text-decoration-none" style={{ fontWeight: 600, color: 'var(--hz-text-primary)', fontSize: 'var(--hz-text-sm)' }}>{who}</Link>
            ) : (
              <span style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{who}</span>
            )}
            <Badge variant={item.source.variant}>{item.title}</Badge>
          </div>
          {item.subtitle && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{item.subtitle}</div>}
          <div style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{item.details}</div>
          {item.reason && (
            <div className="text-truncate" style={{ fontSize: 12, color: 'var(--hz-text-muted)', maxWidth: 560 }} title={item.reason}>{item.reason}</div>
          )}
          {item.submittedAt && (
            <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Submitted {formatDateIST(item.submittedAt)}</div>
          )}
        </div>
      </div>
      <div className="d-flex gap-2 justify-content-end flex-shrink-0">
        <Button size="sm" variant="secondary" icon={XIcon} onClick={onReject} disabled={busy} aria-label={`Reject ${who}'s ${what}`}>Reject</Button>
        <Button size="sm" icon={Check} onClick={onApprove} loading={busy} aria-label={`Approve ${who}'s ${what}`}>Approve</Button>
      </div>
    </li>
  );
}
