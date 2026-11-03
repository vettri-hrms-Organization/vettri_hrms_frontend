import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyLeave, { policyLines } from './MyLeave.jsx';

const { api, typesApi } = vi.hoisted(() => ({
  api: { balance: vi.fn(), byEmployee: vi.fn(), cancel: vi.fn() },
  typesApi: { list: vi.fn() },
}));

vi.mock('../../api/endpoints/leave', () => ({ leaveRequestsApi: api, leaveTypesApi: typesApi }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { employeeId: 7 }, hasPermission: () => true }) }));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('./ApplyLeaveModal', () => ({ default: () => <div>Apply form</div> }));
vi.mock('./LeaveSelfServicePanel', () => ({ default: () => null, CompOffDialog: () => <div>Comp-off form</div> }));
// Charts need real layout; the numbers behind them are covered by the history and balance checks.
vi.mock('recharts', () => {
  const Box = ({ children }) => <div>{children}</div>;
  return { ResponsiveContainer: Box, BarChart: Box, PieChart: Box, Pie: Box, Bar: () => null, Cell: () => null, Tooltip: () => null, XAxis: () => null };
});

const year = new Date().getFullYear();
const future = `${year + 1}-01-20`;

function renderPage(path = '/my-leave') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}><MyLeave /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyLeave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.balance.mockResolvedValue([
      { leaveTypeId: 1, leaveTypeName: 'Casual Leave', allocatedDays: 5, carriedForwardDays: 0, usedDays: 4, remainingDays: 1, annualEntitlementDays: 6, accrualMode: 'MONTHLY' },
    ]);
    api.byEmployee.mockResolvedValue([
      { id: 10, leaveTypeName: 'Casual Leave', startDate: `${year}-03-02`, endDate: `${year}-03-03`, days: 2, status: 'APPROVED', decidedByName: 'Omkar Pashte', decidedAt: `${year}-03-01T10:00:00`, requestedAt: `${year}-02-27T09:00:00`, reason: 'Brother marriage' },
      { id: 11, leaveTypeName: 'Sick Leave', startDate: `${year}-04-06`, endDate: `${year}-04-06`, days: 1, status: 'REJECTED', decidedByName: 'Omkar Pashte', decisionNote: 'Peak week', reason: 'Fever' },
      { id: 12, leaveTypeName: 'Casual Leave', startDate: future, endDate: future, days: 1, status: 'PENDING', pendingWith: 'Omkar Pashte', reason: 'Trip' },
    ]);
    typesApi.list.mockResolvedValue([
      { id: 1, name: 'Casual Leave', active: true, paid: true, defaultDaysPerYear: 6, carryForward: false, policy: { accrualMode: 'MONTHLY', sandwichRule: true } },
      { id: 2, name: 'Paternity Leave', active: true, paid: true, defaultDaysPerYear: 5, carryForward: false, policy: { accrualMode: 'YEARLY_UPFRONT' } },
    ]);
    api.cancel.mockResolvedValue({});
  });

  afterEach(() => cleanup());

  it('shows balances the way the policy accrues them', async () => {
    renderPage();
    const card = (await screen.findByRole('heading', { name: 'Casual Leave' })).closest('article');
    expect(within(card).getByText('Accrued so far')).toBeTruthy();
    expect(within(card).getByText('5 days')).toBeTruthy();
    expect(within(card).getByText('Annual quota')).toBeTruthy();
    expect(within(card).getByText('6 days')).toBeTruthy();
    // Leave types without a balance are listed separately.
    expect(screen.getByText('Paternity Leave')).toBeTruthy();
  });

  it('lists history with approver, notes and reasons, and filters by status', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Leave history' });
    expect(within(table).getAllByText('by Omkar Pashte').length).toBe(2);
    expect(within(table).getByText('Brother marriage')).toBeTruthy();
    expect(within(table).getByText('Peak week')).toBeTruthy();
    expect(within(table).getByText(/Requested on/)).toBeTruthy();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'REJECTED');
    expect(screen.getByText('Total: 1')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Leave history' })).queryByText('Brother marriage')).toBeNull();
  });

  it('cancels a pending request after confirmation', async () => {
    renderPage();
    await screen.findByText(/waiting for Omkar Pashte/);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalled());
    expect(api.cancel.mock.calls[0][0]).toBe(12);
  });

  it('opens the request form when linked with ?apply=leave', async () => {
    renderPage('/my-leave?apply=leave');
    expect(await screen.findByText('Apply form')).toBeTruthy();
  });

  it('explains leave rules in plain words', () => {
    const lines = policyLines({ name: 'Casual Leave', defaultDaysPerYear: 12, carryForward: true, policy: { accrualMode: 'MONTHLY', maxCarryForwardDays: 5, sandwichRule: true } });
    expect(lines).toContain('12 days a year, building up every month (1 per month).');
    expect(lines).toContain('Carries forward up to 5 days to next year.');
    expect(lines).toContain('Weekends and holidays between two leave days are counted as leave.');
  });
});
