import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarOff, CalendarDays, Clock3, FileText, ArrowRight, ClipboardCheck, AlertCircle } from 'lucide-react';
import { dashboardApi } from '../api/endpoints/dashboard';
import { holidaysApi, leaveRequestsApi } from '../api/endpoints/leave';
import { employeesApi } from '../api/endpoints/employees';
import { attendanceApi } from '../api/endpoints/attendance';
import { dailyAttendanceApi } from '../api/endpoints/shifts';
import { employeeSalaryApi } from '../api/endpoints/salary';
import { homeApi } from '../api/endpoints/home';
import Avatar from '../components/ui/Avatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { getDisplayName, getWelcomeGreeting } from '../utils/vettriMicrocopy';
import { toISTDateInputValue } from '../utils/formatDateTime';
import { weekStart } from './attendance/shiftUtils';
import {
  ApprovalsCard, EmployeeGreeting, HolidaysPanel, LeaveCard, PayslipCard, QuickLinksPanel, WeekCard,
} from './dashboard/components/EmployeeWidgets';
import AnnouncementsCard from './announcements/AnnouncementsCard';
import { AskVettriBox, SetupChecklist, TeamPulse, TodosCard } from './dashboard/components/HomeCards';
import './dashboard/employee-home.css';

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

/** "In at 9:31 AM · 3h 12m so far" for the Home "Today" status, from the day's web/WFH/tray session. */
function todayAttendanceDetail(session, hasCheckedIn, hasCheckedOut) {
  const checkIn = session?.checkInTime ? new Date(session.checkInTime) : null;
  if (!checkIn || Number.isNaN(checkIn.getTime())) {
    return hasCheckedIn ? (hasCheckedOut ? 'Attendance complete for today' : 'Have a productive day') : null;
  }
  const end = session.checkOutTime ? new Date(session.checkOutTime) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - checkIn.getTime()) / 60000));
  const worked = `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
  const inAt = checkIn.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return session.checkOutTime ? `In at ${inAt} · ${worked} worked` : `In at ${inAt} · ${worked} so far`;
}

/** Same permissions that show the Approvals inbox in the menu. */
const APPROVER_PERMISSIONS = ['LEAVE_APPROVE', 'LEAVE_MANAGE', 'ATTENDANCE_MANAGE', 'OVERTIME_APPROVE', 'EXPENSE_APPROVE', 'EXPENSE_MANAGE', 'EMPLOYEE_MANAGE', 'TIMESHEET_APPROVE', 'SALARY_MANAGE'];

/**
 * Employee home: greeting with today's shift and check-in state, one row of key cards, then
 * to-dos, holidays, announcements and the team pulse as plain panels.
 */
function EmployeeDashboard({ employeeId, firstName, greeting, today }) {
  const { hasPermission } = useAuth();
  const canViewPayslip = hasPermission('SELF_PAYSLIP_VIEW');
  const canApprove = APPROVER_PERMISSIONS.some((permission) => hasPermission(permission));
  const year = new Date().getFullYear();
  // punchTime is a UTC instant; "today" means today in IST, not UTC.
  const todayKey = toISTDateInputValue();
  const monday = weekStart(todayKey);

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
  const { data: todaySession, isLoading: sessionLoading } = useQuery({
    queryKey: ['employee-dashboard-today-session', employeeId],
    queryFn: () => safeAuthorizedQuery(() => attendanceApi.today(), null),
    enabled: !!employeeId,
    retry: false,
  });
  // Shift-aware daily attendance for Monday..today; same cache entry My Attendance's week strip uses,
  // so checking in there refreshes it here. null means the account can't read attendance.
  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['attendance-daily-me', monday, todayKey],
    queryFn: () => safeAuthorizedQuery(() => dailyAttendanceApi.mine(monday, todayKey), null),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: leaveBalanceData, isLoading: leaveLoading } = useQuery({
    queryKey: ['employee-dashboard-leave-balance', employeeId, year],
    queryFn: () => safeAuthorizedQuery(() => leaveRequestsApi.balance(employeeId, year), []),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: leaveRequestsData, isLoading: leaveRequestsLoading } = useQuery({
    queryKey: ['employee-dashboard-leave', employeeId],
    queryFn: () => safeAuthorizedQuery(() => leaveRequestsApi.byEmployee(employeeId), []),
    enabled: !!employeeId,
    retry: false,
  });
  const { data: salary, isLoading: salaryLoading } = useQuery({
    queryKey: ['employee-dashboard-salary', employeeId],
    queryFn: () => safeAuthorizedQuery(() => employeeSalaryApi.getDetail(employeeId), null),
    enabled: !!employeeId && canViewPayslip,
    retry: false,
  });
  const { data: holidaysData, isLoading: holidaysLoading, isError: holidaysError } = useQuery({
    queryKey: ['employee-dashboard-holidays'],
    queryFn: () => safeAuthorizedQuery(holidaysApi.list, []),
    enabled: !!employeeId,
    retry: false,
  });
  // Shares the to-do card's cache entry, so approvers get their count without a second request.
  const { data: todos, isLoading: todosLoading, isError: todosError } = useQuery({
    queryKey: ['home-todos'],
    queryFn: homeApi.todos,
    staleTime: 30_000,
    enabled: canApprove,
  });

  const attendance = Array.isArray(attendanceData) ? attendanceData : [];
  const leaveBalance = Array.isArray(leaveBalanceData) ? leaveBalanceData : [];
  const leaveRequests = Array.isArray(leaveRequestsData) ? leaveRequestsData : [];
  const holidays = Array.isArray(holidaysData) ? holidaysData : [];
  const weekDays = Array.isArray(weekData) ? weekData : [];
  const weekUnavailable = !weekLoading && !Array.isArray(weekData);
  const shiftToday = weekDays.find((day) => String(day.date).slice(0, 10) === todayKey) || null;
  const todayPunches = attendance.filter((record) => typeof record.punchTime === 'string' && toISTDateInputValue(record.punchTime) === todayKey);
  const session = todaySession && typeof todaySession === 'object' && todaySession.status ? todaySession : null;
  const hasCheckedIn = !!session || todayPunches.some((record) => record.punchType === 'IN') || !!shiftToday?.firstIn;
  const hasCheckedOut = session?.status === 'CHECKED_OUT' || todayPunches.some((record) => record.punchType === 'OUT');

  return (
    <div className="hz-emp-home">
      <EmployeeGreeting
        greeting={greeting}
        today={today}
        employee={employee}
        firstName={firstName}
        hasCheckedIn={hasCheckedIn}
        hasCheckedOut={hasCheckedOut}
        attendanceDetail={todayAttendanceDetail(session, hasCheckedIn, hasCheckedOut)}
        attendanceLoading={!!employeeId && (attendanceLoading || sessionLoading)}
        shiftToday={shiftToday}
        shiftLoading={!!employeeId && weekLoading}
        shiftAvailable={!weekUnavailable}
      />

      <div className="hz-emp-home__cards" aria-label="Your overview" role="group">
        <LeaveCard balances={leaveBalance} requests={leaveRequests} loading={!!employeeId && (leaveLoading || leaveRequestsLoading)} year={year} />
        <WeekCard days={weekDays} loading={!!employeeId && weekLoading} unavailable={weekUnavailable} monday={monday} today={todayKey} />
        {canViewPayslip && <PayslipCard salary={salary} loading={!!employeeId && salaryLoading} />}
        {canApprove && <ApprovalsCard todos={todos} loading={todosLoading} error={todosError} />}
      </div>

      <div className="hz-dash__grid hz-dash__grid--main">
        <TodosCard />
        <AskVettriBox />
      </div>

      <div className="hz-dash__grid hz-dash__grid--main">
        <HolidaysPanel holidays={holidays} loading={!!employeeId && holidaysLoading} error={holidaysError} today={todayKey} />
        <QuickLinksPanel canViewPayslip={canViewPayslip} />
      </div>

      <AnnouncementsCard />

      <TeamPulse showBirthdays />
    </div>
  );
}
