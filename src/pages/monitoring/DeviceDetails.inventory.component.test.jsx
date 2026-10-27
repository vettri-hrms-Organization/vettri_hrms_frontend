import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DeviceDetails from './DeviceDetails.jsx';

const { monitoringApi } = vi.hoisted(() => ({
  monitoringApi: {
    deviceById: vi.fn(),
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
  useAuth: () => ({
    hasPermission: (permission) => ['IT_MANAGEMENT_ACCESS', 'MONITORING_MANAGE'].includes(permission),
  }),
}));

describe('device details hardware inventory scan', () => {
  let device;

  beforeEach(() => {
    vi.clearAllMocks();
    device = {
      id: 21,
      deviceName: 'Alex Laptop',
      status: 'OFFLINE',
      online: false,
      active: true,
      inventoryStatus: 'NOT_SCANNED',
      hardwareInventory: null,
    };
    monitoringApi.deviceById.mockImplementation(async () => device);
    monitoringApi.sessionsByDevice.mockResolvedValue([]);
    monitoringApi.remoteSupportJobs.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it('queues one scan, shows the offline queued status, and prevents duplicate requests', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    monitoringApi.requestDeviceInventoryScan.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <MemoryRouter initialEntries={['/devices/21']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/devices/:id" element={<DeviceDetails />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const scanButton = await screen.findByRole('button', { name: 'Scan Specifications' });
    await user.click(scanButton);

    expect(monitoringApi.requestDeviceInventoryScan).toHaveBeenCalledTimes(1);
    expect(monitoringApi.requestDeviceInventoryScan).toHaveBeenCalledWith('21');
    expect(scanButton.disabled).toBe(true);

    device = { ...device, inventoryStatus: 'PENDING' };
    resolveRequest(device);

    expect(await screen.findByText('SCAN_QUEUED')).toBeTruthy();
    expect(await screen.findByText(/agent is offline.*queued and will run when it reconnects/i)).toBeTruthy();
    await waitFor(() => expect(scanButton.disabled).toBe(true));
    await user.click(scanButton);
    expect(monitoringApi.requestDeviceInventoryScan).toHaveBeenCalledTimes(1);
  });
});
