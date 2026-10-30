import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import { ProfileSections } from './SelfServiceProfile.jsx';

const { profileApi } = vi.hoisted(() => ({
  profileApi: {
    get: vi.fn(), updateDetails: vi.fn(), requestChange: vi.fn(), withdraw: vi.fn(),
    saveEntry: vi.fn(), deleteEntry: vi.fn(), uploadPhoto: vi.fn(), removePhoto: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/profile', () => ({ profileApi }));

function profile(overrides = {}) {
  return {
    employeeId: 7, fullName: 'Asha Rao', firstName: 'Asha', lastName: 'Rao', dateOfBirth: '1995-04-12', gender: 'Female',
    workEmail: 'asha@acme.in', phone: '9876543210', personalEmail: null, address: 'Chennai', permanentAddress: null,
    bloodGroup: null, maritalStatus: null, aboutMe: null, emergencyContactName: null, emergencyContactRelation: null,
    emergencyContactPhone: null, profilePhotoUrl: null, family: [], education: [], experience: [], changeRequests: [],
    ...overrides,
  };
}

function renderSections(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <div className="row"><ProfileSections employee={{ id: 7 }} isOwnRecord canManage={false} {...props} /></div>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Self-service profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileApi.get.mockResolvedValue(profile());
  });
  afterEach(() => cleanup());

  it('lets an employee update their own contact details', async () => {
    profileApi.updateDetails.mockResolvedValue(profile({ personalEmail: 'asha@gmail.com' }));
    renderSections();

    expect(await screen.findByText('asha@acme.in')).toBeTruthy();
    const contact = screen.getByText('Contact').closest('.hz-card');
    await userEvent.click(within(contact).getByRole('button', { name: 'Edit' }));
    await userEvent.type(screen.getByLabelText('Personal email'), 'asha@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(profileApi.updateDetails).toHaveBeenCalled());
    expect(profileApi.updateDetails.mock.calls[0][1]).toMatchObject({ personalEmail: 'asha@gmail.com', phone: '9876543210' });
    expect(await screen.findByText('asha@gmail.com')).toBeTruthy();
  });

  it('sends a legal name change to HR instead of saving it', async () => {
    profileApi.updateDetails.mockResolvedValue(profile());
    profileApi.requestChange.mockResolvedValue(profile({
      changeRequests: [{ id: 3, section: 'IDENTITY', status: 'PENDING', requestedAt: '2026-10-30T10:00:00', changes: [{ field: 'lastName', label: 'Last name', from: 'Rao', to: 'Kumar' }] }],
    }));
    renderSections();

    const personal = (await screen.findByText('Personal')).closest('.hz-card');
    await userEvent.click(within(personal).getByRole('button', { name: 'Edit' }));
    const lastName = screen.getByLabelText(/Last name/);
    await userEvent.clear(lastName);
    await userEvent.type(lastName, 'Kumar');
    await userEvent.click(screen.getByRole('button', { name: 'Save & send for approval' }));

    await waitFor(() => expect(profileApi.requestChange).toHaveBeenCalledWith(7, 'IDENTITY', { lastName: 'Kumar' }, null));
    expect(await screen.findByText(/waiting for HR approval/)).toBeTruthy();
  });

  it('shows no edit buttons to colleagues without HR rights', async () => {
    renderSections({ isOwnRecord: false, canManage: false });
    expect(await screen.findByText('asha@acme.in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});
