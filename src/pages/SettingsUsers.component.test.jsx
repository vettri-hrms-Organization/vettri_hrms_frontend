import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import SettingsUsers from './SettingsUsers.jsx';

const { usersApi, permissionsApi, rolesApi, authUser } = vi.hoisted(() => ({
  usersApi: {
    list: vi.fn(),
    permissionGrants: vi.fn(),
    grantPermission: vi.fn(),
    revokePermission: vi.fn(),
    assignRoles: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    create: vi.fn(),
  },
  permissionsApi: { list: vi.fn() },
  rolesApi: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
  authUser: {
    id: 10,
    permissions: ['USER_VIEW', 'USER_PERMISSION_GRANT', 'ROLE_VIEW', 'ROLE_ASSIGN', 'ATTENDANCE_MANAGE'],
    scopes: {
      USER_VIEW: ['ORGANIZATION'],
      USER_PERMISSION_GRANT: ['ORGANIZATION'],
      ROLE_VIEW: ['ORGANIZATION'],
      ROLE_ASSIGN: ['ORGANIZATION'],
      ATTENDANCE_MANAGE: ['ORGANIZATION'],
    },
  },
}));

vi.mock('../api/endpoints/users', () => ({ usersApi }));
vi.mock('../api/endpoints/roles', () => ({ permissionsApi, rolesApi }));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    hasPermission: (code) => authUser.permissions.includes(code),
    hasRole: (role) => false,
  }),
}));

describe('SettingsUsers direct permission grants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usersApi.list.mockResolvedValue([{
      id: 11,
      fullName: 'Asha Employee',
      email: 'asha@example.test',
      roles: ['EMPLOYEE'],
      permissions: [],
      active: true,
      lastLoginAt: null,
    }]);
    usersApi.permissionGrants.mockResolvedValue([]);
    usersApi.grantPermission.mockResolvedValue({
      id: 31,
      permissionCode: 'ATTENDANCE_MANAGE',
      scope: 'ORGANIZATION',
      active: true,
    });
    permissionsApi.list.mockResolvedValue([
      { code: 'ATTENDANCE_MANAGE', description: 'Manage attendance', requiredScope: 'ORGANIZATION' },
      { code: 'MONITORING_VIEW', description: 'View monitoring', requiredScope: null },
    ]);
  });

  afterEach(() => cleanup());

  it('loads grants and submits a permission and scope selected from the authorized catalog', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider><SettingsUsers /></ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: 'Permissions' }));
    expect(await screen.findByRole('dialog', { name: 'User permissions' })).toBeTruthy();

    const permissionSelect = await screen.findByLabelText('Permission');
    expect(permissionSelect.options).toHaveLength(1);
    expect(permissionSelect.value).toBe('ATTENDANCE_MANAGE');
    expect(screen.getByLabelText('Scope').value).toBe('ORGANIZATION');
    const expiryInput = screen.getByLabelText('Expires (optional)');
    await user.type(expiryInput, '2030-01-01T12:00');

    await user.click(screen.getByRole('button', { name: 'Grant' }));

    await waitFor(() => {
      expect(usersApi.grantPermission).toHaveBeenCalledWith(11, {
        permissionCode: 'ATTENDANCE_MANAGE',
        scope: 'ORGANIZATION',
        expiresAt: new Date('2030-01-01T12:00').toISOString(),
      });
    });
  });
});
