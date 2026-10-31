import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import Approvals from './Approvals.jsx';

const mocks = vi.hoisted(() => ({
  leaveRequestsApi: { list: vi.fn(), teamList: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  compOffApi: { approvals: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  encashmentApi: { list: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  attendanceApi: {
    teamWfh: vi.fn(), approveWfh: vi.fn(), rejectWfh: vi.fn(),
    pendingRegularizations: vi.fn(), reviewRegularization: vi.fn(),
  },
  overtimeApi: { list: vi.fn(), review: vi.fn() },
  expensesApi: { managerQueue: vi.fn(), financeQueue: vi.fn(), managerApprove: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  fbpApi: { claims: vi.fn().mockResolvedValue([]), approveClaim: vi.fn(), rejectClaim: vi.fn() },
  loansApi: { list: vi.fn().mockResolvedValue([]), approve: vi.fn(), reject: vi.fn() },
  resignationsApi: { pending: vi.fn().mockResolvedValue([]), approve: vi.fn(), retain: vi.fn() },
  timesheetsApi: { approvals: vi.fn().mockResolvedValue([]), approve: vi.fn(), reject: vi.fn() },
  profileApi: { pendingChanges: vi.fn().mockResolvedValue([]), approveChange: vi.fn(), rejectChange: vi.fn() },
  travelApi: { queue: vi.fn().mockResolvedValue([]), decide: vi.fn() },
  permissions: new Set(),
}));

vi.mock('../../api/endpoints/leave', () => ({
  leaveRequestsApi: mocks.leaveRequestsApi,
  compOffApi: mocks.compOffApi,
  encashmentApi: mocks.encashmentApi,
}));
vi.mock('../../api/endpoints/attendance', () => ({ attendanceApi: mocks.attendanceApi }));
vi.mock('../../api/endpoints/shifts', () => ({ overtimeApi: mocks.overtimeApi }));
vi.mock('../../api/endpoints/expenses', () => ({ expensesApi: mocks.expensesApi }));
vi.mock('../../api/endpoints/fbp', async (importOriginal) => ({ ...(await importOriginal()), fbpApi: mocks.fbpApi }));
vi.mock('../../api/endpoints/loans', async (importOriginal) => ({ ...(await importOriginal()), loansApi: mocks.loansApi }));
vi.mock('../../api/endpoints/resignations', () => ({ resignationsApi: mocks.resignationsApi }));
vi.mock('../../api/endpoints/timesheets', async (importOriginal) => ({ ...(await importOriginal()), timesheetsApi: mocks.timesheetsApi }));
vi.mock('../../api/endpoints/profile', () => ({ profileApi: mocks.profileApi }));
vi.mock('../../api/endpoints/workflows', async (importOriginal) => ({ ...(await importOriginal()), travelApi: mocks.travelApi }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { employeeId: 99 }, hasPermission: (code) => mocks.permissions.has(code) }),
}));

const forbidden = () => Object.assign(new Error('Forbidden'), { response: { status: 403, data: { message: 'Forbidden' } } });

const LEAVE = {
  id: 11, employeeId: 1, employeeName: 'Asha Rao', departmentName: 'Support', leaveTypeName: 'Casual Leave',
  startDate: '2026-11-02', endDate: '2026-11-03', days: 2, halfDay: false, reason: 'Family function', status: 'PENDING',
};
const WFH = { id: 21, employeeId: 2, employeeName: 'Ravi Kumar', workDate: '2026-11-04', reason: 'Plumber visit', status: 'PENDING' };
const CLAIM = {
  id: 31, employeeId: 3, employeeName: 'Meena Iyer', departmentName: 'Sales', title: 'Client visit taxi',
  purpose: 'Travel', status: 'SUBMITTED', totalAmount: 1250, submittedAt: '2026-10-27T10:00:00+05:30',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <Approvals />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Approvals inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions = new Set(['LEAVE_APPROVE', 'EXPENSE_APPROVE', 'ATTENDANCE_MANAGE']);
    mocks.leaveRequestsApi.teamList.mockResolvedValue([LEAVE]);
    mocks.attendanceApi.teamWfh.mockResolvedValue([WFH]);
    mocks.attendanceApi.pendingRegularizations.mockRejectedValue(forbidden());
    mocks.compOffApi.approvals.mockResolvedValue([]);
    mocks.expensesApi.managerQueue.mockResolvedValue([CLAIM]);
  });
  afterEach(() => cleanup());

  it('merges permitted sources, hides the rest, and survives a 403 from one source', async () => {
    renderPage();

    expect(await screen.findByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('Ravi Kumar')).toBeTruthy();
    expect(screen.getByText('Meena Iyer')).toBeTruthy();
    expect(screen.getByTestId('approvals-total').textContent).toBe('3 pending');

    const tabs = screen.getByRole('tablist', { name: 'Filter approvals by type' });
    expect(within(tabs).getByRole('tab', { name: /^All/ })).toBeTruthy();
    expect(within(tabs).getByRole('tab', { name: /Attendance corrections/ })).toBeTruthy();
    expect(within(tabs).queryByRole('tab', { name: /Overtime/ })).toBeNull();
    expect(within(tabs).queryByRole('tab', { name: /Encashment/ })).toBeNull();

    // Team-scoped manager: team list, never the org-wide one; ungated sources never called.
    expect(mocks.leaveRequestsApi.teamList).toHaveBeenCalledWith('PENDING');
    expect(mocks.leaveRequestsApi.list).not.toHaveBeenCalled();
    expect(mocks.overtimeApi.list).not.toHaveBeenCalled();
    expect(mocks.encashmentApi.list).not.toHaveBeenCalled();
    expect(mocks.expensesApi.financeQueue).not.toHaveBeenCalled();

    fireEvent.click(within(tabs).getByRole('tab', { name: /Expenses/ }));
    expect(screen.getByText('Meena Iyer')).toBeTruthy();
    expect(screen.queryByText('Asha Rao')).toBeNull();
  });

  it('rejects with an optional note and refreshes the source', async () => {
    mocks.leaveRequestsApi.reject.mockResolvedValue({ ...LEAVE, status: 'REJECTED' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: "Reject Asha Rao's casual leave" }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Quarter-end freeze' } });
    mocks.leaveRequestsApi.teamList.mockResolvedValue([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(mocks.leaveRequestsApi.reject).toHaveBeenCalledWith(11, 'Quarter-end freeze'));
    expect(await screen.findByText("Rejected Asha Rao's casual leave.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Asha Rao')).toBeNull());
  });

  it('bulk-approves selected rows and keeps the ones that failed', async () => {
    mocks.leaveRequestsApi.approve.mockResolvedValue({ ...LEAVE, status: 'APPROVED' });
    mocks.attendanceApi.approveWfh.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400 } }));
    renderPage();

    fireEvent.click(await screen.findByRole('checkbox', { name: "Select Asha Rao's casual leave" }));
    fireEvent.click(screen.getByRole('checkbox', { name: "Select Ravi Kumar's work from home" }));
    mocks.leaveRequestsApi.teamList.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /Approve selected \(2\)/ }));

    expect(await screen.findByText('Approved 1, 1 failed. Failed requests are still in the list.')).toBeTruthy();
    expect(mocks.leaveRequestsApi.approve).toHaveBeenCalledWith(11, undefined);
    expect(mocks.attendanceApi.approveWfh).toHaveBeenCalledWith(21, undefined);
    await waitFor(() => expect(screen.queryByText('Asha Rao')).toBeNull());
    expect(screen.getByText('Ravi Kumar')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: "Select Ravi Kumar's work from home" }).checked).toBe(true);
  });

  it('requires a reason before rejecting an expense claim', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: "Reject Meena Iyer's expense claim" }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Reject' }).disabled).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Missing receipt' } });
    mocks.expensesApi.reject.mockResolvedValue({ ...CLAIM, status: 'REJECTED' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(mocks.expensesApi.reject).toHaveBeenCalledWith(31, 'Missing receipt'));
  });

  it("shows the caught-up state when nothing is pending", async () => {
    mocks.permissions = new Set(['LEAVE_APPROVE', 'LEAVE_MANAGE', 'OVERTIME_APPROVE']);
    mocks.leaveRequestsApi.list.mockResolvedValue([]);
    mocks.attendanceApi.teamWfh.mockResolvedValue([]);
    mocks.overtimeApi.list.mockResolvedValue([]);
    mocks.encashmentApi.list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("You're all caught up")).toBeTruthy();
    expect(mocks.leaveRequestsApi.list).toHaveBeenCalledWith('PENDING');
    expect(mocks.leaveRequestsApi.teamList).not.toHaveBeenCalled();
    expect(mocks.overtimeApi.list).toHaveBeenCalledWith('PENDING', expect.any(String), expect.any(String));
    expect(screen.getByTestId('approvals-total').textContent).toBe('0 pending');
  });
});
