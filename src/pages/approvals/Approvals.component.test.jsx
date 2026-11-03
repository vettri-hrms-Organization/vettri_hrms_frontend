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

  const rowNames = () => within(screen.getByRole('table', { name: 'Pending approvals' }))
    .getAllByRole('row').slice(1).map((row) => row.querySelector('.hz-approvals__name')?.textContent);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  it('shows how long each request has waited and sorts oldest or newest first', async () => {
    mocks.leaveRequestsApi.teamList.mockResolvedValue([{ ...LEAVE, requestedAt: daysAgo(5) }]);
    mocks.expensesApi.managerQueue.mockResolvedValue([{ ...CLAIM, submittedAt: daysAgo(1) }]);
    // WFH has no submitted time: it sorts by its own date and shows no age.
    mocks.attendanceApi.teamWfh.mockResolvedValue([{ ...WFH, workDate: '2099-01-01' }]);
    renderPage();

    await screen.findByText('Asha Rao');
    expect(rowNames()).toEqual(['Asha Rao', 'Meena Iyer', 'Ravi Kumar']);
    expect(screen.getByText('5 days')).toBeTruthy();
    expect(screen.getByText('1 day')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort approvals' }), { target: { value: 'newest' } });
    expect(rowNames()).toEqual(['Ravi Kumar', 'Meena Iyer', 'Asha Rao']);
  });

  it('searches by name and offers to clear a search with no matches', async () => {
    renderPage();
    await screen.findByText('Asha Rao');

    const search = screen.getByRole('searchbox', { name: 'Search approvals by name' });
    fireEvent.change(search, { target: { value: 'meena' } });
    expect(rowNames()).toEqual(['Meena Iyer']);
    expect(screen.getByText('1 of 3')).toBeTruthy();

    fireEvent.change(search, { target: { value: 'nobody' } });
    expect(screen.getByText('No requests match this search')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(rowNames()).toHaveLength(3);
  });

  it('bulk-approves one request at a time with progress and lists failures with the reason', async () => {
    let finishLeave;
    mocks.leaveRequestsApi.approve.mockImplementation(() => new Promise((resolve) => { finishLeave = resolve; }));
    mocks.attendanceApi.approveWfh.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { message: 'Date is locked' } } }));
    renderPage();

    fireEvent.click(await screen.findByRole('checkbox', { name: "Select Asha Rao's casual leave" }));
    fireEvent.click(screen.getByRole('checkbox', { name: "Select Ravi Kumar's work from home" }));
    fireEvent.click(screen.getByRole('button', { name: /Approve selected \(2\)/ }));

    expect(await screen.findByText('Approving 1 of 2…')).toBeTruthy();
    // The second request waits until the first has finished.
    expect(mocks.leaveRequestsApi.approve).toHaveBeenCalledTimes(1);
    expect(mocks.attendanceApi.approveWfh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: "Approve Meena Iyer's expense claim" }).disabled).toBe(true);

    finishLeave({ ...LEAVE, status: 'APPROVED' });
    expect(await screen.findByText('Approved 1, 1 failed. Failed requests are still in the list.')).toBeTruthy();
    expect(mocks.attendanceApi.approveWfh).toHaveBeenCalledWith(21, undefined);
    expect(screen.getByText('Ravi Kumar · Work from home: Date is locked')).toBeTruthy();
    expect(screen.queryByText(/Approving \d of/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss approval failures' }));
    expect(screen.queryByText('Ravi Kumar · Work from home: Date is locked')).toBeNull();
  });

  it('keeps other sources visible when one fails and retries just that source', async () => {
    mocks.expensesApi.managerQueue.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    renderPage();

    expect(await screen.findByText('Asha Rao')).toBeTruthy();
    expect(await screen.findByText(/Couldn't load Expenses/)).toBeTruthy();
    const tabs = screen.getByRole('tablist', { name: 'Filter approvals by type' });
    expect(within(tabs).getByRole('tab', { name: /Expenses couldn't load/ })).toBeTruthy();

    fireEvent.click(within(tabs).getByRole('tab', { name: /Expenses/ }));
    expect(screen.getByText("Couldn't load expenses")).toBeTruthy();
    expect(screen.queryByText("You're all caught up")).toBeNull();

    mocks.expensesApi.managerQueue.mockResolvedValue([CLAIM]);
    const leaveCalls = mocks.leaveRequestsApi.teamList.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry Expenses' }));
    expect(await screen.findByText('Meena Iyer')).toBeTruthy();
    expect(mocks.leaveRequestsApi.teamList.mock.calls.length).toBe(leaveCalls);
  });

  it('moves between type chips with the arrow keys', async () => {
    renderPage();
    await screen.findByText('Asha Rao');
    const tabs = screen.getByRole('tablist', { name: 'Filter approvals by type' });
    const all = within(tabs).getByRole('tab', { name: /^All/ });
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    const leave = within(tabs).getByRole('tab', { name: /^Leave/ });
    expect(leave.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(leave);
    expect(screen.queryByText('Ravi Kumar')).toBeNull();
    fireEvent.keyDown(leave, { key: 'End' });
    expect(within(tabs).getAllByRole('tab').at(-1).getAttribute('aria-selected')).toBe('true');
  });
});
