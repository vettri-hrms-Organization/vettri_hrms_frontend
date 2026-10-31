import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LeaveRequests from './LeaveRequests.jsx';

const mocks = vi.hoisted(() => ({
  api: { list: vi.fn(), teamList: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  exportToCsv: vi.fn(),
  permissions: [],
}));

vi.mock('../../api/endpoints/leave', () => ({ leaveRequestsApi: mocks.api }));
vi.mock('../../utils/exportToCsv', () => ({ exportToCsv: mocks.exportToCsv }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { fullName: 'HR' }, hasPermission: (p) => mocks.permissions.includes(p) }),
}));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('./LeaveExtraApprovals', () => ({ CompOffApprovals: () => null, EncashmentApprovals: () => null }));
vi.mock('./ApplyLeaveModal', () => ({ default: () => null }));

const REQUESTS = [
  { id: 1, employeeId: 11, employeeName: 'Meena Iyer', departmentName: 'Sales', leaveTypeName: 'Casual Leave', startDate: '2026-11-03', endDate: '2026-11-04', days: 2, status: 'PENDING' },
  { id: 2, employeeId: 12, employeeName: 'Arun Kumar', departmentName: 'Engineering', leaveTypeName: 'Sick Leave', startDate: '2026-11-05', endDate: '2026-11-05', days: 1, status: 'PENDING' },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><LeaveRequests /></MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.permissions = ['LEAVE_VIEW', 'LEAVE_APPROVE', 'LEAVE_MANAGE'];
  mocks.api.list.mockReset().mockResolvedValue(REQUESTS);
  mocks.exportToCsv.mockReset();
  try { window.localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => cleanup());

describe('LeaveRequests', () => {
  it('lists requests, finds one by department and exports what is shown', async () => {
    renderPage();
    expect(await screen.findByText('Meena Iyer')).toBeTruthy();
    expect(screen.getByText('Arun Kumar')).toBeTruthy();

    await userEvent.type(screen.getByLabelText('Filter by name, type, dept…'), 'engineering');
    expect(screen.queryByText('Meena Iyer')).toBeNull();
    expect(screen.getByText('Arun Kumar')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Export CSV/ }));
    const [, rows] = mocks.exportToCsv.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].Employee).toBe('Arun Kumar');
    expect(rows[0].Department).toBe('Engineering');
  });

  it('opens the approval dialog from the row', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: "Approve Meena Iyer's leave request" }));
    expect(await screen.findByText('Approve leave request')).toBeTruthy();
  });

  it('shows team requests only to a manager', async () => {
    mocks.permissions = ['LEAVE_VIEW', 'LEAVE_APPROVE'];
    mocks.api.teamList.mockReset().mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nothing pending')).toBeTruthy();
    await waitFor(() => expect(mocks.api.teamList).toHaveBeenCalled());
    expect(mocks.api.list).not.toHaveBeenCalled();
  });
});
