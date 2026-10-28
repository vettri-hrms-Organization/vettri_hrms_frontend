import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import YearEndProcessing from './YearEndProcessing.jsx';

const { leavePolicyApi } = vi.hoisted(() => ({
  leavePolicyApi: {
    yearEndPreview: vi.fn(),
    runYearEnd: vi.fn(),
    runAccruals: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/leave', () => ({ leavePolicyApi }));

const closingYear = new Date().getFullYear() - 1;

function preview(processed) {
  return {
    closingYear,
    nextYear: closingYear + 1,
    employees: 1,
    totalCarried: 10,
    totalLapsed: 4,
    totalEncashable: 2,
    projected: false,
    lastProcessedAt: processed ? '2026-01-01T00:30:00' : null,
    rows: [{
      employeeId: 7, employeeName: 'Asha Employee', employeeCode: 'E-7', leaveTypeId: 3, leaveTypeName: 'Earned Leave',
      year: closingYear, closing: 14, carried: 10, lapsed: 4, encashable: 2, processed,
    }],
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <YearEndProcessing />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('YearEndProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leavePolicyApi.yearEndPreview.mockResolvedValue(preview(false));
    leavePolicyApi.runYearEnd.mockResolvedValue(preview(true));
  });

  afterEach(() => cleanup());

  it('previews closing, carried and lapsed days and runs the year-end after confirmation', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: `Year-end ${closingYear} preview` });
    const row = within(table).getByText('Asha Employee').closest('tr');
    expect(within(row).getByText('14')).toBeTruthy();
    expect(within(row).getByText('10')).toBeTruthy();
    expect(within(row).getByText('Pending')).toBeTruthy();
    expect(leavePolicyApi.yearEndPreview).toHaveBeenCalledWith(closingYear);

    await userEvent.click(screen.getAllByRole('button', { name: /run year-end/i })[0]);
    const dialogButtons = await screen.findAllByRole('button', { name: /run year-end/i });
    await userEvent.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(leavePolicyApi.runYearEnd).toHaveBeenCalledWith(closingYear));
    expect(await screen.findByText('Processed')).toBeTruthy();
  });
});
