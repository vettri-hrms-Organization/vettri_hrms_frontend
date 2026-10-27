import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DeviceEnrollment from './DeviceEnrollment.jsx';

const { enrollmentApi } = vi.hoisted(() => ({
  enrollmentApi: {
    deviceEnrollmentStatus: vi.fn(),
    deviceEnrollmentInventory: vi.fn(),
    requestDeviceEnrollmentInventory: vi.fn(),
    deviceEnrollmentInstallerUrl: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/monitoring', () => ({
  monitoringApi: enrollmentApi,
}));

describe('device hardware inventory enrollment', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('requires employee consent and reports an offline agent without claiming a successful scan', async () => {
    enrollmentApi.deviceEnrollmentStatus.mockResolvedValue({
      status: 'USED',
      employeeName: 'Alex Employee',
      companyName: 'Example Org',
      device: {
        deviceName: 'Alex Laptop',
        operatingSystem: 'Windows',
        agentVersion: '2.0.1',
      },
    });
    enrollmentApi.deviceEnrollmentInventory.mockResolvedValueOnce({
      enrollmentStatus: 'USED',
      scanStatus: 'NOT_SCANNED',
      deviceOnline: false,
      selectedDeviceId: 42,
      trustedDevices: [],
      message: 'No hardware inventory has been collected yet.',
      inventory: null,
    });
    enrollmentApi.deviceEnrollmentInventory.mockResolvedValue({
      enrollmentStatus: 'USED',
      scanStatus: 'OFFLINE',
      deviceOnline: false,
      selectedDeviceId: 42,
      trustedDevices: [],
      message: 'The registered agent is offline. Connect the laptop to the internet and retry.',
      inventory: null,
    });
    enrollmentApi.requestDeviceEnrollmentInventory.mockResolvedValue({
      enrollmentStatus: 'USED',
      scanStatus: 'OFFLINE',
      deviceOnline: false,
      selectedDeviceId: 42,
      trustedDevices: [],
      message: 'The registered agent is offline. Connect the laptop to the internet and retry.',
      inventory: null,
    });

    render(
      <MemoryRouter initialEntries={['/device-enrollment/enrollment-token-example']}>
        <Routes>
          <Route path="/device-enrollment/:token" element={<DeviceEnrollment />} />
        </Routes>
      </MemoryRouter>,
    );

    const scanButton = await screen.findByRole('button', { name: 'Start hardware scan' });
    expect(scanButton.disabled).toBe(true);
    expect(enrollmentApi.requestDeviceEnrollmentInventory).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('checkbox', {
      name: /I consent to collect and store the hardware details/i,
    }));
    await userEvent.click(scanButton);

    await waitFor(() => {
      expect(enrollmentApi.requestDeviceEnrollmentInventory)
        .toHaveBeenCalledWith('enrollment-token-example', '');
    });
    expect(await screen.findByText(/registered agent is offline/i)).toBeTruthy();
    expect(screen.queryByText('Device inventory is available.')).toBeNull();
  });
});
