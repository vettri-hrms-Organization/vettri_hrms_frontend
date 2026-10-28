import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login.jsx';

const mocks = vi.hoisted(() => ({
  authApi: {
    sendMfaEmailCode: vi.fn(),
    ssoProviders: vi.fn(),
    ssoExchange: vi.fn(),
    ssoStartUrl: (provider) => `https://api.test/api/auth/sso/${provider}/start`,
  },
  auth: null,
}));

vi.mock('../api/endpoints/auth', () => ({ authApi: mocks.authApi }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));

function renderAt(path) {
  mocks.auth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    verifyMfa: vi.fn(),
    establishSession: vi.fn().mockResolvedValue({ id: 1 }),
  };
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Login / single sign-on', () => {
  beforeEach(() => {
    mocks.authApi.ssoProviders.mockResolvedValue({ providers: [{ id: 'google', name: 'Google' }, { id: 'microsoft', name: 'Microsoft' }] });
  });
  afterEach(() => cleanup());

  it('shows a button per configured provider that starts the backend redirect', async () => {
    renderAt('/login');
    const google = await screen.findByRole('link', { name: /continue with google/i });
    expect(google.getAttribute('href')).toBe('https://api.test/api/auth/sso/google/start');
    expect(screen.getByRole('link', { name: /continue with microsoft/i })).toBeTruthy();
  });

  it('shows no SSO buttons when nothing is configured', async () => {
    mocks.authApi.ssoProviders.mockResolvedValue({ providers: [] });
    renderAt('/login');
    await waitFor(() => expect(mocks.authApi.ssoProviders).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /continue with/i })).toBeNull();
  });

  it('exchanges the one-time code once and signs the user in', async () => {
    mocks.authApi.ssoExchange.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 1 } });
    renderAt('/login?sso_code=one-time');
    expect(await screen.findByText('dashboard page')).toBeTruthy();
    expect(mocks.authApi.ssoExchange).toHaveBeenCalledTimes(1);
    expect(mocks.authApi.ssoExchange).toHaveBeenCalledWith('one-time');
    expect(mocks.auth.establishSession).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r', user: { id: 1 } });
  });

  it('continues with the two-step challenge when the company requires it', async () => {
    mocks.authApi.ssoExchange.mockResolvedValue({ mfaRequired: true, mfaToken: 'm1', methods: ['TOTP'] });
    renderAt('/login?sso_code=one-time');
    expect(await screen.findByText(/verify it.s you/i)).toBeTruthy();
    expect(mocks.auth.establishSession).not.toHaveBeenCalled();
  });

  it('explains SSO errors from the callback', async () => {
    renderAt('/login?sso_error=account_not_found');
    expect(await screen.findByText(/couldn't find an active vettri account/i)).toBeTruthy();
    expect(mocks.authApi.ssoExchange).not.toHaveBeenCalled();
  });
});
