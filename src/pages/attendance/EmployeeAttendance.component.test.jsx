import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeAttendance from './EmployeeAttendance.jsx';
import { policyFacts } from './MyAttendanceParts.jsx';
import { addDays, istToday } from './shiftUtils';

const { attendanceApi, dailyAttendanceApi } = vi.hoisted(() => ({
  attendanceApi: {
    today: vi.fn(), myHistory: vi.fn(), context: vi.fn(), policy: vi.fn(), officeLocations: vi.fn(),
    myWfh: vi.fn(), myRegularizations: vi.fn(), checkIn: vi.fn(), checkOut: vi.fn(), requestWfh: vi.fn(), requestRegularization: vi.fn(),
  },
  dailyAttendanceApi: { mine: vi.fn() },
}));

vi.mock('../../api/endpoints/attendance', () => ({ attendanceApi }));
vi.mock('../../api/endpoints/shifts', () => ({ dailyAttendanceApi }));
vi.mock('../../api/endpoints/timesheets', () => ({ timesheetsApi: { settings: vi.fn().mockResolvedValue({ enabled: false }) } }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('./MyShiftOvertime', () => ({ default: () => null }));
vi.mock('../timesheets/LogWorkDialog', () => ({ default: () => null }));
vi.mock('../../components/attendance/SelfieCapture', () => ({ default: () => null }));

const today = istToday();
const yesterday = addDays(today, -1);
const twoDaysAgo = addDays(today, -2);

function day(date, extra) {
  return {
    date, shiftName: 'General', shiftStart: '10:00', shiftEnd: '18:30', status: 'PRESENT',
    firstIn: null, lastOut: null, workedMinutes: 0, lateInMinutes: 0, late: false, missingOut: false,
    holiday: false, weekOff: false, leave: null, ...extra,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><EmployeeAttendance /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EmployeeAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { localStorage.clear(); } catch { /* jsdom without storage */ }
    attendanceApi.today.mockResolvedValue(null);
    attendanceApi.myHistory.mockResolvedValue([]);
    attendanceApi.context.mockResolvedValue({ allowedWebCheckIn: true, workMode: 'OFFICE', attendanceMethod: 'WEB_APP_ONLY' });
    attendanceApi.policy.mockResolvedValue({ attendanceMethod: 'WEB_APP_ONLY', gracePeriodMinutes: 10, manualRegularizationEnabled: true, regularizationApprovalRequired: true });
    attendanceApi.officeLocations.mockResolvedValue([]);
    attendanceApi.myWfh.mockResolvedValue([]);
    attendanceApi.myRegularizations.mockResolvedValue([]);
    dailyAttendanceApi.mine.mockImplementation(async (from, to) => [
      day(twoDaysAgo, { status: 'WEEK_OFF', weekOff: true }),
      day(yesterday, { firstIn: `${yesterday}T05:11:00Z`, lastOut: `${yesterday}T12:47:00Z`, workedMinutes: 396, late: true, lateInMinutes: 41 }),
      day(today, { status: 'ABSENT' }),
    ].filter((entry) => entry.date >= from && entry.date <= to));
  });

  afterEach(() => cleanup());

  it('shows the day-by-day log with hours, lateness and weekly offs', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Attendance log' });
    expect(within(table).getByText('Full day weekly-off')).toBeTruthy();
    expect(within(table).getByText('6h 36m')).toBeTruthy(); // effective
    expect(within(table).getByText('1h 0m')).toBeTruthy(); // break
    expect(within(table).getByText('7h 36m')).toBeTruthy(); // gross
    expect(within(table).getByText('0:41 late')).toBeTruthy();
    expect(within(table).getByText('10:41 am – 06:17 pm')).toBeTruthy();
  });

  it('switches the log to 24-hour times', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Attendance log' });
    await userEvent.click(screen.getByRole('switch', { name: /24 hour format/ }));
    expect(within(table).getByText('10:41 – 18:17')).toBeTruthy();
  });

  it('opens regularization for a chosen day from the row menu', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'Attendance log' });
    await userEvent.click(screen.getByRole('button', { name: `Actions for ${yesterday}` }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Regularize attendance' }));
    expect(screen.getByLabelText('Attendance date').value).toBe(yesterday);
  });

  it('explains the attendance policy in plain words', () => {
    const facts = policyFacts({ attendanceMethod: 'HYBRID', gracePeriodMinutes: 10, manualRegularizationEnabled: true, regularizationApprovalRequired: true, remoteCheckInEnabled: true });
    expect(facts).toContain('Attendance is recorded by: Hybrid.');
    expect(facts).toContain('Arriving up to 10 minutes after your shift starts still counts as on time.');
    expect(facts).toContain('Missed or wrong punches can be regularized; your manager approves the request.');
  });
});
