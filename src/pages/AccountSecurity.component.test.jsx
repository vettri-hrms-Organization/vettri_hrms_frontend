import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import ProtectedRoute from '../auth/ProtectedRoute.jsx';
import AccountSecurity from './AccountSecurity.jsx';

const mocks = vi.hoisted(() => ({
  authApi: { changePassword: vi.fn() },
  auth: null,
}));

vi.mock('../api/endpoints/auth', () => ({ authApi: mocks.authApi }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));

function setAuth(user) {
  mocks.auth = {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn().mockResolvedValue({ ...user, mustChangePassword: false }),
    logout: vi.fn().mockResolvedValue(undefined),
    hasPermission: () => true,
    hasRole: () => false,
    hasAnyRole: () => false,
  };
}

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/account/security" element={<AccountSecurity />} />
              <Route path="/dashboard" element={<div>dashboard page</div>} />
            </Route>
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('AccountSecurity / forced password change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('redirects every authenticated route to change-password while mustChangePassword is set', () => {
    setAuth({ username: 'asha', mustChangePassword: true, permissions: [] });
    renderAt('/dashboard');
    expect(screen.queryByText('dashboard page')).toBeNull();
    expect(screen.getByText(/must change your password/i)).toBeTruthy();
  });

  it('does not redirect when the flag is clear', () => {
    setAuth({ username: 'asha', mustChangePassword: false, permissions: [] });
    renderAt('/dashboard');
    expect(screen.getByText('dashboard page')).toBeTruthy();
  });

  it('enforces the strength rules and confirmation before calling the API', async () => {
    setAuth({ username: 'asha', mustChangePassword: false, permissions: [] });
    renderAt('/account/security');

    fill(/^Current password/i, 'Old#Pass1');
    fill(/^New password/i, 'weakpass');
    fill(/^Confirm new password/i, 'weakpass');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText(/must be at least 8 characters and include/i)).toBeTruthy();

    fill(/^New password/i, 'New#Pass1');
    fill(/^Confirm new password/i, 'New#Pass2');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText(/do not match/i)).toBeTruthy();
    expect(mocks.authApi.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password then signs in again with the new password', async () => {
    setAuth({ username: 'asha', mustChangePassword: true, permissions: [] });
    mocks.authApi.changePassword.mockResolvedValue({ message: 'Password changed successfully' });
    renderAt('/account/security');

    fill(/^Current password/i, 'Temp#Pass1');
    fill(/^New password/i, 'New#Pass1');
    fill(/^Confirm new password/i, 'New#Pass1');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(mocks.authApi.changePassword).toHaveBeenCalledWith('Temp#Pass1', 'New#Pass1'));
    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledWith('asha', 'New#Pass1'));
    expect(await screen.findByText(/password changed/i)).toBeTruthy();
    expect(mocks.auth.logout).not.toHaveBeenCalled();
  });

  it('logs out and sends the user to sign in if re-login fails', async () => {
    setAuth({ username: 'asha', mustChangePassword: false, permissions: [] });
    mocks.auth.login.mockRejectedValue(new Error('nope'));
    mocks.authApi.changePassword.mockResolvedValue({ message: 'ok' });
    renderAt('/account/security');

    fill(/^Current password/i, 'Old#Pass1');
    fill(/^New password/i, 'New#Pass1');
    fill(/^Confirm new password/i, 'New#Pass1');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(mocks.auth.logout).toHaveBeenCalled());
    expect(await screen.findByText('login page')).toBeTruthy();
  });
});
