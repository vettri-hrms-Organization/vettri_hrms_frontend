import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarOff, CalendarDays, Clock3, FileText, ArrowRight, ClipboardCheck, WalletCards, LifeBuoy, Megaphone, AlertCircle } from 'lucide-react';
import { dashboardApi } from '../api/endpoints/dashboard';
import { holidaysApi, leaveRequestsApi } from '../api/endpoints/leave';
import { employeesApi } from '../api/endpoints/employees';
import { attendanceApi } from '../api/endpoints/attendance';
import { employeeSalaryApi } from '../api/endpoints/salary';
import Avatar from '../components/ui/Avatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { getDisplayName, getWelcomeGreeting } from '../utils/vettriMicrocopy';
import { toISTDateInputValue } from '../utils/formatDateTime';
import { AttendanceWidget, LeaveWidget, FinanceWidget } from './dashboard/components/EmployeeWidgets';
import AnnouncementsCard from './announcements/AnnouncementsCard';
import { AskVettriBox, SetupChecklist, TeamPulse, TodosCard } from './dashboard/components/HomeCards';

async function safeAuthorizedQuery(request, fallbackValue = null) {
  try {
    return await request();
  } catch (error) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return fallbackValue;
    }
    throw error;
  }
}

export default function Dashboard() {
  const { user, hasPermission, hasRole, hasAnyRole } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const firstName = getDisplayName(user).split(' ')[0] || '';
  const [rejectTarget, setRejectTarget] = useState(null);

  const isAdminDashboardUser = hasAnyRole(['SUPER_ADMIN', 'HR_ADMIN', 'COMPANY_ADMIN', 'MANAGER'])
    || hasPermission('EMPLOYEE_VIEW')
    || hasPermission('ATTENDANCE_VIEW')
    || hasPermission('LEAVE_VIEW')
    || hasPermission('LEAVE_APPROVE')
    || hasPermission('SALARY_VIEW')
    || hasPermission('REPORTS_VIEW');

  const canViewOrgSummary = hasPermission('EMPLOYEE_VIEW');

  const {
    data,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => safeAuthorizedQuery(dashboardApi.summary, null),
    enabled: canViewOrgSummary,
    retry: false,
  });

  const canViewApprovals = hasPermission('LEAVE_VIEW') || hasPermission('LEAVE_APPROVE');
  const canDecideLeave = hasPermission('LEAVE_APPROVE') || hasPermission('LEAVE_MANAGE');
  const isTeamScoped = hasPermission('LEAVE_APPROVE') && !hasPermission('LEAVE_MANAGE');

  const {
    data: pendingLeave,
    isLoading: pendingLeaveLoading,
    isError: pendingLeaveError,
    refetch: refetchPendingLeave,
  } = useQuery({
    queryKey: ['leave-requests', 'PENDING'],
    queryFn: () => safeAuthorizedQuery(() => leaveRequestsApi.list('PENDING'), []),
    enabled: canViewApprovals && !isTeamScoped,
    retry: false,
  });

  const {
    data: myTeam,
    isLoading: myTeamLoading,
    isError: myTeamError,
    refetch: refetchMyTeam,
  } = useQuery({
    queryKey: ['dashboard-my-team'],
    queryFn: () => safeAuthorizedQuery(dashboardApi.myTeam, { pendingApprovals: [] }),
    enabled: isTeamScoped,
    retry: false,
  });

  const approvalQueue = (isTeamScoped ? myTeam?.pendingApprovals : pendingLeave) || [];
  const approvalQueueLoading = isTeamScoped ? myTeamLoading : pendingLeaveLoading;
  const approvalQueueError = isTeamScoped ? myTeamError : pendingLeaveError;
  const refetchApprovalQueue = isTeamScoped ? refetchMyTeam : refetchPendingLeave;

  const { data: holidaysData, isLoading: holidaysLoading } = useQuery({
    queryKey: ['dashboard-holidays'],
    queryFn: () => safeAuthorizedQuery(holidaysApi.list, []),
    enabled: canViewOrgSummary,
    retry: false,
  });

  const decideLeave = useMutation({
    mutationFn: ({ id, approve }) => (approve ? leaveRequestsApi.approve(id) : leaveRequestsApi.reject(id)),
    onSuccess: (_result, { approve }) => {
      toast.success(approve ? 'Leave request approved.' : 'Leave request rejected.');
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-my-team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update the leave request.'),
  });

  const now = new Date();
  const today = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const greeting = getWelcomeGreeting(user, now);

  if (!isAdminDashboardUser && (user?.employeeId || hasRole('EMPLOYEE'))) {
    return <EmployeeDashboard employeeId={user?.employeeId} firstName={firstName} greeting={greeting} today={today} />;
  }

  const pendingCount = approvalQueue.length;
  const todayKey = toISTDateInputValue();
  const nextOrgHoliday = (Array.isArray(holidaysData) ? holidaysData : [])
    .filter((holiday) => typeof holiday.date === 'string' && holiday.date >= todayKey)
    .sort((first, second) => first.date.localeCompare(second.date))[0];

  // Leave approvals stay on the home page only while something is waiting; the to-do card covers the rest.
  const showApprovals = canViewApprovals && (approvalQueueLoading || approvalQueueError || pendingCount > 0);

  const peoplePanels = [
    canViewOrgSummary && (
      <section key="joiners" className="hz-dash__panel" aria-labelledby="dash-joiners-title">
        <PanelHeading id="dash-joiners-title" title="New joiners" />
        {summaryLoading ? <ListSkeleton rows={3} /> : (
          (data?.recentJoiners || []).length === 0 ? (
            <InlineEmpty icon={UserCheck} title="No recent joiners" description="Employees you add will appear here." />
          ) : (
            <ul className="hz-dash__list">
              {data.recentJoiners.map((employee) => (
                <li key={employee.id}>
                  <Link to={`/employees/${employee.id}`} className="hz-dash__person">
                    <Avatar name={employee.fullName} src={employee.profilePhotoUrl} size="sm" />
                    <span>
                      <strong>{employee.fullName}</strong>
                      <small>{[employee.designationTitle, employee.departmentName].filter(Boolean).join(' · ') || 'Employee'}</small>
                    </span>
                    <time dateTime={employee.dateOfJoining}>{formatShortDate(employee.dateOfJoining)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    ),
    canViewOrgSummary && (
      <section key="holiday" className="hz-dash__panel" aria-labelledby="dash-holiday-title">
        <PanelHeading
          id="dash-holiday-title"
          title="Next holiday"
          link={hasPermission('LEAVE_MANAGE') ? { to: '/settings/leave', label: 'Holiday calendar' } : null}
        />
        {holidaysLoading ? <ListSkeleton rows={1} /> : nextOrgHoliday ? (
          <div className="hz-dash__holiday">
            <span className="hz-dash__holiday-date" aria-hidden="true">
              <small>{new Date(`${nextOrgHoliday.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small>
              <strong>{new Date(`${nextOrgHoliday.date}T00:00:00`).getDate()}</strong>
            </span>
            <span>
              <strong>{nextOrgHoliday.name}</strong>
              <small>{new Date(`${nextOrgHoliday.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small>
            </span>
          </div>
        ) : (
          <InlineEmpty icon={CalendarDays} title="No upcoming holidays" description="Holidays added to the company calendar appear here." />
        )}
      </section>
    ),
  ].filter(Boolean);

  return (
    <div className="hz-dash">
      <header className="hz-dash__hero">
        <div className="hz-dash__hero-copy">
          <p className="hz-dash__eyebrow">{today}</p>
          <h1>{greeting}</h1>
        </div>
        <div className="hz-dash__hero-actions">
          {hasPermission('REPORTS_VIEW') && (
            <Link to="/reports" className="btn btn-light">
              <FileText size={16} aria-hidden="true" /> Reports
            </Link>
          )}
          {hasPermission('EMPLOYEE_CREATE') && (
            <Link to="/employees" className="btn btn-primary">
              <Users size={16} aria-hidden="true" /> Add employee
            </Link>
          )}
        </div>
      </header>

      <SetupChecklist />

      <div className="hz-dash__grid hz-dash__grid--main">
        <TodosCard />
        <AskVettriBox />
      </div>

      {canViewOrgSummary && (
        <WorkforceKpis
          data={data}
          loading={summaryLoading}
          error={summaryError}
          onRetry={refetchSummary}
        />
      )}

      {showApprovals && (
        <section className="hz-dash__panel" aria-labelledby="dash-approvals-title">
          <PanelHeading
            id="dash-approvals-title"
            title="Leave approvals"
            meta={approvalQueueLoading ? null : <span className="hz-dash__count">{pendingCount} pending</span>}
            link={pendingCount > 0 ? { to: '/leave', label: 'View all' } : null}
          />
          {approvalQueueLoading ? (
            <ListSkeleton rows={3} />
          ) : approvalQueueError ? (
            <InlineError message="Leave requests could not be loaded." onRetry={() => refetchApprovalQueue()} />
          ) : pendingCount === 0 ? (
            <InlineEmpty icon={ClipboardCheck} title="You're all caught up" description="New leave requests will appear here for review." />
          ) : (
            <ul className="hz-dash__list">
              {approvalQueue.slice(0, 5).map((request) => (
                <li className="hz-dash__approval" key={request.id}>
                  <Avatar name={request.employeeName} size="sm" />
                  <div className="hz-dash__approval-copy">
                    <strong>{request.employeeName}</strong>
                    <small>
                      {request.leaveTypeName} · {formatLeaveRange(request.startDate, request.endDate)}
                      {request.days ? ` · ${request.days} day${request.days === 1 ? '' : 's'}` : ''}
                    </small>
                  </div>
                  {canDecideLeave && (
                    <div className="hz-dash__approval-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setRejectTarget(request)}
                        disabled={decideLeave.isPending}
                        aria-label={`Reject leave request from ${request.employeeName}`}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => decideLeave.mutate({ id: request.id, approve: true })}
                        disabled={decideLeave.isPending}
                        aria-label={`Approve leave request from ${request.employeeName}`}
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canViewOrgSummary && data && data.totalEmployees > 0 && (
        <WorkforceOverview data={data} />
      )}

      <TeamPulse showBirthdays extra={peoplePanels} />

      <AnnouncementsCard />

      <ConfirmDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => decideLeave.mutate({ id: rejectTarget.id, approve: false })}
        loading={decideLeave.isPending}
        title="Reject leave request?"
        description={rejectTarget ? `${rejectTarget.employeeName} · ${rejectTarget.leaveTypeName} · ${formatLeaveRange(rejectTarget.startDate, rejectTarget.endDate)}` : undefined}
        confirmLabel="Reject request"
      />
    </div>
  );
}

function PanelHeading({ id, title, meta = null, link = null }) {
  return (
    <div className="hz-dash__panel-heading">
      <h2 id={id}>{title}</h2>
      <div className="hz-dash__panel-meta">
        {meta}
        {link && <Link to={link.to} className="hz-dash__link">{link.label} <ArrowRight size={14} aria-hidden="true" /></Link>}
      </div>
    </div>
  );
}

function WorkforceKpis({ data, loading, error, onRetry }) {
  if (error) {
    return (
      <section className="hz-dash__panel hz-dash__kpis-error" aria-label="Workforce metrics">
        <InlineError message="Workforce metrics could not be loaded." onRetry={() => onRetry()} />
      </section>
    );
  }

  const total = data?.totalEmployees || 0;
  const departments = data?.departmentBreakdown?.length || 0;
  const share = (value) => (total ? `${Math.round((value / total) * 100)}% of workforce` : '');
  const kpis = [
    { label: 'Total employees', value: data?.totalEmployees, icon: Users, note: total ? `Across ${departments} department${departments === 1 ? '' : 's'}` : 'No employees yet' },
    { label: 'Active', value: data?.activeEmployees, icon: UserCheck, note: share(data?.activeEmployees || 0), tone: 'success' },
    { label: 'On leave', value: data?.onLeave, icon: CalendarOff, note: share(data?.onLeave || 0), tone: 'warning' },
    { label: 'Notice period', value: data?.noticePeriod, icon: Clock3, note: data?.noticePeriod ? 'Serving notice' : 'No one serving notice', tone: 'info' },
  ];

  return (
    <section className="hz-dash__kpis" aria-label="Workforce metrics" aria-busy={loading}>
      {kpis.map(({ label, value, icon: Icon, note, tone }) => (
        <article className={`hz-dash__kpi${tone ? ` hz-dash__kpi--${tone}` : ''}`} key={label}>
          <div className="hz-dash__kpi-top">
            <span>{label}</span>
            <span className="hz-dash__kpi-icon" aria-hidden="true"><Icon size={16} /></span>
          </div>
          {loading ? (
            <span className="hz-dash__skeleton hz-dash__skeleton--kpi" aria-hidden="true" />
          ) : (
            <strong><AnimatedNumber value={value ?? 0} /></strong>
          )}
          <small>{loading ? ' ' : note}</small>
        </article>
      ))}
    </section>
  );
}

function WorkforceOverview({ data }) {
  const total = data.totalEmployees;
  const exited = (data.resigned || 0) + (data.terminated || 0);
  const segments = [
    { key: 'active', label: 'Active', value: data.activeEmployees || 0 },
    { key: 'leave', label: 'On leave', value: data.onLeave || 0 },
    { key: 'notice', label: 'Notice period', value: data.noticePeriod || 0 },
    { key: 'exited', label: 'Resigned or terminated', value: exited },
  ].filter((segment) => segment.value > 0);
  const departments = [...(data.departmentBreakdown || [])].sort((a, b) => b.count - a.count);
  const maxDepartment = departments[0]?.count || 1;

  return (
    <section className="hz-dash__panel" aria-labelledby="dash-workforce-title">
      <PanelHeading id="dash-workforce-title" title="Workforce overview" link={{ to: '/employees', label: 'View employees' }} />
      <div className="hz-dash__overview">
        <div>
          <h3 className="hz-dash__subheading">Employment status</h3>
          <div className="hz-dash__stack" role="img" aria-label={segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}>
            {segments.map((segment) => (
              <span key={segment.key} className={`hz-dash__stack-seg hz-dash__stack-seg--${segment.key}`} style={{ flexGrow: segment.value }} />
            ))}
          </div>
          <ul className="hz-dash__legend">
            {segments.map((segment) => (
              <li key={segment.key}>
                <i className={`hz-dash__stack-seg--${segment.key}`} aria-hidden="true" />
                <span>{segment.label}</span>
                <strong>{segment.value.toLocaleString('en-IN')}</strong>
                <small>{Math.round((segment.value / total) * 100)}%</small>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="hz-dash__subheading">Headcount by department</h3>
          {departments.length === 0 ? (
            <p className="hz-dash__muted">Assign employees to departments to see the breakdown.</p>
          ) : (
            <ul className="hz-dash__bars">
              {departments.slice(0, 8).map((department) => (
                <li key={department.departmentName}>
                  <span className="hz-dash__bar-label">{department.departmentName}</span>
                  <span className="hz-dash__bar-track" aria-hidden="true">
                    <span className="hz-dash__bar-fill" style={{ width: `${(department.count / maxDepartment) * 100}%` }} />
                  </span>
                  <strong>{department.count}</strong>
                </li>
              ))}
              {departments.length > 8 && (
                <li className="hz-dash__muted">+{departments.length - 8} more department{departments.length - 8 === 1 ? '' : 's'}</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ListSkeleton({ rows = 3 }) {
  return (
    <div className="hz-dash__list-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => <span key={index} className="hz-dash__skeleton" />)}
    </div>
  );
}

function InlineEmpty({ icon: Icon, title, description }) {
  return (
    <div className="hz-dash__empty">
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

function InlineError({ message, onRetry }) {
  return (
    <div className="hz-dash__empty hz-dash__empty--error" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <strong>{message}</strong>
        <small>Check your connection and try again.</small>
      </div>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRetry}>Retry</button>
    </div>
  );
}

function formatShortDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatLeaveRange(start, end) {
  if (!start) return '';
  if (!end || end === start) return formatShortDate(start);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** "In at 9:31 AM · 3h 12m so far" for the Home "Today" card, from the day's web/WFH/tray session. */
function todayAttendanceDetail(session, hasCheckedIn, hasCheckedOut) {
  const checkIn = session?.checkInTime ? new Date(session.checkInTime) : null;
  if (!checkIn || Number.isNaN(checkIn.getTime())) {
    return hasCheckedIn ? (hasCheckedOut ? 'Attendance complete' : 'Have a productive day') : 'Tap to check in';
  }
  const end = session.checkOutTime ? new Date(session.checkOutTime) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - checkIn.getTime()) / 60000));
  const worked = `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
  const inAt = checkIn.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return session.checkOutTime ? `In at ${inAt} · ${worked} worked` : `In at ${inAt} · ${worked} so far`;
}

function EmployeeDashboard({ employeeId, firstName, greeting, today }) {
  const year = new Date().getFullYear();
  const { data: employee } = useQuery({
    queryKey: ['employee-dashboard-profile', employeeId],
    queryFn: () => safeAuthorizedQuery(() => employeesApi.getById(employeeId), null),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['employee-dashboard-attendance', employeeId],
    queryFn: () => safeAuthorizedQuery(() => attendanceApi.byEmployee(employeeId), []),
    enabled: !!employeeId,
    retry: false,
  });
  // Biometric punches come from byEmployee; browser/WFH check-ins are sessions from /today.
  const { data: todaySession } = useQuery({
    queryKey: ['employee-dashboard-today-session', employeeId],
    queryFn: () => safeAuthorizedQuery(() => attendanceApi.today(), null),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: leaveBalanceData, isLoading: leaveLoading } = useQuery({
    queryKey: ['employee-dashboard-leave-balance', employeeId, year],
    queryFn: () => safeAuthorizedQuery(() => leaveRequestsApi.balance(employeeId, year), []),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: leaveRequestsData } = useQuery({
    queryKey: ['employee-dashboard-leave', employeeId],
    queryFn: () => safeAuthorizedQuery(() => leaveRequestsApi.byEmployee(employeeId), []),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: salary } = useQuery({
    queryKey: ['employee-dashboard-salary', employeeId],
    queryFn: () => safeAuthorizedQuery(() => employeeSalaryApi.getDetail(employeeId), null),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: holidaysData, isLoading: holidaysLoading, isError: holidaysError } = useQuery({
    queryKey: ['employee-dashboard-holidays'],
    queryFn: () => safeAuthorizedQuery(holidaysApi.list, []),
    enabled: !!employeeId,
    retry: false,
  });
  const attendance = Array.isArray(attendanceData) ? attendanceData : [];
  const leaveBalance = Array.isArray(leaveBalanceData) ? leaveBalanceData : [];
  const leaveRequests = Array.isArray(leaveRequestsData) ? leaveRequestsData : [];
  const holidays = Array.isArray(holidaysData) ? holidaysData : [];
  // punchTime is a UTC instant; "today" means today in IST, not UTC.
  const todayKey = toISTDateInputValue();
  const todayPunches = attendance.filter((record) => typeof record.punchTime === 'string' && toISTDateInputValue(record.punchTime) === todayKey);
  const session = todaySession && typeof todaySession === 'object' && todaySession.status ? todaySession : null;
  const hasCheckedIn = !!session || todayPunches.some((record) => record.punchType === 'IN');
  const hasCheckedOut = session?.status === 'CHECKED_OUT' || todayPunches.some((record) => record.punchType === 'OUT');
  const nextHoliday = holidays
    .filter((holiday) => typeof holiday.date === 'string' && holiday.date >= todayKey)
    .sort((first, second) => first.date.localeCompare(second.date))[0];
  const totalRemainingLeave = leaveBalance.reduce((total, item) => total + (item.remainingDays || 0), 0);

  return (
    <div className="hz-dashboard hz-dashboard--employee">
      <header className="hz-dash__hero">
        <div className="hz-dash__hero-copy">
          <p className="hz-dash__eyebrow">{today}</p>
          <h1>{greeting}</h1>
        </div>
        <div className="hz-dash__hero-actions">
          <Link to="/my-profile?tab=leave" className="btn btn-light">
            <CalendarOff size={16} aria-hidden="true" /> Request leave
          </Link>
        </div>
      </header>

      <div className="hz-dash__grid hz-dash__grid--main">
        <TodosCard />
        <AskVettriBox />
      </div>

      <section className="hz-dashboard__kpi-grid" aria-labelledby="employee-overview-title">
        <div className="hz-dashboard__section-heading">
          <div>
            <span className="hz-dashboard__section-kicker">At a glance</span>
            <h2 id="employee-overview-title">Your overview</h2>
          </div>
          <Link to="/my-profile" className="hz-dashboard__text-link">View profile <ArrowRight size={15} /></Link>
        </div>

        <div className="hz-dashboard__metric-grid">
          <Link to="/my-attendance" className="hz-dashboard__metric text-decoration-none" style={{ color: 'inherit' }} aria-label="Today's attendance - open My Attendance">
            <div className="hz-dashboard__metric-icon" style={{ color: 'var(--hz-primary-600)' }}><Clock3 size={19} /></div>
            <span>Today</span>
            <strong>{attendanceLoading ? '...' : hasCheckedOut ? 'Complete' : hasCheckedIn ? 'Checked in' : 'Not recorded'}</strong>
            <small>{todayAttendanceDetail(session, hasCheckedIn, hasCheckedOut)}</small>
          </Link>
          <article className="hz-dashboard__metric">
            <div className="hz-dashboard__metric-icon" style={{ color: 'var(--hz-success-500)' }}><CalendarOff size={19} /></div>
            <span>Leave balance</span>
            <strong>{leaveLoading ? '...' : `${totalRemainingLeave} days`}</strong>
            <small>{year} remaining across leave types</small>
          </article>
          <article className="hz-dashboard__metric">
            <div className="hz-dashboard__metric-icon" style={{ color: 'var(--hz-warning-500)' }}><WalletCards size={19} /></div>
            <span>My pay</span>
            <strong>{salary?.currentStructure ? 'Available' : 'Not set'}</strong>
            <small>{salary?.currentStructure ? 'View salary and payslips' : 'Contact HR for details'}</small>
          </article>
          <article className="hz-dashboard__metric">
            <div className="hz-dashboard__metric-icon" style={{ color: 'var(--hz-primary-600)' }}><CalendarDays size={19} /></div>
            <span>Next holiday</span>
            <strong>{nextHoliday?.name || 'None'}</strong>
            <small>{nextHoliday?.date ? new Date(`${nextHoliday.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Company calendar'}</small>
          </article>
        </div>
      </section>

        <section className="hz-dashboard__surface hz-dashboard__quick" aria-labelledby="employee-quick-actions-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Shortcuts</span>
              <h2 id="employee-quick-actions-title">Quick actions</h2>
            </div>
          </div>
          <div className="hz-dashboard__action-grid">
            <Link to="/my-profile"><UserCheck size={18} /><span>My profile</span></Link>
            <Link to="/my-attendance"><Clock3 size={18} /><span>My attendance</span></Link>
            <Link to="/my-profile?tab=leave"><CalendarOff size={18} /><span>Manage leave</span></Link>
            <Link to="/my-payslip"><WalletCards size={18} /><span>View payslip</span></Link>
            <Link to="/helpdesk"><LifeBuoy size={18} /><span>Ask HR</span></Link>
            <Link to="/company"><Megaphone size={18} /><span>Company</span></Link>
          </div>
        </section>

      <div className="hz-dashboard__employee-widgets">
        <AttendanceWidget records={attendance} loading={attendanceLoading} />
        <FinanceWidget salary={salary} />
      </div>

      <LeaveWidget
        balances={leaveBalance}
        requests={leaveRequests}
        loading={leaveLoading}
        year={year}
        holidays={holidays}
        holidaysLoading={holidaysLoading}
        holidaysError={holidaysError}
      />

      <AnnouncementsCard />

      <TeamPulse showBirthdays />

      <div className="hz-dash__grid hz-dash__grid--main">
        <section className="hz-dashboard__surface" aria-labelledby="employee-record-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Your record</span>
              <h2 id="employee-record-title">Employee details</h2>
            </div>
          </div>
          <div className="d-flex align-items-center gap-3 p-3" style={{ background: 'var(--hz-gray-50)', borderRadius: 10 }}>
            <Avatar name={employee?.fullName || firstName} src={employee?.profilePhotoUrl} size="lg" />
            <div>
              <strong>{employee?.fullName || firstName || 'Employee'}</strong>
              <small className="d-block text-secondary-hz">
                {employee?.designationTitle || 'Employee'}
                {employee?.departmentName ? ` · ${employee.departmentName}` : ''}
              </small>
            </div>
          </div>
          <Link to="/my-profile" className="hz-dashboard__text-link mt-3 d-inline-flex">Open my profile <ArrowRight size={15} /></Link>
        </section>

        <section className="hz-dashboard__surface" aria-labelledby="employee-support-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <h2 id="employee-support-title">Need a hand?</h2>
            </div>
            <LifeBuoy size={20} aria-hidden="true" />
          </div>
          <p className="text-secondary-hz mb-3">Raise a ticket with HR for questions about pay, leave, or your employee record.</p>
          <Link to="/helpdesk" className="hz-dashboard__text-link">Open HR helpdesk <ArrowRight size={15} /></Link>
        </section>
      </div>
    </div>
  );
}
