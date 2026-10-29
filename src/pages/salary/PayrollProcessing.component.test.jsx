import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PayrollProcessing from './PayrollProcessing.jsx';

const mocks = vi.hoisted(() => ({
  auth: null,
  toast: { success: vi.fn(), error: vi.fn() },
  payrollApi: { listRuns: vi.fn(), getRun: vi.fn(), process: vi.fn(), markPaid: vi.fn(), cancel: vi.fn(), setItemHold: vi.fn(), createRun: vi.fn(), downloadPayslipPdf: vi.fn(), downloadBankTransferCsv: vi.fn() },
  employeeSalaryApi: { list: vi.fn() },
  leaveRequestsApi: { list: vi.fn() },
  attendanceApi: { pendingRegularizations: vi.fn() },
  overtimeApi: { list: vi.fn() },
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../../api/endpoints/salary', () => ({ payrollApi: mocks.payrollApi, employeeSalaryApi: mocks.employeeSalaryApi }));
vi.mock('../../api/endpoints/leave', () => ({ leaveRequestsApi: mocks.leaveRequestsApi }));
vi.mock('../../api/endpoints/attendance', () => ({ attendanceApi: mocks.attendanceApi }));
vi.mock('../../api/endpoints/shifts', () => ({ overtimeApi: mocks.overtimeApi }));
vi.mock('./components/StatutoryExportsCard', () => ({ default: () => null }));

const RUN = { id: 7, periodMonth: 10, periodYear: 2026, periodLabel: 'October 2026', status: 'DRAFT', totalEmployees: 2, totalGross: 0, totalDeductions: 0, totalNet: 0 };
const ITEMS = [
  { id: 1, employeeName: 'Meena Iyer', employeeCode: 'E1', status: 'PENDING', grossSalary: 50000, totalDeductions: 5000, netSalary: 45000, paidDays: 31, daysInPeriod: 31, lopDays: 0, periodYear: 2026, periodMonth: 10 },
  { id: 2, employeeName: 'Arun Kumar', employeeCode: 'E2', status: 'PENDING', grossSalary: 40000, totalDeductions: 4000, netSalary: 36000, paidDays: 31, daysInPeriod: 31, lopDays: 0, periodYear: 2026, periodMonth: 10 },
];

const ALL = ['SALARY_VIEW', 'SALARY_MANAGE', 'LEAVE_VIEW', 'LEAVE_APPROVE', 'LEAVE_MANAGE', 'ATTENDANCE_MANAGE', 'OVERTIME_APPROVE'];

function setAuth(permissions) {
  mocks.auth = { hasPermission: (p) => permissions.includes(p) };
}

function setRun(run, items = ITEMS) {
  mocks.payrollApi.listRuns.mockResolvedValue([run]);
  mocks.payrollApi.getRun.mockResolvedValue({ run, items });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PayrollProcessing />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  Object.values(mocks.payrollApi).forEach((fn) => fn.mockReset());
  mocks.employeeSalaryApi.list.mockReset().mockResolvedValue({
    content: [
      { employeeId: 1, structureConfigured: true, employmentStatus: 'Active' },
      { employeeId: 3, structureConfigured: false, employmentStatus: 'Active' },
      { employeeId: 4, structureConfigured: false, employmentStatus: 'Resigned' },
    ],
    totalElements: 3,
  });
  mocks.leaveRequestsApi.list.mockReset().mockResolvedValue([
    { id: 1, startDate: '2026-10-30', endDate: '2026-11-02' },
    { id: 2, startDate: '2026-11-10', endDate: '2026-11-11' },
  ]);
  mocks.attendanceApi.pendingRegularizations.mockReset().mockResolvedValue([{ id: 5, attendanceDate: '2026-09-29' }]);
  mocks.overtimeApi.list.mockReset().mockResolvedValue([]);
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
});

afterEach(cleanup);

describe('PayrollProcessing guided flow', () => {
  it('shows the step indicator and a checklist built from real API data for a draft run', async () => {
    setAuth(ALL);
    setRun(RUN);
    renderPage();

    const steps = await screen.findByRole('list', { name: 'Payroll run progress' });
    const items = within(steps).getAllByRole('listitem');
    expect(items[0].getAttribute('data-step-state')).toBe('done');
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[2].getAttribute('data-step-state')).toBe('todo');

    const checklist = await screen.findByRole('list', { name: 'Before you run checklist' });
    const structures = await waitFor(() => {
      const row = checklist.querySelector('[data-check="structures"]');
      expect(within(row).getByText('Needs attention')).toBeTruthy();
      return row;
    });
    // Resigned employee without a structure is not counted.
    expect(within(structures).getByLabelText('Count 1')).toBeTruthy();
    expect(within(structures).getByRole('link', { name: 'Assign structures' }).getAttribute('href')).toBe('/salary/employees');

    const leave = checklist.querySelector('[data-check="leave"]');
    await waitFor(() => expect(within(leave).getByLabelText('Count 1')).toBeTruthy());
    expect(within(leave).getByRole('link', { name: 'Review leave' }).getAttribute('href')).toBe('/leave');

    const regs = checklist.querySelector('[data-check="regularizations"]');
    await waitFor(() => expect(within(regs).getByText('OK')).toBeTruthy());

    expect(mocks.overtimeApi.list).toHaveBeenCalledWith('PENDING', '2026-10-01', '2026-10-31');
    const included = checklist.querySelector('[data-check="included"]');
    expect(within(included).getByLabelText('Count 2')).toBeTruthy();
  });

  it('leaves out checks the user has no permission to read', async () => {
    setAuth(['SALARY_MANAGE']);
    setRun(RUN);
    renderPage();

    const checklist = await screen.findByRole('list', { name: 'Before you run checklist' });
    expect(checklist.querySelector('[data-check="leave"]')).toBeNull();
    expect(checklist.querySelector('[data-check="regularizations"]')).toBeNull();
    expect(checklist.querySelector('[data-check="overtime"]')).toBeNull();
    expect(mocks.leaveRequestsApi.list).not.toHaveBeenCalled();
    expect(mocks.attendanceApi.pendingRegularizations).not.toHaveBeenCalled();
    expect(mocks.overtimeApi.list).not.toHaveBeenCalled();
  });

  it('confirms before processing and calls the existing process API', async () => {
    setAuth(ALL);
    setRun(RUN);
    mocks.payrollApi.process.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Process Payroll/ }));
    expect(await screen.findByText('Process payroll for October 2026?')).toBeTruthy();
    expect(screen.getByText(/2 employees will be finalised/)).toBeTruthy();
    expect(mocks.payrollApi.process).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Process payroll' }));
    await waitFor(() => expect(mocks.payrollApi.process).toHaveBeenCalledWith(7));
  });

  it('blocks processing while employees are on hold', async () => {
    setAuth(ALL);
    setRun(RUN, [{ ...ITEMS[0], status: 'ON_HOLD' }, ITEMS[1]]);
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /Process Payroll/ }).disabled).toBe(true));
    expect(screen.getByText(/release the 1 employee on hold first/)).toBeTruthy();
    expect(screen.getByText('Blocks processing')).toBeTruthy();
  });

  it('makes Mark as Paid the next action for a processed run and hides the checklist', async () => {
    setAuth(ALL);
    setRun({ ...RUN, status: 'PROCESSED', totalNet: 81000 }, ITEMS.map((i) => ({ ...i, status: 'PROCESSED' })));
    renderPage();

    expect(await screen.findByRole('button', { name: /Mark as Paid/ })).toBeTruthy();
    const steps = screen.getByRole('list', { name: 'Payroll run progress' });
    expect(within(steps).getAllByRole('listitem')[3].getAttribute('aria-current')).toBe('step');
    expect(screen.queryByRole('list', { name: 'Before you run checklist' })).toBeNull();
    expect(mocks.employeeSalaryApi.list).not.toHaveBeenCalled();
  });

  it('shows an error state with retry when runs fail to load', async () => {
    setAuth(ALL);
    mocks.payrollApi.listRuns.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText("Couldn't load payroll runs.")).toBeTruthy();
  });
});
