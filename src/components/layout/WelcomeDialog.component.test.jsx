import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomeDialog from './WelcomeDialog.jsx';
import DemoBanner, { DemoEndedScreen } from './DemoBanner.jsx';
import { daysLeft } from './demoErrors';
import { REAL_SESSION_KEY } from './demoSession';

const { demoSandboxApi, establishSession, refreshUser } = vi.hoisted(() => ({
  demoSandboxApi: { choose: vi.fn(), create: vi.fn(), session: vi.fn() },
  establishSession: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock('../../api/endpoints/demoSandbox', () => ({ demoSandboxApi }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ establishSession, refreshUser }) }));
vi.mock('../../auth/tokenStorage', () => ({ tokenStorage: { getAccessToken: () => 'real-access', getRefreshToken: () => 'real-refresh' } }));

function renderAt(ui, path = '/dashboard') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<>{ui}<p>Dashboard page</p></>} />
          <Route path="/onboarding" element={<p>Setup page</p>} />
          <Route path="/billing" element={<p>Billing page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  try { sessionStorage.clear(); } catch { /* no storage */ }
  demoSandboxApi.choose.mockResolvedValue({ choice: 'SETUP' });
  demoSandboxApi.create.mockResolvedValue({ state: 'ACTIVE', demoCompanyId: 9 });
  demoSandboxApi.session.mockResolvedValue({ accessToken: 'demo-access', refreshToken: 'demo-refresh' });
  establishSession.mockResolvedValue({});
  refreshUser.mockResolvedValue({ companyId: 9 });
});
afterEach(() => cleanup());

describe('WelcomeDialog', () => {
  it('offers the two ways to start', () => {
    renderAt(<WelcomeDialog companyName="Xenon Software" />);
    expect(screen.getByRole('dialog', { name: 'Welcome to Vettri HRMS!' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Set Up My Organization/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Explore with Demo Data/ })).toBeTruthy();
  });

  it('records the setup choice and opens Workspace Setup', async () => {
    renderAt(<WelcomeDialog companyName="Xenon Software" />);
    await userEvent.click(screen.getByRole('button', { name: /Set Up My Organization/ }));
    expect(await screen.findByText('Setup page')).toBeTruthy();
    expect(demoSandboxApi.choose).toHaveBeenCalledWith('SETUP');
  });

  it('builds the demo, keeps the real sign-in for later and enters as Company Admin', async () => {
    let finishCreate;
    demoSandboxApi.create.mockImplementation(() => new Promise((resolve) => { finishCreate = resolve; }));
    renderAt(<WelcomeDialog companyName="Xenon Software" />);
    await userEvent.click(screen.getByRole('button', { name: /Explore with Demo Data/ }));
    expect(await screen.findByText('Creating organization…')).toBeTruthy();
    finishCreate({ state: 'ACTIVE' });
    await waitFor(() => expect(establishSession).toHaveBeenCalledWith({ accessToken: 'demo-access', refreshToken: 'demo-refresh' }));
    expect(demoSandboxApi.session).toHaveBeenCalledWith('ADMIN');
    expect(JSON.parse(sessionStorage.getItem(REAL_SESSION_KEY))).toEqual({ accessToken: 'real-access', refreshToken: 'real-refresh' });
  });

  it('shows the server message when the demo cannot be opened', async () => {
    demoSandboxApi.create.mockRejectedValue({ response: { data: { message: 'Your trial has ended' } } });
    renderAt(<WelcomeDialog companyName="Xenon Software" />);
    await userEvent.click(screen.getByRole('button', { name: /Explore with Demo Data/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Your trial has ended');
  });
});

describe('DemoBanner', () => {
  const demo = { demo: true, viewingAs: 'ADMIN', roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'], expiresAt: new Date(Date.now() + 3 * 86_400_000 - 1000).toISOString() };

  it('shows demo mode with days left and switches the role being viewed', async () => {
    renderAt(<DemoBanner demo={demo} />);
    expect(screen.getByText('Demo Mode')).toBeTruthy();
    expect(screen.getByText('3 days')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('View the demo as'), 'HR');
    await waitFor(() => expect(demoSandboxApi.session).toHaveBeenCalledWith('HR'));
  });

  it('returns to the real company on Exit demo', async () => {
    sessionStorage.setItem(REAL_SESSION_KEY, JSON.stringify({ accessToken: 'real-access', refreshToken: 'real-refresh' }));
    renderAt(<DemoBanner demo={demo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Exit demo' }));
    expect(await screen.findByText('Setup page')).toBeTruthy();
    expect(establishSession).toHaveBeenCalledWith({ accessToken: 'real-access', refreshToken: 'real-refresh' });
    expect(sessionStorage.getItem(REAL_SESSION_KEY)).toBeNull();
  });

  it('offers to subscribe once the demo has ended', async () => {
    sessionStorage.setItem(REAL_SESSION_KEY, JSON.stringify({ accessToken: 'real-access', refreshToken: 'real-refresh' }));
    renderAt(<DemoEndedScreen />);
    expect(screen.getByRole('heading', { name: 'Your demo has ended' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByText('Billing page')).toBeTruthy();
  });
});

describe('daysLeft', () => {
  it('counts whole days and never goes below zero', () => {
    const now = new Date('2026-11-07T10:00:00Z');
    expect(daysLeft('2026-11-09T09:00:00Z', now)).toBe(2);
    expect(daysLeft('2026-11-01T09:00:00Z', now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
});
