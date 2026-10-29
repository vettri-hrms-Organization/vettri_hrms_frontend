import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DeviceDetails from './DeviceDetails.jsx';

const { monitoringApi } = vi.hoisted(() => ({
  monitoringApi: {
    deviceById: vi.fn(),
    devices: vi.fn(),
    sessionsByDevice: vi.fn(),
    remoteSupportJobs: vi.fn(),
    requestDeviceInventoryScan: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/monitoring', async (importOriginal) => ({
  ...(await importOriginal()),
  monitoringApi,
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(entry = '/devices/21') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/devices/:id" element={<><DeviceDetails /><LocationProbe /></>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const GiB = 1024 ** 3;

describe('device details health row and tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    monitoringApi.deviceById.mockResolvedValue({
      id: 21,
      deviceName: 'Alex Laptop',
      online: true,
      lastSeenAt: new Date().toISOString(),
      agentVersion: '2.1.0',
      employeeId: 9,
      employeeName: 'Alex Kumar',
      inventoryStatus: 'COMPLETED',
      lastInventoryScanAt: new Date().toISOString(),
      hardwareInventory: { installedMemoryBytes: 16 * GiB, physicalDisks: [{ model: 'NVMe', capacityBytes: 512 * GiB }] },
    });
    monitoringApi.devices.mockResolvedValue([{ id: 21, agentVersion: '2.1.0' }, { id: 22, agentVersion: '2.2.0' }]);
    monitoringApi.sessionsByDevice.mockResolvedValue([]);
    monitoringApi.remoteSupportJobs.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it('shows labelled health cards derived from the device and fleet data', async () => {
    renderPage();

    const connection = await screen.findByTestId('device-health-connection');
    expect(within(connection).getByText('Online')).toBeTruthy();
    const inventory = screen.getByTestId('device-health-inventory');
    expect(within(inventory).getByText('Scanned')).toBeTruthy();
    expect(within(inventory).getByText(/16\.0 GB RAM/)).toBeTruthy();
    const agent = screen.getByTestId('device-health-agent');
    expect(await within(agent).findByText('Update pending')).toBeTruthy();
    expect(within(agent).getByText(/Newest in fleet: 2\.2\.0/)).toBeTruthy();
    expect(within(screen.getByTestId('device-health-employee')).getByText('Alex Kumar')).toBeTruthy();
  });

  it('keeps header actions visible and stores the selected tab in the URL', async () => {
    const user = userEvent.setup();
    renderPage('/devices/21?tab=hardware');

    expect(await screen.findByText('Installed RAM')).toBeTruthy();
    expect(screen.getByText('16.0 GB')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Rotate token/ })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /Remote support/ }));
    expect(screen.getByTestId('location').textContent).toBe('?tab=remote');
    expect(screen.queryByText('Installed RAM')).toBeNull();
    expect(screen.getByRole('button', { name: /Rotate token/ })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /Overview/ }));
    expect(screen.getByTestId('location').textContent).toBe('');
    expect(screen.getByText('Device details')).toBeTruthy();
  });
});
