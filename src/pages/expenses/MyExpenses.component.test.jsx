import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyExpenses from './MyExpenses.jsx';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  expensesApi: {
    myClaims: vi.fn(),
    settings: vi.fn(),
    categories: vi.fn(),
    submit: vi.fn(),
    remove: vi.fn(),
    downloadReceipt: vi.fn(),
  },
}));

vi.mock('../../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../../api/endpoints/expenses', () => ({ expensesApi: mocks.expensesApi }));

const DRAFT = {
  id: 1, title: 'Client visit – Chennai', status: 'DRAFT', totalAmount: 1250, createdAt: '2026-10-20T10:00:00+05:30',
  lines: [{ id: 11, expenseDate: '2026-10-19', categoryId: 3, categoryName: 'Travel', amount: 1250, hasReceipt: false }],
  policyIssues: [],
};
const REJECTED = {
  id: 2, title: 'Team lunch', status: 'REJECTED', totalAmount: 4000, rejectionReason: 'Over the food limit',
  submittedAt: '2026-10-10T10:00:00+05:30', rejectedAt: '2026-10-11T10:00:00+05:30', lines: [], policyIssues: [],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><MyExpenses /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyExpenses', () => {
  beforeEach(() => {
    mocks.expensesApi.myClaims.mockResolvedValue([DRAFT, REJECTED]);
    mocks.expensesApi.settings.mockResolvedValue({ reimbursementMode: 'PAYROLL' });
    mocks.expensesApi.categories.mockResolvedValue([]);
    mocks.expensesApi.submit.mockResolvedValue({ ...DRAFT, status: 'SUBMITTED', policyIssues: [] });
  });

  afterEach(() => cleanup());

  it('lists claims with status, totals and rejection reasons', async () => {
    renderPage();
    expect(await screen.findByText('Client visit – Chennai')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByText(/Over the food limit/)).toBeTruthy();
    expect(await screen.findByText(/paid with your salary/)).toBeTruthy();
  });

  it('only drafts can be edited or submitted, and submitting calls the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Client visit – Chennai');

    expect(screen.queryByRole('button', { name: 'Submit Team lunch' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View Team lunch' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Submit Client visit – Chennai' }));
    await waitFor(() => expect(mocks.expensesApi.submit).toHaveBeenCalledWith(1));
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Claim submitted for approval.'));
  });

  it('shows an empty state with a call to action when there are no claims', async () => {
    mocks.expensesApi.myClaims.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No expense claims yet')).toBeTruthy();
  });
});
