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
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { fullName: 'Hariharan Selvarasu', email: 'hari@xenon.in' }, hasPermission: () => true, refreshUser }),
}));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CreateOwnProfile /></QueryClientProvider>);
}

describe('CreateOwnProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    departmentsApi.list.mockResolvedValue([{ id: 4, name: 'Engineering', active: true }]);
    designationsApi.list.mockResolvedValue([{ id: 9, title: 'CTO', active: true }]);
    employeesApi.create.mockResolvedValue({ id: 12 });
    refreshUser.mockResolvedValue({ employeeId: 12 });
  });
  afterEach(() => cleanup());

  it('creates an employee record with the sign-in email and reloads the user', async () => {
    renderForm();
    expect(screen.getByLabelText('First name *').value).toBe('Hariharan');
    expect(screen.getByLabelText('Last name *').value).toBe('Selvarasu');
    await screen.findByText('Engineering');
    await userEvent.selectOptions(screen.getByLabelText('Department'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Create my profile' }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(employeesApi.create.mock.calls[0][0]).toMatchObject({
      firstName: 'Hariharan', lastName: 'Selvarasu', email: 'hari@xenon.in', departmentId: 4, designationId: null,
    });
  });

  it('shows the server message when the record cannot be created', async () => {
    employeesApi.create.mockRejectedValue({ response: { data: { message: 'An employee with email \'hari@xenon.in\' already exists' } } });
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create my profile' }));
    expect((await screen.findByRole('alert')).textContent).toContain('already exists');
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
