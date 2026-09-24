import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarOff, CalendarDays, Clock3, Inbox, FileText, ArrowRight, ClipboardCheck, Sparkles, BarChart3, BriefcaseBusiness, Settings2, WalletCards, TrendingUp, LifeBuoy } from 'lucide-react';
import { dashboardApi } from '../api/endpoints/dashboard';
import { holidaysApi, leaveRequestsApi } from '../api/endpoints/leave';
import { documentsApi, DOCUMENT_TYPE_LABEL } from '../api/endpoints/documents';
import { employeesApi } from '../api/endpoints/employees';
import { attendanceApi } from '../api/endpoints/attendance';
import { employeeSalaryApi } from '../api/endpoints/salary';
import { selfServiceApi } from '../api/endpoints/selfService';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { EmployeeMetric, AttendanceWidget, LeaveWidget, FinanceWidget } from './dashboard/components/EmployeeWidgets';

export default function Dashboard() {
  const { user, hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const firstName = user?.fullName?.split(' ')[0];

  const canViewOrgSummary = hasPermission('EMPLOYEE_VIEW');

  const { data } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.summary,
    enabled: canViewOrgSummary,
  });

  const canViewApprovals = hasPermission('LEAVE_VIEW') || hasPermission('LEAVE_APPROVE');
  const isTeamScoped = hasPermission('LEAVE_APPROVE') && !hasPermission('LEAVE_MANAGE');

  const {
    data: pendingLeave,
    isLoading: pendingLeaveLoading,
    isError: pendingLeaveError,
    refetch: refetchPendingLeave,
  } = useQuery({
    queryKey: ['leave-requests', 'PENDING'],
    queryFn: () => leaveRequestsApi.list('PENDING'),
    enabled: canViewApprovals && !isTeamScoped,
  });

  const {
    data: myTeam,
    isLoading: myTeamLoading,
    isError: myTeamError,
    refetch: refetchMyTeam,
  } = useQuery({
    queryKey: ['dashboard-my-team'],
    queryFn: dashboardApi.myTeam,
    enabled: isTeamScoped,
  });

  const approvalQueue = isTeamScoped ? myTeam?.pendingApprovals : pendingLeave;
  const approvalQueueLoading = isTeamScoped ? myTeamLoading : pendingLeaveLoading;
  const approvalQueueError = isTeamScoped ? myTeamError : pendingLeaveError;
  const refetchApprovalQueue = isTeamScoped ? refetchMyTeam : refetchPendingLeave;

  const canViewExpiringDocs = hasPermission('EMPLOYEE_MANAGE');
  const {
    data: expiringDocs,
    isLoading: expiringDocsLoading,
    isError: expiringDocsError,
    refetch: refetchExpiringDocs,
  } = useQuery({
    queryKey: ['documents-expiring-soon'],
    queryFn: () => documentsApi.expiringSoon(30),
    enabled: canViewExpiringDocs,
  });

  const { data: holidaysData } = useQuery({
    queryKey: ['dashboard-holidays'],
    queryFn: holidaysApi.list,
    enabled: canViewOrgSummary,
  });

  const decideLeave = useMutation({
    mutationFn: ({ id, approve }) => (approve ? leaveRequestsApi.approve(id) : leaveRequestsApi.reject(id)),
    onSuccess: () => {
      toast.success('Leave request updated.');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-my-team'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update the leave request.'),
  });

  const pendingCount = approvalQueue?.length || 0;
  const expiringCount = expiringDocs?.length || 0;
  const kpis = data
    ? [
        { label: 'Total Employees', value: data.totalEmployees, icon: Users, accent: 'var(--hz-primary-600)' },
        { label: 'Active', value: data.activeEmployees, icon: UserCheck, accent: 'var(--hz-success-500)' },
        { label: 'On Leave', value: data.onLeave, icon: CalendarOff, accent: 'var(--hz-warning-500)' },
        { label: 'Pending Actions', value: pendingCount, icon: ClipboardCheck, accent: 'var(--hz-primary-600)' },
      ]
    : [];

  const now = new Date();
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  if (hasRole('EMPLOYEE')) {
    return <EmployeeDashboard employeeId={user?.employeeId} firstName={firstName} greeting={greeting} today={today} />;
  }

  const attentionItems = [
    { label: 'Leave requests', count: pendingCount, detail: pendingCount ? 'Waiting for review' : 'All requests are up to date', icon: CalendarOff, to: '/leave' },
    { label: 'Attendance exceptions', count: null, detail: 'Review attendance records', icon: Clock3, to: '/attendance' },
    { label: 'Employee documents', count: expiringCount, detail: expiringCount ? 'Expiring within 30 days' : 'No documents need attention', icon: FileText, to: '/employees' },
  ];

  const todayKeyAdmin = now.toISOString().slice(0, 10);
  const holidaysList = Array.isArray(holidaysData) ? holidaysData : [];
  const nextOrgHoliday = holidaysList
    .filter((holiday) => typeof holiday.date === 'string' && holiday.date >= todayKeyAdmin)
    .sort((first, second) => first.date.localeCompare(second.date))[0];

  const modules = [
    { title: 'Workforce', description: 'Manage employees, profiles, and organization structure.', icon: Users, to: '/employees' },
    { title: 'Attendance', description: 'Track attendance and workforce records.', icon: Clock3, to: '/attendance' },
    { title: 'Leave', description: 'Manage leave and time-off workflows.', icon: CalendarOff, to: '/leave' },
    { title: 'Payroll', description: 'Manage salary and payroll actions.', icon: WalletCards, to: '/salary', permission: 'SALARY_VIEW' },
    { title: 'Performance', description: 'View goals and reviews.', icon: TrendingUp, to: '/performance' },
    { title: 'Reports', description: 'Access workforce and HR reports.', icon: FileText, to: '/reports', permission: 'REPORTS_VIEW' },
    { title: 'Recruitment', description: 'Manage hiring stages and candidate pipelines.', icon: BriefcaseBusiness, to: '/recruitment', permission: 'RECRUITMENT_VIEW' },
    { title: 'Settings', description: 'Configure workspace preferences.', icon: Settings2, to: '/settings/organization', permission: 'ORG_VIEW' },
  ].filter((module) => !module.permission || hasPermission(module.permission));

  return (
    <div className="hz-dashboard hz-dashboard--admin">
      <header className="hz-dashboard__hero">
        <div className="hz-dashboard__hero-copy">
          <p className="hz-dashboard__eyebrow">{today}</p>
          <h1>{greeting}, {firstName || 'there'}</h1>
          <p>Here&apos;s what&apos;s happening across your workspace today.</p>
        </div>
        <div className="hz-dashboard__hero-meta">
          <div className="hz-dashboard__hero-pill">
            <span>Active workforce</span>
            <strong>{data?.activeEmployees ?? '--'}</strong>
          </div>
          <div className="hz-dashboard__hero-badge">
            <TrendingUp size={15} />
            {pendingCount ? `${pendingCount} action${pendingCount === 1 ? '' : 's'} to triage` : 'Everything is current'}
          </div>
        </div>
      </header>

      <section className="hz-dashboard__kpi-grid" aria-labelledby="workforce-metrics-title">
        <div className="hz-dashboard__section-heading">
          <div>
            <span className="hz-dashboard__section-kicker">At a glance</span>
            <h2 id="workforce-metrics-title">Workforce metrics</h2>
          </div>
          <Link to="/employees" className="hz-dashboard__text-link">View workforce <ArrowRight size={15} /></Link>
        </div>

        <div className="hz-dashboard__metric-grid">
          {(data ? kpis : [
            { label: 'Total Employees', value: '--', icon: Users, accent: 'var(--hz-primary-600)' },
            { label: 'Active', value: '--', icon: UserCheck, accent: 'var(--hz-primary-600)' },
            { label: 'On Leave', value: '--', icon: CalendarOff, accent: 'var(--hz-primary-600)' },
            { label: 'Pending Actions', value: '--', icon: ClipboardCheck, accent: 'var(--hz-primary-600)' },
          ]).map(({ label, value, icon: Icon, accent }) => (
            <article className="hz-dashboard__metric" key={label}>
              <div className="hz-dashboard__metric-icon" style={{ color: accent }}><Icon size={19} /></div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>
                {label === 'Active' && data
                  ? `${data.totalEmployees ? ((data.activeEmployees / data.totalEmployees) * 100).toFixed(1) : 0}% of workforce`
                  : label === 'On Leave'
                    ? (data?.onLeave ? 'Today' : 'No leave recorded today')
                    : label === 'Pending Actions'
                      ? (pendingCount ? 'Requires attention' : 'All caught up')
                      : (data?.totalEmployees ? 'Current workforce' : 'No employees yet')}
              </small>
            </article>
          ))}
        </div>
      </section>

      <div className="hz-dashboard__overview-grid">
        <section className="hz-dashboard__surface" aria-labelledby="attention-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Action queue</span>
              <h2 id="attention-title">Needs your attention</h2>
            </div>
            <span className="hz-dashboard__count-badge">{pendingCount} pending</span>
          </div>
          <div className="hz-dashboard__attention-list">
            {attentionItems.map(({ label, count, detail, icon: Icon, to }) => (
              <Link to={to} className="hz-dashboard__attention-row" key={label}>
                <span className="hz-dashboard__row-icon"><Icon size={18} /></span>
                <span className="hz-dashboard__row-copy">
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <span className={`hz-dashboard__row-count ${count === 0 ? 'is-clear' : ''}`}>{count === null ? 'View' : count}</span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>

        <section className="hz-dashboard__surface" aria-labelledby="quick-actions-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Shortcuts</span>
              <h2 id="quick-actions-title">Quick actions</h2>
            </div>
          </div>
          <div className="hz-dashboard__action-grid">
            <Link to="/employees"><Users size={18} /><span>Manage employees</span></Link>
            <Link to="/employees/import"><Inbox size={18} /><span>Import employees</span></Link>
            <Link to="/leave"><CalendarOff size={18} /><span>Manage leave</span></Link>
            <Link to="/reports"><FileText size={18} /><span>Generate report</span></Link>
          </div>
        </section>
      </div>

      <section className="hz-dashboard__surface hz-dashboard__insights" aria-labelledby="insights-title">
        <div className="hz-dashboard__section-heading">
          <div>
            <span className="hz-dashboard__section-kicker">Workforce intelligence</span>
            <h2 id="insights-title">Workforce overview</h2>
          </div>
          <BarChart3 size={20} aria-hidden="true" />
        </div>
        <div className="hz-dashboard__empty-inline">
          <BarChart3 size={22} />
          <div>
            <strong>{data ? `${data.activeEmployees} employees currently active` : 'Insights will appear as your workforce grows'}</strong>
            <small>{data ? `On leave: ${data.onLeave}. Pending actions: ${pendingCount}.` : 'Connect attendance, leave, and employee data to see trends here.'}</small>
          </div>
        </div>
      </section>

      <div className="hz-dashboard__three-col">
        <section className="hz-dashboard__surface" aria-labelledby="holiday-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Plan ahead</span>
              <h2 id="holiday-title">Upcoming holiday</h2>
            </div>
          </div>
          {nextOrgHoliday ? (
            <div className="hz-dashboard__holiday">
              <span>{new Date(`${nextOrgHoliday.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <strong>{nextOrgHoliday.name}</strong>
              <small>Next holiday on the company calendar</small>
              <Link to="/reports">View holiday calendar <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="hz-dashboard__holiday hz-dashboard__holiday--empty">
              <span>No upcoming holidays</span>
              <strong>Holiday calendar</strong>
              <small>Add company holidays to see them here.</small>
              <Link to="/reports">View calendar <ArrowRight size={14} /></Link>
            </div>
          )}
        </section>

        <section className="hz-dashboard__surface" aria-labelledby="updates-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Company feed</span>
              <h2 id="updates-title">Recent activity</h2>
            </div>
          </div>
          <div className="hz-dashboard__mini-list">
            <div className="hz-dashboard__mini-item">
              <span className="hz-dashboard__mini-bullet" />
              <div><strong>Leave review</strong><small>{pendingCount ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} waiting for decision` : 'No pending leave approvals'}</small></div>
            </div>
            <div className="hz-dashboard__mini-item">
              <span className="hz-dashboard__mini-bullet hz-dashboard__mini-bullet--muted" />
              <div><strong>Documents</strong><small>{expiringCount ? `${expiringCount} items need attention` : 'No document expiries in the next 30 days'}</small></div>
            </div>
          </div>
        </section>

        <section className="hz-dashboard__surface" aria-labelledby="support-strip-title">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Need a hand?</span>
              <h2 id="support-strip-title">Support center</h2>
            </div>
          </div>
          <div className="hz-dashboard__support-compact">
            <p>Reach the right team for your Vettri HRMS questions.</p>
            <Link to="/support" className="hz-dashboard__text-link">Open support info <ArrowRight size={15} /></Link>
          </div>
        </section>
      </div>

      <section className="hz-dashboard__quicklinks" aria-labelledby="quicklinks-title">
        <div className="hz-dashboard__section-heading">
          <div>
            <span className="hz-dashboard__section-kicker">Workspace</span>
            <h2 id="quicklinks-title">More in Vettri HRMS</h2>
          </div>
        </div>
        <div className="hz-dashboard__quicklinks-row">
          {modules.map(({ title, icon: Icon, to }) => (
            <Link to={to} className="hz-dashboard__quicklink" key={title}>
              <Icon size={16} /><span>{title}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmployeeDashboard({ employeeId, firstName, greeting, today }) {
  const year = new Date().getFullYear();
  const { data: employee } = useQuery({
    queryKey: ['employee-dashboard-profile', employeeId],
    queryFn: () => employeesApi.getById(employeeId),
    enabled: !!employeeId,
  });
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['employee-dashboard-attendance', employeeId],
    queryFn: () => attendanceApi.byEmployee(employeeId),
    enabled: !!employeeId,
  });
  const { data: leaveBalanceData, isLoading: leaveLoading } = useQuery({
    queryKey: ['employee-dashboard-leave-balance', employeeId, year],
    queryFn: () => leaveRequestsApi.balance(employeeId, year),
    enabled: !!employeeId,
  });
  const { data: leaveRequestsData } = useQuery({
    queryKey: ['employee-dashboard-leave', employeeId],
    queryFn: () => leaveRequestsApi.byEmployee(employeeId),
    enabled: !!employeeId,
  });
  const { data: documentsData } = useQuery({
    queryKey: ['employee-dashboard-documents', employeeId],
    queryFn: () => documentsApi.byEmployee(employeeId),
    enabled: !!employeeId,
  });
  const { data: salary } = useQuery({
    queryKey: ['employee-dashboard-salary', employeeId],
    queryFn: () => employeeSalaryApi.getDetail(employeeId),
    enabled: !!employeeId,
  });
  const { data: holidaysData } = useQuery({
    queryKey: ['employee-dashboard-holidays'],
    queryFn: holidaysApi.list,
    enabled: !!employeeId,
  });
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: selfServiceApi.notifications,
    enabled: !!employeeId,
  });

  const attendance = Array.isArray(attendanceData) ? attendanceData : [];
  const leaveBalance = Array.isArray(leaveBalanceData) ? leaveBalanceData : [];
  const leaveRequests = Array.isArray(leaveRequestsData) ? leaveRequestsData : [];
  const documents = Array.isArray(documentsData) ? documentsData : [];
  const holidays = Array.isArray(holidaysData) ? holidaysData : [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPunches = attendance.filter((record) => typeof record.punchTime === 'string' && record.punchTime.slice(0, 10) === todayKey);
  const hasCheckedIn = todayPunches.some((record) => record.punchType === 'IN');
  const hasCheckedOut = todayPunches.some((record) => record.punchType === 'OUT');
  const nextHoliday = holidays
    .filter((holiday) => typeof holiday.date === 'string' && holiday.date >= todayKey)
    .sort((first, second) => first.date.localeCompare(second.date))[0];
  const pendingLeave = leaveRequests.filter((request) => request.status === 'PENDING').length;
  const totalRemainingLeave = leaveBalance.reduce((total, item) => total + (item.remainingDays || 0), 0);
  const notifications = Array.isArray(notificationsData) ? notificationsData : [];
  const unreadNotifications = notifications.filter((notification) => !(notification.read_at || notification.readAt)).length;
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const nextLeaveBalance = leaveBalance[0];

  const services = [
    { title: 'My Profile', description: 'Keep your personal and employment details close at hand.', icon: UserCheck, to: '/my-profile' },
    { title: 'Attendance', description: 'Review your recorded punches and attendance history.', icon: Clock3, to: '/my-profile?tab=attendance' },
    { title: 'Leave', description: 'View balances and follow your leave requests.', icon: CalendarOff, to: '/my-profile?tab=leave' },
    { title: 'View Payslip', description: 'Access your salary details and payslip information.', icon: WalletCards, to: '/my-payslip' },
    { title: 'My Documents', description: 'Review the documents held on your employee record.', icon: FileText, to: '/my-profile?tab=documents' },
  ];

  return (
    <div className="hz-dashboard hz-dashboard--employee">
      <header className="hz-dashboard__hero">
        <div className="hz-dashboard__hero-copy">
          <p className="hz-dashboard__eyebrow">Home / Dashboard</p>
          <h1>Welcome {firstName || 'there'}!</h1>
          <p>Your daily workspace for attendance, time off, pay, and employee updates.</p>
        </div>
        <div className="hz-dashboard__hero-meta">
          <div className="hz-dashboard__hero-pill"><span>Today</span><strong>{today}</strong></div>
          <div className="hz-dashboard__hero-badge"><Clock3 size={15} /> {currentTime}</div>
        </div>
      </header>

      <section className="hz-dashboard__surface hz-dashboard__quick-access" aria-labelledby="employee-quick-access-title">
        <div className="hz-dashboard__section-heading">
          <div><span className="hz-dashboard__section-kicker">Your day</span><h2 id="employee-quick-access-title">Quick Access</h2></div>
          <span className="hz-dashboard__count-badge">{unreadNotifications} unread</span>
        </div>
        <div className="hz-dashboard__quick-access-grid">
          <Link to="/notifications" className="hz-dashboard__access-tile">
            <span className="hz-dashboard__access-tile-icon"><Inbox size={20} /></span>
            <span><strong>Inbox</strong><small>{unreadNotifications ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}` : 'You have no pending notifications'}</small></span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/reports" className="hz-dashboard__access-tile">
            <span className="hz-dashboard__access-tile-icon"><CalendarDays size={20} /></span>
            <span><strong>Holidays</strong><small>{nextHoliday ? `${nextHoliday.name} · ${new Date(`${nextHoliday.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No upcoming holidays'}</small></span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/my-profile?tab=attendance" className="hz-dashboard__access-tile">
            <span className="hz-dashboard__access-tile-icon"><Clock3 size={20} /></span>
            <span><strong>Time Today</strong><small>{hasCheckedOut ? 'Attendance complete' : hasCheckedIn ? 'Currently checked in' : 'No attendance recorded yet'}</small></span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/my-profile?tab=leave" className="hz-dashboard__access-tile">
            <span className="hz-dashboard__access-tile-icon"><CalendarOff size={20} /></span>
            <span><strong>Leave Balances</strong><small>{nextLeaveBalance ? `${nextLeaveBalance.remainingDays || 0} days remaining` : `${totalRemainingLeave} days remaining`}</small></span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/my-profile" className="hz-dashboard__access-tile">
            <span className="hz-dashboard__access-tile-icon"><UserCheck size={20} /></span>
            <span><strong>My Profile</strong><small>{employee?.designationTitle || 'View your employee record'}</small></span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/my-payslip" className="hz-dashboard__access-tile">
            <span className="hz-dashboard__access-tile-icon"><WalletCards size={20} /></span>
            <span><strong>My Pay</strong><small>{salary?.currentStructure ? 'Salary details available' : 'Salary details not configured'}</small></span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="hz-dashboard__employee-status-grid" aria-label="Employee overview">
        <EmployeeMetric icon={Clock3} label="Today" value={attendanceLoading ? '...' : hasCheckedOut ? 'Checked out' : hasCheckedIn ? 'Checked in' : 'Not recorded'} detail={hasCheckedIn ? (hasCheckedOut ? 'Attendance complete' : 'Have a productive day') : 'Your attendance status'} tone="blue" />
        <EmployeeMetric icon={CalendarOff} label="Leave balance" value={leaveLoading ? '...' : `${totalRemainingLeave} days`} detail={`${year} remaining across leave types`} tone="green" />
        <EmployeeMetric icon={WalletCards} label="My pay" value={salary?.currentStructure ? 'Available' : 'Not configured'} detail={salary?.currentStructure ? 'View salary and payslips' : 'Contact HR for details'} tone="gold" />
        <EmployeeMetric icon={CalendarDays} label="Next holiday" value={nextHoliday?.name || 'None scheduled'} detail={nextHoliday?.date ? new Date(`${nextHoliday.date}T00:00:00`).toLocaleDateString() : 'Company calendar'} tone="coral" />
      </section>
      <section className="hz-dashboard__explore" aria-labelledby="employee-services-title">
        <div className="hz-dashboard__section-heading"><div><span className="hz-dashboard__section-kicker">Employee services</span><h2 id="employee-services-title">Your workspace</h2></div></div>
        <div className="hz-dashboard__module-grid">
          {services.map(({ title, description, icon: Icon, to }) => (
            <Link to={to} className="hz-dashboard__module-card" key={title}>
              <span className="hz-dashboard__module-icon hz-dashboard__module-icon--blue"><Icon size={19} /></span>
              <span className="hz-dashboard__module-copy"><strong>{title}</strong><small>{description}</small></span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <div className="hz-dashboard__employee-widgets">
        <AttendanceWidget records={attendance} loading={attendanceLoading} />
        <LeaveWidget balances={leaveBalance} requests={leaveRequests} loading={leaveLoading} year={year} />
        <FinanceWidget salary={salary} />
      </div>
      <div className="hz-dashboard__primary-grid">
        <section className="hz-dashboard__surface" aria-labelledby="employee-actions-title">
          <div className="hz-dashboard__section-heading"><div><span className="hz-dashboard__section-kicker">Stay on track</span><h2 id="employee-actions-title">Pending actions</h2></div></div>
          <div className="hz-dashboard__attention-list">
            <Link to="/my-profile?tab=leave" className="hz-dashboard__attention-row"><span className="hz-dashboard__row-icon"><CalendarOff size={18} /></span><span className="hz-dashboard__row-copy"><strong>Leave requests</strong><small>{pendingLeave ? `${pendingLeave} request${pendingLeave === 1 ? '' : 's'} awaiting review` : 'No pending leave requests'}</small></span><ArrowRight size={16} /></Link>
            <Link to="/my-profile?tab=documents" className="hz-dashboard__attention-row"><span className="hz-dashboard__row-icon"><FileText size={18} /></span><span className="hz-dashboard__row-copy"><strong>Documents</strong><small>{documents.length ? `${documents.length} document${documents.length === 1 ? '' : 's'} on your record` : 'No documents on your record yet'}</small></span><ArrowRight size={16} /></Link>
          </div>
        </section>
        <section className="hz-dashboard__surface" aria-labelledby="employee-identity-title">
          <div className="hz-dashboard__section-heading"><div><span className="hz-dashboard__section-kicker">Your record</span><h2 id="employee-identity-title">Employee details</h2></div></div>
          <div className="d-flex align-items-center gap-3 p-3" style={{ background: 'var(--hz-gray-50)', borderRadius: 10 }}>
            <Avatar name={employee?.fullName || firstName} src={employee?.profilePhotoUrl} size="lg" />
            <div><strong>{employee?.fullName || firstName || 'Employee'}</strong><small className="d-block text-secondary-hz">{employee?.designationTitle || 'Employee'}{employee?.departmentName ? ` · ${employee.departmentName}` : ''}</small></div>
          </div>
          <Link to="/my-profile" className="hz-dashboard__text-link mt-3 d-inline-flex">Open my profile <ArrowRight size={15} /></Link>
        </section>
      </div>
      <section className="hz-dashboard__support-strip" aria-labelledby="employee-support-title">
        <div><span className="hz-dashboard__section-kicker">Need a hand?</span><h2 id="employee-support-title">Support information</h2><p>Reach the right team for your Vettri HRMS questions.</p></div>
        <Link to="/support" className="hz-dashboard__text-link">View support info <ArrowRight size={15} /></Link>
        <LifeBuoy size={28} aria-hidden="true" />
      </section>
    </div>
  );
}

