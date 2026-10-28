import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImportWizard from './ImportWizard.jsx';

const PREVIEW = {
  type: 'holidays', title: 'Holidays', fileName: 'h.xlsx', totalRows: 3, validRows: 1, invalidRows: 1, skippedRows: 1,
  columns: ['Date', 'Holiday Name', 'Type', 'Locations'],
  rows: [
    { row: 2, values: { Date: '2027-01-26', 'Holiday Name': 'Republic Day', Type: '', Locations: '' }, action: 'Add mandatory holiday', valid: true, skip: false, errors: [], warnings: [] },
    { row: 3, values: { Date: '2027-13-40', 'Holiday Name': 'Bad', Type: '', Locations: '' }, action: null, valid: false, skip: false, errors: ["Date '2027-13-40' is not a valid date (use YYYY-MM-DD)"], warnings: [] },
    { row: 4, values: { Date: '2027-01-14', 'Holiday Name': 'Pongal', Type: '', Locations: '' }, action: "Skip - 'Pongal' already on this date", valid: true, skip: true, errors: [], warnings: [] },
  ],
  message: '1 row is ready to import, 1 row needs attention, 1 will be skipped.',
  previousImportOfSameFile: null,
};

function setup() {
  const api = {
    downloadTemplate: vi.fn().mockResolvedValue(undefined),
    preview: vi.fn().mockResolvedValue(PREVIEW),
    commit: vi.fn().mockResolvedValue({
      batchId: 9, status: 'PARTIAL', totalRows: 3, importedRows: 1, skippedRows: 1, failedRows: 1,
      message: 'Holidays: 1 of 3 row(s) imported, 1 skipped, 1 not imported.', rows: PREVIEW.rows,
    }),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ImportWizard type="holidays" title="Holidays" api={api} />
    </QueryClientProvider>
  );
  return api;
}

describe('ImportWizard', () => {
  afterEach(cleanup);

  it('previews rows with highlighted errors and imports valid rows only by default', async () => {
    const user = userEvent.setup();
    const api = setup();
    const file = new File(['x'], 'holidays.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await user.upload(screen.getByTestId('import-file-input'), file);
    await user.click(screen.getByRole('button', { name: /Validate workbook/ }));

    expect(await screen.findByText(/is not a valid date/)).toBeTruthy();
    expect(screen.getByTestId('import-row-3').getAttribute('data-state')).toBe('error');
    expect(screen.getByTestId('import-row-4').getAttribute('data-state')).toBe('skip');
    expect(screen.getByTestId('import-row-2').getAttribute('data-state')).toBe('ok');
    expect(api.preview).toHaveBeenCalledWith('holidays', file, expect.objectContaining({ replace: false }));

    await user.click(screen.getByRole('button', { name: 'Import 1 row' }));
    await waitFor(() => expect(api.commit).toHaveBeenCalledWith('holidays', file, expect.objectContaining({ allOrNothing: false })));
    expect(await screen.findByText(/1 of 3 row\(s\) imported/)).toBeTruthy();
  });

  it('blocks all-or-nothing imports while rows have errors', async () => {
    const user = userEvent.setup();
    const api = setup();
    await user.upload(screen.getByTestId('import-file-input'), new File(['x'], 'h.xlsx'));
    await user.click(screen.getByRole('button', { name: /Validate workbook/ }));
    await screen.findByText(/is not a valid date/);
    await user.click(screen.getByLabelText(/All or nothing/));
    const button = screen.getByRole('button', { name: /Fix errors to import all/ });
    expect(button.disabled).toBe(true);
    expect(api.commit).not.toHaveBeenCalled();
  });
});
