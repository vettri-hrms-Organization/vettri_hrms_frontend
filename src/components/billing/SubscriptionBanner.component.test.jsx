import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubscriptionBanner, { bannerFor } from './SubscriptionBanner.jsx';

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  auth: { isAuthenticated: true, hasRole: () => false },
}));

vi.mock('../../api/endpoints/billing', () => ({
  billingApi: { status: mocks.status, payNow: vi.fn(), verifyRenewal: vi.fn() },
  loadRazorpay: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><SubscriptionBanner /></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mocks.status.mockReset();
});

describe('bannerFor', () => {
  it('shows trial days left, past due and read-only states', () => {
    expect(bannerFor({ status: 'TRIALING', daysLeft: 5, renewalDate: '2026-11-02' }).text).toContain('5 days');
    expect(bannerFor({ status: 'PAST_DUE', graceEndsOn: '2026-11-07' }).action).toBe('Pay now');
    expect(bannerFor({ status: 'SUSPENDED' }).tone).toBe('danger');
    expect(bannerFor({ status: 'ACTIVE', daysLeft: 20 })).toBeNull();
  });
});

describe('SubscriptionBanner', () => {
  it('shows the pay action to company admins only', async () => {
    mocks.status.mockResolvedValue({ status: 'SUSPENDED', canPay: true, dueInvoiceId: 3 });
    renderBanner();
    expect(await screen.findByRole('button', { name: /pay to restore/i })).toBeTruthy();
  });

  it('tells other users to ask their admin', async () => {
    mocks.status.mockResolvedValue({ status: 'SUSPENDED', canPay: false });
    renderBanner();
    expect(await screen.findByText(/ask your company admin/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
  });
});
