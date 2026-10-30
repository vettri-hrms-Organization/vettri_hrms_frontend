import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import { formatHours, mondayOf, parseHours, addDaysIso } from '../../api/endpoints/timesheets';
import MyTimesheet from './MyTimesheet.jsx';

const { timesheetsApi } = vi.hoisted(() => ({
  timesheetsApi: { myWeek: vi.fn(), saveEntry: vi.fn(), deleteEntry: vi.fn(), submit: vi.fn(), recall: vi.fn() },
}));

vi.mock('../../api/endpoints/timesheets', async (importOriginal) => ({ ...(await importOriginal()), timesheetsApi }));

const monday = mondayOf();
const days = Array.from({ length: 7 }, (_, i) => ({ date: addDaysIso(monday, i), attendanceMinutes: i === 0 ? 480 : 0, holiday: false, weekOff: i > 4, onLeave: false, future: false }));

function week(overrides = {}) {
  return {
    weekId: 5, employeeId: 7, employeeName: 'Asha', weekStart: monday, weekEnd: addDaysIso(monday, 6), status: 'DRAFT', editable: true,
    totalMinutes: 0, billableMinutes: 0, targetMinutes: 2400, attendanceMinutes: 480, requireNotes: false, canReview: false,
    days, entries: [], projects: [{ id: 3, name: 'Acme Portal', code: null, clientName: 'Acme', billable: true, tasks: [] }],
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><ToastProvider><MyTimesheet /></ToastProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('hours parsing', () => {
  it('reads the formats people type', () => {
    expect(parseHours('2')).toBe(120);
    expect(parseHours('1.5')).toBe(90);
    expect(parseHours('7:30')).toBe(450);
    expect(parseHours('7h 30m')).toBe(450);
    expect(parseHours('45m')).toBe(45);
    expect(parseHours('')).toBe(0);
    expect(parseHours('abc')).toBeNull();
    expect(formatHours(450)).toBe('7h 30m');
  });
});

describe('MyTimesheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    timesheetsApi.myWeek.mockResolvedValue(week());
  });
  afterEach(() => cleanup());

  it('adds a project row and saves hours typed into a day', async () => {
    const entry = { id: 11, workDate: monday, projectId: 3, projectName: 'Acme Portal', taskId: null, taskName: null, minutes: 450, notes: null, billable: true };
    timesheetsApi.saveEntry.mockResolvedValue(week({ entries: [entry], totalMinutes: 450, billableMinutes: 450 }));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Add row' }));
    await userEvent.selectOptions(screen.getByLabelText(/Project \/ task/), '3:0');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add row' }));

    const cell = (await screen.findAllByLabelText(/Hours for Acme Portal/))[0];
    await userEvent.type(cell, '7:30{enter}');

    await waitFor(() => expect(timesheetsApi.saveEntry).toHaveBeenCalled());
    expect(timesheetsApi.saveEntry.mock.calls[0][0]).toMatchObject({ workDate: monday, projectId: 3, minutes: 450 });
    expect((await screen.findAllByText('7h 30m')).length).toBeGreaterThan(0);
  });

  it('locks the grid once the week is approved', async () => {
    timesheetsApi.myWeek.mockResolvedValue(week({ status: 'APPROVED', editable: false, totalMinutes: 60,
      entries: [{ id: 1, workDate: monday, projectId: null, projectName: 'General work', taskId: null, taskName: null, minutes: 60, notes: null, billable: false }] }));
    renderPage();
    expect(await screen.findByText('Approved and locked.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit week' })).toBeNull();
    expect(screen.getAllByLabelText(/Hours for General work/)[0].disabled).toBe(true);
  });
});
