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
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../api/endpoints/dashboard', () => ({ dashboardApi: mocks.dashboardApi }));
vi.mock('../api/endpoints/leave', () => ({ leaveRequestsApi: mocks.leaveRequestsApi, holidaysApi: mocks.holidaysApi }));
vi.mock('../api/endpoints/documents', () => ({ documentsApi: mocks.documentsApi }));
vi.mock('../api/endpoints/notifications', () => ({ notificationsApi: mocks.notificationsApi }));
vi.mock('../api/endpoints/employees', () => ({ employeesApi: { getById: vi.fn() } }));
vi.mock('../api/endpoints/attendance', () => ({ attendanceApi: { byEmployee: vi.fn() } }));
vi.mock('../api/endpoints/salary', () => ({ employeeSalaryApi: { getDetail: vi.fn() } }));
vi.mock('../api/endpoints/selfService', () => ({ selfServiceApi: { notifications: vi.fn() } }));
vi.mock('../api/endpoints/announcements', () => ({ announcementsApi: { feed: vi.fn().mockResolvedValue([]) } }));

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

function setAuth(permissions, roles = []) {
  mocks.auth = {
    user: { fullName: 'Lakshmi Nair', roles },
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
    expect(screen.getByText('Arun Kumar')).toBeTruthy();
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
