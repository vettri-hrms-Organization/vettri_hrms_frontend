import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalaryDetails from './SalaryDetails.jsx';

const mocks = vi.hoisted(() => ({
  auth: null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  employeeSalaryApi: { getDetail: vi.fn() },
  payrollApi: { downloadPayslipPdf: vi.fn() },
  taxDeclarationApi: { downloadForm16: vi.fn() },
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../../components/layout/BreadcrumbContext', () => ({ useBreadcrumbLabel: () => {} }));
vi.mock('./components/AssignSalaryStructureModal', () => ({ default: () => null }));
vi.mock('../../api/endpoints/salary', async (importOriginal) => ({
  ...(await importOriginal()),
  employeeSalaryApi: mocks.employeeSalaryApi,
  payrollApi: mocks.payrollApi,
  taxDeclarationApi: mocks.taxDeclarationApi,
}));

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

function item(id, periodMonth, periodYear, status, extra = {}) {
  const label = new Date(periodYear, periodMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  return {
    id, periodMonth, periodYear, periodLabel: `${label} ${periodYear}`, status,
    grossSalary: 60000, totalDeductions: 8000, netSalary: 52000,
    paidDays: 30, daysInPeriod: 31, lopDays: 1, paymentDate: status === 'PAID' ? `${periodYear}-${String(periodMonth).padStart(2, '0')}-28` : null,
    components: { basicSalary: 30000, hra: 15000, specialAllowance: 15000, pf: 3600, professionalTax: 200, tds: 4200 },
    adjustments: [], deductionLines: [], employerEpf: 1800, employerEps: 1250, employerEsi: 0, employerContributions: 3050,
    ...extra,
  };
}

const DETAIL = {
  employeeId: 11, employeeCode: 'E11', employeeName: 'Meena Iyer', designationTitle: 'Engineer', departmentName: 'Tech',
  currentStructure: {
    effectiveFrom: '2026-04-01', grossSalary: 60000, totalDeductions: 8000, netSalary: 52000, autoStatutory: true,
    components: { basicSalary: 30000, hra: 15000 },
  },
  structureHistory: [{ id: 1, effectiveFrom: '2026-04-01', active: true, netSalary: 52000 }],
  payrollHistory: [
    // API order is createdAt desc; a draft for the newest month must not be offered to the employee.
    item(4, 11, 2026, 'PENDING'),
    item(2, 9, 2026, 'PAID', { netSalary: 50000, grossSalary: 58000 }),
    item(3, 10, 2026, 'PROCESSED', { netSalary: 51000, grossSalary: 59000 }),
    item(1, 3, 2026, 'PAID', { netSalary: 40000, grossSalary: 45000 }),
  ],
};

function renderAt(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/my-payslip" element={<SalaryDetails />} />
          <Route path="/salary/employees/:employeeId" element={<SalaryDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function setAuth(permissions, employeeId = 11) {
  mocks.auth = { user: { employeeId }, hasPermission: (p) => permissions.includes(p), hasRole: () => false };
}

beforeEach(() => {
  mocks.employeeSalaryApi.getDetail.mockReset().mockResolvedValue(DETAIL);
  mocks.payrollApi.downloadPayslipPdf.mockReset().mockResolvedValue(undefined);
  mocks.toast.error.mockReset();
});

afterEach(cleanup);

describe('SalaryDetails - employee payslips', () => {
  it('defaults to the latest published payslip and shows its summary and breakdown', async () => {
    setAuth([]);
    renderAt('/my-payslip');

    expect(await screen.findByRole('heading', { name: 'My Payslips' })).toBeTruthy();
    const picker = screen.getByRole('group', { name: 'Payslip month' });
    // Published only, newest first: OCT, SEP, MAR (the November draft is left out).
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['OCT', 'SEP', 'MAR']);
    expect(within(picker).getByRole('button', { name: 'OCT' }).getAttribute('aria-pressed')).toBe('true');

    expect(screen.getByRole('heading', { name: 'October 2026 payslip' })).toBeTruthy();
    expect(screen.getByTestId('payslip-net').textContent).toBe(inr(51000));
    const summary = screen.getByRole('region', { name: 'Selected payslip' });
    expect(within(summary).getByText('Basic salary')).toBeTruthy();
    expect(within(summary).getByText('Income tax (TDS)')).toBeTruthy();
    expect(within(summary).getByText('Employer EPF')).toBeTruthy();
  });

  it('switches month and totals the financial year to date from published payslips', async () => {
    setAuth([]);
    renderAt('/my-payslip');
    await screen.findByRole('heading', { name: 'October 2026 payslip' });

    // FY 2026-27 up to October: September + October (March 2026 belongs to FY 2025-26).
    const ytd = screen.getByRole('heading', { name: 'Year to date' }).closest('section');
    expect(within(ytd).getByText(/FY 2026-27 up to October 2026 · 2 payslips/)).toBeTruthy();
    expect(within(ytd).getByText(inr(101000))).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'SEP' }));
    expect(screen.getByRole('heading', { name: 'September 2026 payslip' })).toBeTruthy();
    expect(screen.getByTestId('payslip-net').textContent).toBe(inr(50000));
    expect(within(ytd).getByText(/1 payslip$/)).toBeTruthy();
  });

  it('downloads the selected payslip with the existing filename', async () => {
    setAuth([]);
    renderAt('/my-payslip');
    await screen.findByRole('heading', { name: 'October 2026 payslip' });
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(mocks.payrollApi.downloadPayslipPdf).toHaveBeenCalledWith(3, 'payslip-E11-2026-10.pdf');
  });

  it('hides the download for an unpublished payslip opened from history', async () => {
    setAuth([]);
    renderAt('/my-payslip');
    await screen.findByRole('heading', { name: 'October 2026 payslip' });
    await userEvent.click(screen.getByRole('button', { name: 'November 2026' }));
    expect(screen.getByRole('heading', { name: 'November 2026 payslip' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download November 2026 payslip PDF' })).toBeNull();
  });

  it('shows an empty state when nothing is published yet', async () => {
    mocks.employeeSalaryApi.getDetail.mockResolvedValue({ ...DETAIL, payrollHistory: [item(4, 11, 2026, 'PENDING')] });
    setAuth([]);
    renderAt('/my-payslip');
    expect(await screen.findByText('No payslip published yet')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Payslip month' })).toBeNull();
  });

  it('offers a retry when the details fail to load', async () => {
    mocks.employeeSalaryApi.getDetail.mockRejectedValue(new Error('boom'));
    setAuth([]);
    renderAt('/my-payslip');
    expect(await screen.findByText("Couldn't load your payslips.")).toBeTruthy();
  });
});

describe('SalaryDetails - HR view', () => {
  it('shows the employee header, manage action and every payroll line', async () => {
    setAuth(['SALARY_VIEW', 'SALARY_MANAGE'], 99);
    renderAt('/salary/employees/11');

    expect(await screen.findByRole('heading', { name: 'Meena Iyer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revise Structure' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to Employee Salary List/ })).toBeTruthy();
    // SALARY_VIEW sees drafts too, so the newest line (November) is selected and downloadable.
    expect(screen.getByRole('heading', { name: 'November 2026 payslip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy();
    expect(mocks.employeeSalaryApi.getDetail).toHaveBeenCalledWith('11');
  });
});
