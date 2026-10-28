import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login.jsx';

const mocks = vi.hoisted(() => ({
  authApi: { sendMfaEmailCode: vi.fn() },
  auth: null,
}));

vi.mock('../api/endpoints/auth', () => ({ authApi: mocks.authApi }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));

function setAuth(overrides = {}) {
  mocks.auth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    verifyMfa: vi.fn(),
    ...overrides,
  };
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function signIn() {
  fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'asha' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Secret#1' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

function apiError(status, message) {
  const error = new Error(message);
  error.response = { status, data: { message } };
  error.apiMessage = message;
  return error;
}

describe('Login / two-step verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('goes straight to the app when no second factor is needed', async () => {
    setAuth();
    mocks.auth.login.mockResolvedValue({ id: 1, username: 'asha' });
    renderLogin();
    signIn();
    expect(await screen.findByText('dashboard page')).toBeTruthy();
    expect(mocks.auth.verifyMfa).not.toHaveBeenCalled();
  });

  it('asks for an authenticator code, shows a wrong-code error, then signs in and remembers the device', async () => {
    setAuth();
    mocks.auth.login.mockResolvedValue({
      mfaRequired: true,
      mfaToken: 'challenge-1',
      methods: ['TOTP', 'RECOVERY'],
      maskedEmail: 'as***@example.com',
      identifier: 'asha',
    });
    mocks.auth.verifyMfa
      .mockRejectedValueOnce(apiError(401, 'Invalid or expired verification code'))
      .mockResolvedValueOnce({ id: 1, username: 'asha' });
    renderLogin();
    signIn();

    expect(await screen.findByText(/verify it.s you/i)).toBeTruthy();
    expect(mocks.auth.login).toHaveBeenCalledWith('asha', 'Secret#1');
    expect(screen.getByRole('button', { name: /authenticator app/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /recovery code/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /email code/i })).toBeNull();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify/i }));
    expect(await screen.findByText(/that code didn.t work/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '654321' } });
    fireEvent.click(screen.getByLabelText(/remember this device/i));
    fireEvent.click(screen.getByRole('button', { name: /^verify/i }));

    await waitFor(() => expect(mocks.auth.verifyMfa).toHaveBeenLastCalledWith({
      mfaToken: 'challenge-1',
      method: 'TOTP',
      code: '654321',
      rememberDevice: true,
      identifier: 'asha',
    }));
    expect(await screen.findByText('dashboard page')).toBeTruthy();
  });

  it('switches to a recovery code', async () => {
    setAuth();
    mocks.auth.login.mockResolvedValue({ mfaRequired: true, mfaToken: 't', methods: ['TOTP', 'RECOVERY'], identifier: 'asha' });
    mocks.auth.verifyMfa.mockResolvedValue({ id: 1 });
    renderLogin();
    signIn();

    fireEvent.click(await screen.findByRole('button', { name: /recovery code/i }));
    fireEvent.change(screen.getByLabelText(/^recovery code$/i), { target: { value: 'abcde-fghjk' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify/i }));
    await waitFor(() => expect(mocks.auth.verifyMfa).toHaveBeenCalledWith(expect.objectContaining({
      method: 'RECOVERY',
      code: 'abcde-fghjk',
    })));
  });

  it('emails a code automatically when email is the only method', async () => {
    setAuth();
    mocks.auth.login.mockResolvedValue({ mfaRequired: true, mfaToken: 't2', methods: ['EMAIL'], maskedEmail: 'as***@example.com', identifier: 'asha' });
    mocks.authApi.sendMfaEmailCode.mockResolvedValue({ sentTo: 'as***@example.com', expiresInSeconds: 300, resendAfterSeconds: 60 });
    renderLogin();
    signIn();

    await waitFor(() => expect(mocks.authApi.sendMfaEmailCode).toHaveBeenCalledWith('t2'));
    expect(await screen.findByText(/we sent a 6-digit code to as\*\*\*@example.com/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /resend code in/i }).disabled).toBe(true);
  });

  it('returns to the password form', async () => {
    setAuth();
    mocks.auth.login.mockResolvedValue({ mfaRequired: true, mfaToken: 't', methods: ['TOTP'], identifier: 'asha' });
    renderLogin();
    signIn();
    fireEvent.click(await screen.findByRole('button', { name: /back to sign in/i }));
    expect(screen.getByLabelText(/username or email/i)).toBeTruthy();
  });
});
