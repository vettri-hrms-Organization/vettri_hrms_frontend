import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import RosterGrid from './RosterGrid.jsx';

const mocks = vi.hoisted(() => ({
  rosterApi: { get: vi.fn(), update: vi.fn(), copyWeek: vi.fn() },
  canManage: true,
}));

vi.mock('../../api/endpoints/shifts', () => ({ rosterApi: mocks.rosterApi }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: (code) => code !== 'ATTENDANCE_MANAGE' || mocks.canManage }),
}));

const SHIFTS = [
  { id: 1, code: 'GEN', name: 'General shift', startTime: '09:30', endTime: '18:30', color: '#2563eb', active: true },
  { id: 2, code: 'NGT', name: 'Night', startTime: '22:00', endTime: '06:00', color: '#7c3aed', active: true },
];

function rosterFor(from) {
  const [y, m, d] = from.split('-').map(Number);
  const cells = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    return { date, shiftId: 1, shiftCode: 'GEN', color: '#2563eb', weekOff: i >= 5, rostered: false, source: 'COMPANY' };
  });
  return { from, to: cells[6].date, shifts: SHIFTS, rows: [{ employeeId: 7, employeeCode: 'E007', employeeName: 'Asha Rao', departmentName: 'Support', cells }] };
}

function renderGrid() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <RosterGrid />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RosterGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canManage = true;
    mocks.rosterApi.get.mockImplementation((from) => Promise.resolve(rosterFor(from)));
    mocks.rosterApi.update.mockResolvedValue({ updated: 1 });
  });
  afterEach(() => cleanup());

  it('saves only the changed cells as roster entries', async () => {
    renderGrid();
    const selects = await screen.findAllByRole('combobox', { name: /Asha Rao on/ });
    expect(selects).toHaveLength(7);

    fireEvent.change(selects[0], { target: { value: '2' } });
    fireEvent.change(selects[1], { target: { value: 'WO' } });
    fireEvent.click(screen.getByRole('button', { name: /Save \(2\)/ }));

    await waitFor(() => expect(mocks.rosterApi.update).toHaveBeenCalledTimes(1));
    const cells = mocks.rosterApi.update.mock.calls[0][0];
    expect(cells).toHaveLength(2);
    expect(cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ employeeId: 7, shiftId: 2, weekOff: false, clear: false }),
      expect.objectContaining({ employeeId: 7, shiftId: null, weekOff: true, clear: false }),
    ]));
  });

  it('is read-only without ATTENDANCE_MANAGE', async () => {
    mocks.canManage = false;
    renderGrid();
    expect(await screen.findByText('Asha Rao')).toBeTruthy();
    expect(screen.queryAllByRole('combobox', { name: /Asha Rao on/ })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });
});
