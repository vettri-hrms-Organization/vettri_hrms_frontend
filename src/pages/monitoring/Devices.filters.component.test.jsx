import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Devices from './Devices.jsx';

const { monitoringApi } = vi.hoisted(() => ({
  monitoringApi: {
    devices: vi.fn(),
    inventoryScanSummary: vi.fn(),
    deviceEmployeeOptions: vi.fn(),
    deviceEnrollments: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/monitoring', async (importOriginal) => ({
  ...(await importOriginal()),
  monitoringApi,
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => false }),
}));

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Devices />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function chip(name) {
  return within(screen.getByRole('group', { name: 'Quick device filters' }))
    .getByRole('button', { name: new RegExp(`^${name}\\s*\\d+$`) });
}

describe('devices quick filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    monitoringApi.devices.mockResolvedValue([
      { id: 1, deviceName: 'Alpha', online: true, lastSeenAt: daysAgo(0), agentVersion: '2.10.0', employeeId: 5, employeeName: 'Asha', serialNumber: 'SN-111' },
      { id: 2, deviceName: 'Bravo', online: false, lastSeenAt: daysAgo(10), agentVersion: '2.9.4', employeeId: null, employeeName: null },
      { id: 3, deviceName: 'Charlie', online: false, lastSeenAt: daysAgo(1), agentVersion: '2.10', employeeId: 7, employeeName: 'Ravi' },
    ]);
  });

  afterEach(() => cleanup());

  it('counts each chip from the fetched list and compares versions numerically', async () => {
    renderPage();
    await screen.findByText('Alpha');

    expect(chip('All').textContent).toContain('3');
    expect(chip('Online').textContent).toContain('1');
    expect(chip('Offline').textContent).toContain('2');
    expect(chip('Offline 7\\+ days').textContent).toContain('1');
    expect(chip('Unassigned').textContent).toContain('1');
    // 2.9.4 < 2.10.0 numerically; 2.10 equals 2.10.0
    expect(chip('Older agent').textContent).toContain('1');
    expect(screen.getAllByText('Update pending')).toHaveLength(1);
  });

  it('filters by chip and search, and clears filters from the empty state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Alpha');

    await user.click(chip('Older agent'));
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();

    await user.type(screen.getByRole('searchbox'), 'SN-111');
    expect(await screen.findByText('No matching devices')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
  });
});
