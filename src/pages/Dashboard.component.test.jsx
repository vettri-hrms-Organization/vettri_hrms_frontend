import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard.jsx';

const mocks = vi.hoisted(() => ({
  auth: null,
  toast: { success: vi.fn(), error: vi.fn() },
  dashboardApi: { summary: vi.fn(), myTeam: vi.fn() },
  leaveRequestsApi: { list: vi.fn(), approve: vi.fn(), reject: vi.fn(), balance: vi.fn(), byEmployee: vi.fn() },
  holidaysApi: { list: vi.fn() },
  documentsApi: { expiringSoon: vi.fn(), byEmployee: vi.fn() },
  notificationsApi: { inbox: vi.fn() },
  employeesApi: { getById: vi.fn() },
  attendanceApi: { byEmployee: vi.fn(), today: vi.fn() },
  dailyAttendanceApi: { mine: vi.fn() },
  employeeSalaryApi: { getDetail: vi.fn() },
  homeApi: { todos: vi.fn(), today: vi.fn(), setup: vi.fn() },
  announcementsApi: { feed: vi.fn() },
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../api/endpoints/dashboard', () => ({ dashboardApi: mocks.dashboardApi }));
vi.mock('../api/endpoints/leave', () => ({ leaveRequestsApi: mocks.leaveRequestsApi, holidaysApi: mocks.holidaysApi }));
vi.mock('../api/endpoints/documents', () => ({ documentsApi: mocks.documentsApi }));
vi.mock('../api/endpoints/notifications', () => ({ notificationsApi: mocks.notificationsApi }));
vi.mock('../api/endpoints/employees', () => ({ employeesApi: mocks.employeesApi }));
vi.mock('../api/endpoints/attendance', () => ({ attendanceApi: mocks.attendanceApi }));
vi.mock('../api/endpoints/shifts', () => ({ dailyAttendanceApi: mocks.dailyAttendanceApi }));
vi.mock('../api/endpoints/salary', () => ({ employeeSalaryApi: mocks.employeeSalaryApi }));
vi.mock('../api/endpoints/selfService', () => ({ selfServiceApi: { notifications: vi.fn() } }));
vi.mock('../api/endpoints/home', () => ({ homeApi: mocks.homeApi, askVettri: vi.fn() }));
vi.mock('../api/endpoints/announcements', () => ({ announcementsApi: mocks.announcementsApi }));

const SUMMARY = {
  totalEmployees: 42,
  activeEmployees: 36,
  onLeave: 3,
  noticePeriod: 2,
  resigned: 1,
  terminated: 0,
  departmentBreakdown: [
    { departmentName: 'Engineering', count: 20 },
    { departmentName: 'Sales', count: 12 },
  ],
  recentJoiners: [
    { id: 7, fullName: 'Priya Raman', designationTitle: 'Designer', departmentName: 'Product', dateOfJoining: '2026-10-20' },
  ],
  upcomingBirthdays: [{ employeeId: 9, fullName: 'Arun Kumar', dateOfBirth: '1990-11-14' }],
};

const PENDING = [
  { id: 101, employeeName: 'Meena Iyer', leaveTypeName: 'Casual Leave', startDate: '2026-11-03', endDate: '2026-11-04', days: 2 },
];

beforeEach(() => {
  mocks.homeApi.todos.mockReset().mockResolvedValue([]);
  mocks.homeApi.today.mockReset().mockResolvedValue({ outToday: [], birthdays: [], anniversaries: [], it: null });
  mocks.announcementsApi.feed.mockReset().mockResolvedValue([]);
  mocks.homeApi.setup.mockReset().mockResolvedValue({ visible: false, done: 0, total: 0, steps: [] });
});

function setAuth(permissions, roles = [], extraUser = {}) {
  mocks.auth = {
    user: { fullName: 'Lakshmi Nair', roles, ...extraUser },
    hasPermission: (permission) => permissions.includes(permission),
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (list) => list.some((role) => roles.includes(role)),
  };
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const HR_PERMISSIONS = ['EMPLOYEE_VIEW', 'EMPLOYEE_CREATE', 'EMPLOYEE_MANAGE', 'LEAVE_VIEW', 'LEAVE_APPROVE', 'LEAVE_MANAGE', 'REPORTS_VIEW'];

describe('Dashboard (admin)', () => {
  beforeEach(() => {
    mocks.dashboardApi.summary.mockReset().mockResolvedValue(SUMMARY);
    mocks.dashboardApi.myTeam.mockReset().mockResolvedValue({ pendingApprovals: [] });
    mocks.leaveRequestsApi.list.mockReset().mockResolvedValue(PENDING);
    mocks.leaveRequestsApi.approve.mockReset().mockResolvedValue({});
    mocks.leaveRequestsApi.reject.mockReset().mockResolvedValue({});
    mocks.holidaysApi.list.mockReset().mockResolvedValue([]);
    mocks.documentsApi.expiringSoon.mockReset().mockResolvedValue([]);
    mocks.notificationsApi.inbox.mockReset().mockResolvedValue({ items: [], unreadCount: 0 });
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
  });

  afterEach(() => cleanup());

  it('renders workforce metrics and lists from the summary API', async () => {
    setAuth(HR_PERMISSIONS, ['HR_ADMIN']);
    renderDashboard();

    const metrics = await screen.findByRole('region', { name: 'Workforce metrics' });
    await waitFor(() => expect(within(metrics).getByText('42')).toBeTruthy());
    expect(within(metrics).getByText('Across 2 departments')).toBeTruthy();
    expect(within(metrics).getByText('86% of workforce')).toBeTruthy();

    expect(screen.getByText('Engineering')).toBeTruthy();
    expect(screen.getByText('Priya Raman')).toBeTruthy();
    expect(await screen.findByText('Next holiday')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Reports/ })).toBeTruthy();
  });

  it('approves directly but asks for confirmation before rejecting', async () => {
    const user = userEvent.setup();
    setAuth(HR_PERMISSIONS, ['HR_ADMIN']);
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'Approve leave request from Meena Iyer' }));
    await waitFor(() => expect(mocks.leaveRequestsApi.approve).toHaveBeenCalledWith(101));
    expect(mocks.toast.success).toHaveBeenCalledWith('Leave request approved.');

    await user.click(screen.getByRole('button', { name: 'Reject leave request from Meena Iyer' }));
    expect(mocks.leaveRequestsApi.reject).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Reject request' }));
    await waitFor(() => expect(mocks.leaveRequestsApi.reject).toHaveBeenCalledWith(101));
  });

  it('hides org metrics and gated shortcuts from a team manager', async () => {
    setAuth(['LEAVE_APPROVE'], ['MANAGER']);
    mocks.dashboardApi.myTeam.mockResolvedValue({ pendingApprovals: PENDING });
    renderDashboard();

    expect(await screen.findByText('Meena Iyer')).toBeTruthy();
    expect(mocks.dashboardApi.summary).not.toHaveBeenCalled();
    expect(mocks.leaveRequestsApi.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Workforce metrics' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Reports/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Add employee/ })).toBeNull();
  });

  it('offers a retry when workforce metrics fail to load', async () => {
    const user = userEvent.setup();
    setAuth(HR_PERMISSIONS, ['HR_ADMIN']);
    mocks.dashboardApi.summary.mockRejectedValueOnce(new Error('network'));
    renderDashboard();

    expect(await screen.findByText('Workforce metrics could not be loaded.')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await waitFor(() => expect(mocks.dashboardApi.summary).toHaveBeenCalledTimes(2));
  });
});


describe('Dashboard (employee)', () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  beforeEach(() => {
    mocks.employeesApi.getById.mockReset().mockResolvedValue({ id: 5, fullName: 'Lakshmi Nair', designationTitle: 'Designer', departmentName: 'Product' });
    mocks.attendanceApi.byEmployee.mockReset().mockResolvedValue([]);
    mocks.attendanceApi.today.mockReset().mockResolvedValue(null);
    mocks.dailyAttendanceApi.mine.mockReset().mockResolvedValue([
      { date: today, shiftName: 'General', shiftStart: '10:00', shiftEnd: '18:30', status: 'ABSENT', workedMinutes: 0, late: false },
    ]);
    mocks.leaveRequestsApi.balance.mockReset().mockResolvedValue([
      { leaveTypeId: 1, leaveTypeName: 'Casual Leave', remainingDays: 7, allocatedDays: 12, carriedForwardDays: 0 },
    ]);
    mocks.leaveRequestsApi.byEmployee.mockReset().mockResolvedValue([]);
    mocks.employeeSalaryApi.getDetail.mockReset().mockResolvedValue({ currentStructure: null, payrollHistory: [{ id: 3, periodLabel: 'Oct 2026', netSalary: 48250, paymentDate: '2026-10-31' }] });
    mocks.holidaysApi.list.mockReset().mockResolvedValue([{ id: 1, name: 'Year End', date: '2999-12-31' }]);
    mocks.dashboardApi.summary.mockReset();
  });

  afterEach(() => cleanup());

  it("greets the employee with today's shift, check-in status and key cards", async () => {
    setAuth(['SELF_PAYSLIP_VIEW', 'SELF_LEAVE_VIEW', 'SELF_ATTENDANCE_VIEW'], ['EMPLOYEE'], { employeeId: 5 });
    renderDashboard();

    expect(await screen.findByText(/General · 10:00 AM – 6:30 PM/)).toBeTruthy();
    expect(screen.getByText('Not checked in')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Check in on My Attendance' }).getAttribute('href')).toBe('/my-attendance');
    expect(await screen.findByText('Designer · Product')).toBeTruthy();
    const leave = screen.getByRole('region', { name: /Leave available/ });
    await waitFor(() => expect(within(leave).getAllByText('7').length).toBeGreaterThan(0));
    expect(await screen.findByText('Net pay · Oct 2026')).toBeTruthy();
    expect(screen.getByText('Paid 31 Oct 2026')).toBeTruthy();
    expect(await screen.findByText('Year End')).toBeTruthy();
    expect(mocks.dailyAttendanceApi.mine).toHaveBeenCalled();
    expect(mocks.dashboardApi.summary).not.toHaveBeenCalled();
    // No approval permissions: no approvals card.
    expect(screen.queryByRole('region', { name: 'Pending approvals' })).toBeNull();
  });

  it('hides pay without payslip access and shows approvals to approvers', async () => {
    setAuth(['TIMESHEET_APPROVE'], ['EMPLOYEE'], { employeeId: 5 });
    mocks.homeApi.todos.mockResolvedValue([{ key: 'timesheets', title: 'Timesheets to approve', detail: '2 waiting', count: 2, link: '/approvals', tone: 'action' }]);
    mocks.attendanceApi.today.mockResolvedValue({ status: 'CHECKED_IN', checkInTime: new Date().toISOString() });
    renderDashboard();

    const approvals = await screen.findByRole('region', { name: 'Pending approvals' });
    await waitFor(() => expect(within(approvals).getAllByText('2').length).toBeGreaterThan(0));
    expect(await screen.findByText('Checked in')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Latest payslip' })).toBeNull();
    expect(mocks.employeeSalaryApi.getDetail).not.toHaveBeenCalled();
  });
});
