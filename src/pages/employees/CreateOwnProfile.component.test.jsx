import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateOwnProfile from './CreateOwnProfile.jsx';

const { employeesApi, departmentsApi, designationsApi, refreshUser } = vi.hoisted(() => ({
  employeesApi: { create: vi.fn() },
  departmentsApi: { list: vi.fn() },
  designationsApi: { list: vi.fn() },
  refreshUser: vi.fn(),
}));

vi.mock('../../api/endpoints/employees', () => ({ employeesApi }));
vi.mock('../../api/endpoints/organization', () => ({ departmentsApi, designationsApi }));
let mockUser;
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, hasPermission: () => true, refreshUser }),
}));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CreateOwnProfile /></QueryClientProvider>);
}

describe('CreateOwnProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { fullName: 'Hariharan Selvarasu', email: 'hari@xenon.in' };
    departmentsApi.list.mockResolvedValue([{ id: 4, name: 'Engineering', active: true }]);
    designationsApi.list.mockResolvedValue([{ id: 9, title: 'CTO', active: true }]);
    employeesApi.create.mockResolvedValue({ id: 12 });
    refreshUser.mockResolvedValue({ employeeId: 12 });
  });
  afterEach(() => cleanup());

  it('creates the record from the sign-up details as soon as the page opens', async () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Setting up your profile' })).toBeTruthy();
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(employeesApi.create).toHaveBeenCalledTimes(1);
    expect(employeesApi.create.mock.calls[0][0]).toMatchObject({
      firstName: 'Hariharan', lastName: 'Selvarasu', email: 'hari@xenon.in', employmentType: 'FULL_TIME', departmentId: null,
    });
  });

  it('falls back to the form with the server message when it cannot be created', async () => {
    employeesApi.create.mockRejectedValue({ response: { data: { message: 'Employee limit reached for your plan' } } });
    renderForm();
    expect((await screen.findByRole('alert')).textContent).toContain('Employee limit reached');
    expect(screen.getByLabelText('First name *').value).toBe('Hariharan');
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('asks for the missing surname instead of guessing one', async () => {
    mockUser = { fullName: 'Hariharan', email: 'hari@xenon.in' };
    renderForm();
    await screen.findByText('Engineering');
    expect(employeesApi.create).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Last name *'), 'S');
    await userEvent.selectOptions(screen.getByLabelText('Department'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Create my profile' }));
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(employeesApi.create.mock.calls[0][0]).toMatchObject({ lastName: 'S', departmentId: 4 });
  });
});
