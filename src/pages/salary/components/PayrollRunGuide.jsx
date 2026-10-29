import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { employeeSalaryApi } from '../../../api/endpoints/salary';
import { leaveRequestsApi } from '../../../api/endpoints/leave';
import { attendanceApi } from '../../../api/endpoints/attendance';
import { overtimeApi } from '../../../api/endpoints/shifts';
import Badge from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';

/**
 * Steps map 1:1 onto the payroll run lifecycle the backend actually has
 * (PayrollRunStatus: DRAFT -> PROCESSED -> PAID, CANCELLED from DRAFT).
 * There is no separate approve/lock action server-side, so none is shown.
 */
export const PAYROLL_STEPS = [
  { key: 'open', label: 'Select month', hint: 'Open a run for the pay period' },
  { key: 'review', label: 'Review', hint: 'Check employees, holds and the checklist' },
  { key: 'process', label: 'Process', hint: 'Lock in totals for every employee not on hold' },
  { key: 'paid', label: 'Mark paid', hint: 'Record the payment date' },
  { key: 'payslips', label: 'Payslips', hint: 'Download payslips and bank files' },
];

/** Index of the step the run is currently on. PAID means every step is finished. */
export function currentStepIndex(status) {
  if (status === 'DRAFT') return 1;
  if (status === 'PROCESSED') return 3;
  if (status === 'PAID') return PAYROLL_STEPS.length;
  return 0;
}

export function PayrollStepper({ status }) {
  const current = currentStepIndex(status);
  return (
    <ol
      aria-label="Payroll run progress"
      className="list-unstyled d-flex flex-wrap m-0"
      style={{ gap: 'var(--hz-space-2)' }}
    >
      {PAYROLL_STEPS.map((step, index) => {
        // While a run is in DRAFT, Review and Process both happen on this screen; Review is "current".
        const done = index < current;
        const isCurrent = index === current;
        const stateLabel = done ? 'Completed' : isCurrent ? 'Current step' : 'Not started';
        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            data-step-state={done ? 'done' : isCurrent ? 'current' : 'todo'}
            className="d-flex align-items-start"
            style={{
              flex: '1 1 140px',
              minWidth: 0,
              gap: 'var(--hz-space-2)',
              padding: 'var(--hz-space-2) var(--hz-space-3)',
              borderRadius: 'var(--hz-radius-md)',
              border: `1px solid ${isCurrent ? 'var(--hz-primary-600)' : 'var(--hz-border)'}`,
              background: isCurrent ? 'var(--hz-primary-50)' : done ? 'var(--hz-success-50)' : 'var(--hz-bg-surface)',
            }}
          >
            <span
              aria-hidden="true"
              className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 24,
                height: 24,
                borderRadius: 'var(--hz-radius-full)',
                fontSize: 12,
                fontWeight: 700,
                background: done ? 'var(--hz-success-600)' : isCurrent ? 'var(--hz-primary-600)' : 'var(--hz-gray-200)',
                color: done || isCurrent ? 'var(--hz-text-on-primary)' : 'var(--hz-text-secondary)',
              }}
            >
              {done ? <Check size={14} /> : index + 1}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="d-block" style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>
                {step.label}
              </span>
              <span className="d-block" style={{ fontSize: 12, color: done ? 'var(--hz-success-700)' : isCurrent ? 'var(--hz-primary-700)' : 'var(--hz-text-muted)' }}>
                {stateLabel}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** First and last ISO date of a run's pay period. */
export function periodRange(run) {
  if (!run?.periodYear || !run?.periodMonth) return null;
  const lastDay = new Date(run.periodYear, run.periodMonth, 0).getDate();
  return {
    from: `${run.periodYear}-${pad(run.periodMonth)}-01`,
    to: `${run.periodYear}-${pad(run.periodMonth)}-${pad(lastDay)}`,
  };
}

const INACTIVE_EMPLOYMENT = new Set(['Resigned', 'Terminated']);
// The salary list endpoint filters/sorts in memory and has no page-size cap, so one large page covers the directory.
const SALARY_LIST_SIZE = 2000;

/**
 * Builds the "Before you run" items from data the existing APIs already return.
 * A check whose endpoint the user isn't permitted to call is left out entirely.
 */
export function usePayrollChecklist({ run, items, onHoldCount, hasPermission }) {
  const range = periodRange(run);
  const enabledBase = !!range && run?.status === 'DRAFT';

  const canViewSalary = hasPermission('SALARY_VIEW') || hasPermission('SALARY_MANAGE');
  // Same split as the Dashboard: a team-scoped approver must not read the company-wide list.
  const canViewAllLeave = (hasPermission('LEAVE_VIEW') || hasPermission('LEAVE_APPROVE')) && !(hasPermission('LEAVE_APPROVE') && !hasPermission('LEAVE_MANAGE'));
  const canViewRegularizations = hasPermission('ATTENDANCE_MANAGE');
  const canViewOvertime = hasPermission('OVERTIME_APPROVE');

  const salaryQuery = useQuery({
    queryKey: ['salary-employees', 'payroll-checklist'],
    queryFn: () => employeeSalaryApi.list({ page: 0, size: SALARY_LIST_SIZE, sortBy: 'employeeName', sortDir: 'asc' }),
    enabled: enabledBase && canViewSalary,
    retry: false,
  });
  const leaveQuery = useQuery({
    queryKey: ['leave-requests', 'PENDING'],
    queryFn: () => leaveRequestsApi.list('PENDING'),
    enabled: enabledBase && canViewAllLeave,
    retry: false,
  });
  const regularizationQuery = useQuery({
    queryKey: ['attendance-regularizations-pending'],
    queryFn: attendanceApi.pendingRegularizations,
    enabled: enabledBase && canViewRegularizations,
    retry: false,
  });
  const overtimeQuery = useQuery({
    queryKey: ['overtime', 'PENDING', range?.from, range?.to],
    queryFn: () => overtimeApi.list('PENDING', range.from, range.to),
    enabled: enabledBase && canViewOvertime,
    retry: false,
  });

  if (!enabledBase) return [];

  const inPeriod = (date) => !!date && date >= range.from && date <= range.to;
  const checks = [
    {
      key: 'included',
      label: 'Employees included in this run',
      count: items.length,
      ok: items.length > 0,
      blocking: true,
      okText: `${items.length} employee${items.length === 1 ? '' : 's'} with an active salary structure`,
      problemText: 'No employees were picked up. Assign salary structures, then cancel and reopen this run.',
      to: '/salary/employees',
      linkLabel: 'Open employee salaries',
    },
    {
      key: 'holds',
      label: 'Payroll holds resolved',
      count: onHoldCount,
      ok: onHoldCount === 0,
      blocking: true,
      okText: 'No employees on hold',
      problemText: `${onHoldCount} employee${onHoldCount === 1 ? ' is' : 's are'} on hold. Release them in the table below before processing.`,
      href: '#payroll-run-employees',
      linkLabel: 'Go to employees',
    },
  ];

  if (canViewSalary) {
    const rows = salaryQuery.data?.content || [];
    const missing = rows.filter((r) => !r.structureConfigured && !INACTIVE_EMPLOYMENT.has(r.employmentStatus)).length;
    const truncated = (salaryQuery.data?.totalElements ?? rows.length) > rows.length;
    checks.push({
      key: 'structures',
      label: 'Employees without a salary structure',
      count: missing,
      ok: missing === 0,
      okText: 'Every current employee has a salary structure',
      problemText: `${truncated ? 'At least ' : ''}${missing} current employee${missing === 1 ? '' : 's'} will not be paid in this run.`,
      to: '/salary/employees',
      linkLabel: 'Assign structures',
      query: salaryQuery,
    });
  }

  if (canViewAllLeave) {
    const pending = (leaveQuery.data || []).filter((l) => l.startDate && l.endDate && l.startDate <= range.to && l.endDate >= range.from).length;
    checks.push({
      key: 'leave',
      label: `Pending leave requests in ${run.periodLabel}`,
      count: pending,
      ok: pending === 0,
      okText: 'No leave waiting for a decision',
      problemText: `${pending} request${pending === 1 ? '' : 's'} not yet decided. Only approved unpaid leave counts as loss of pay.`,
      to: '/leave',
      linkLabel: 'Review leave',
      query: leaveQuery,
    });
  }

  if (canViewRegularizations) {
    const pending = (regularizationQuery.data || []).filter((r) => inPeriod(r.attendanceDate)).length;
    checks.push({
      key: 'regularizations',
      label: `Pending attendance corrections in ${run.periodLabel}`,
      count: pending,
      ok: pending === 0,
      okText: 'No attendance corrections waiting',
      problemText: `${pending} correction${pending === 1 ? '' : 's'} waiting. These can change late marks and paid days.`,
      to: '/attendance',
      linkLabel: 'Review attendance',
      query: regularizationQuery,
    });
  }

  if (canViewOvertime) {
    const pending = (overtimeQuery.data || []).length;
    checks.push({
      key: 'overtime',
      label: `Pending overtime claims in ${run.periodLabel}`,
      count: pending,
      ok: pending === 0,
      okText: 'No overtime waiting for approval',
      problemText: `${pending} claim${pending === 1 ? '' : 's'} not approved. Only approved overtime is paid.`,
      to: '/attendance/overtime',
      linkLabel: 'Review overtime',
      query: overtimeQuery,
    });
  }

  return checks;
}

function CheckRow({ check }) {
  const loading = check.query?.isLoading;
  const failed = check.query?.isError;
  return (
    <li
      data-check={check.key}
      className="d-flex flex-wrap align-items-center justify-content-between"
      style={{ gap: 'var(--hz-space-2) var(--hz-space-3)', padding: 'var(--hz-space-3) 0', borderBottom: '1px solid var(--hz-border)' }}
    >
      <div className="d-flex align-items-start" style={{ gap: 'var(--hz-space-2)', minWidth: 0, flex: '1 1 240px' }}>
        <span aria-hidden="true" style={{ marginTop: 2, color: loading || failed ? 'var(--hz-text-muted)' : check.ok ? 'var(--hz-success-600)' : check.blocking ? 'var(--hz-danger-600)' : 'var(--hz-warning-600)' }}>
          {check.ok && !loading && !failed ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>{check.label}</div>
          {loading ? (
            <div className="mt-1" aria-label="Checking"><Skeleton height={10} width={180} /></div>
          ) : failed ? (
            <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Couldn't check this right now.</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--hz-text-secondary)' }}>{check.ok ? check.okText : check.problemText}</div>
          )}
        </div>
      </div>
      <div className="d-flex align-items-center flex-wrap" style={{ gap: 'var(--hz-space-2)' }}>
        {!loading && !failed && (
          <>
            <span style={{ fontWeight: 700, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }} aria-label={`Count ${check.count}`}>{check.count}</span>
            <Badge variant={check.ok ? 'success' : check.blocking ? 'danger' : 'warning'}>{check.ok ? 'OK' : check.blocking ? 'Blocks processing' : 'Needs attention'}</Badge>
          </>
        )}
        {failed && (
          <button type="button" className="btn btn-sm btn-link d-inline-flex align-items-center gap-1 p-0" onClick={() => check.query.refetch()}>
            <RefreshCw size={13} /> Retry
          </button>
        )}
        {!loading && !failed && !check.ok && (check.to ? (
          <Link to={check.to} className="btn btn-sm btn-outline-secondary">{check.linkLabel}</Link>
        ) : (
          <a href={check.href} className="btn btn-sm btn-outline-secondary">{check.linkLabel}</a>
        ))}
      </div>
    </li>
  );
}

export function PayrollChecklist({ checks }) {
  if (!checks.length) return null;
  const settled = checks.filter((c) => !c.query?.isLoading && !c.query?.isError);
  const attention = settled.filter((c) => !c.ok).length;
  return (
    <div>
      <p className="mb-2" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
        {attention === 0 ? 'All checks look good.' : `${attention} item${attention === 1 ? ' needs' : 's need'} attention.`}{' '}
        Leave, attendance and overtime decisions are captured when a run is opened, so if you change any of them, cancel and reopen this draft to include the change.
      </p>
      <ul className="list-unstyled m-0" aria-label="Before you run checklist">
        {checks.map((check) => <CheckRow key={check.key} check={check} />)}
      </ul>
    </div>
  );
}
