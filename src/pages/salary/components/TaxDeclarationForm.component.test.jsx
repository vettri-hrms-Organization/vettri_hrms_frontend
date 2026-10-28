import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaxDeclarationForm from './TaxDeclarationForm.jsx';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  api: {
    getMine: vi.fn(),
    saveMine: vi.fn(),
    projectMine: vi.fn(),
    getForEmployee: vi.fn(),
    saveForEmployee: vi.fn(),
    projectForEmployee: vi.fn(),
  },
}));

vi.mock('../../../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../../../api/endpoints/salary', () => ({ taxDeclarationApi: mocks.api }));

const RESULT = (totalTax, taxableIncome) => ({
  grossSalary: 1500000, standardDeduction: 75000, hraExemption: 0, professionalTax: 0, homeLoanInterest: 0,
  chapterVIATotal: 0, taxableIncome, rebate87A: 0, totalTax,
});

const PROJECTION = {
  financialYear: 2026, financialYearLabel: 'FY 2026-27', selectedRegime: 'NEW', hasSalaryStructure: true,
  monthsPaid: 6, monthsProjected: 6, tdsDeductedSoFar: 30000, estimatedMonthlyTds: 5000,
  newRegime: RESULT(97500, 1425000), oldRegime: RESULT(180000, 1300000), recommendedRegime: 'NEW',
};

function renderForm(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaxDeclarationForm fy={2026} {...props} />
    </QueryClientProvider>
  );
}

describe('TaxDeclarationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.getMine.mockResolvedValue({ employeeId: 5, financialYear: 2026, regime: 'NEW', section80C: 0, section80D: 0, rentPaid: 0, metroCity: false, homeLoanInterest: 0, nps80ccd1b: 0, otherDeductions: 0, submitted: false });
    mocks.api.projectMine.mockResolvedValue(PROJECTION);
    mocks.api.saveMine.mockImplementation((fy, payload) => Promise.resolve({ ...payload, financialYear: fy, submitted: true }));
  });

  afterEach(cleanup);

  it('shows the new vs old regime comparison', async () => {
    renderForm();
    expect(await screen.findByText(/costs less with these figures/)).toBeTruthy();
    expect(screen.getByText('FY 2026-27 - 6 month(s) paid, 6 projected')).toBeTruthy();
    expect(screen.getByText('Not submitted yet')).toBeTruthy();
  });

  it('saves the chosen regime and numeric declarations for the self-service FY', async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText('Not submitted yet');

    await user.click(screen.getByRole('radio', { name: /Old regime/ }));
    const c80 = screen.getByLabelText('80C investments (₹/year)');
    await user.clear(c80);
    await user.type(c80, '150000');
    await user.click(screen.getByLabelText(/metro city/));
    await user.click(screen.getByRole('button', { name: /Save declaration/ }));

    await waitFor(() => expect(mocks.api.saveMine).toHaveBeenCalledTimes(1));
    const [fy, payload] = mocks.api.saveMine.mock.calls[0];
    expect(fy).toBe(2026);
    expect(payload.regime).toBe('OLD');
    expect(payload.section80C).toBe(150000);
    expect(payload.metroCity).toBe(true);
    expect(mocks.toast.success).toHaveBeenCalled();
    expect(mocks.api.saveForEmployee).not.toHaveBeenCalled();
  });

  it('is read-only for HR viewers without manage permission', async () => {
    mocks.api.getForEmployee.mockResolvedValue({ employeeId: 9, financialYear: 2026, regime: 'OLD', section80C: 50000, submitted: true });
    mocks.api.projectForEmployee.mockResolvedValue(PROJECTION);
    renderForm({ employeeId: 9, canEdit: false });

    await screen.findByText(/costs less/);
    expect(mocks.api.getForEmployee).toHaveBeenCalledWith(9, 2026);
    expect(screen.queryByRole('button', { name: /Save declaration/ })).toBeNull();
    expect(screen.getByLabelText('80C investments (₹/year)').closest('fieldset').disabled).toBe(true);
  });
});
