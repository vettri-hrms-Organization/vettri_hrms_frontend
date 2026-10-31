import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import { currentQuarter, ratingLabel } from '../../api/endpoints/performanceSuite';
import ReviewCycles from './ReviewCycles.jsx';
import Okrs from './Okrs.jsx';
import Conversations from './Conversations.jsx';

const { perfApi } = vi.hoisted(() => ({
  perfApi: {
    me: vi.fn(), people: vi.fn(), reviewTasks: vi.fn(), submitReview: vi.fn(), myReviews: vi.fn(), cycles: vi.fn(),
    okrs: vi.fn(), checkIn: vi.fn(), wall: vi.fn(), giveFeedback: vi.fn(), received: vi.fn(), given: vi.fn(), meetings: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/performanceSuite', async (importOriginal) => ({ ...(await importOriginal()), perfApi }));

function renderPage(Page) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><ToastProvider><Page /></ToastProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  perfApi.me.mockResolvedValue({ employeeId: 7, hr: false, compAdmin: false, reportIds: [] });
  perfApi.people.mockResolvedValue([{ id: 7, name: 'Asha' }, { id: 8, name: 'Ravi', designation: 'Engineer' }]);
});
afterEach(() => cleanup());

describe('helpers', () => {
  it('labels ratings and quarters', () => {
    expect(ratingLabel(4)).toBe('4.0 · Exceeds');
    expect(ratingLabel(null)).toBe('—');
    expect(currentQuarter(new Date(2026, 10, 3))).toBe('2026-Q4');
  });
});

describe('ReviewCycles', () => {
  it('writes and submits a self review', async () => {
    perfApi.reviewTasks.mockResolvedValue([{ responseId: 41, kind: 'SELF', participantId: 3, cycleId: 1, cycleName: 'H2 2026', employeeId: 7, employeeName: 'Asha', due: '2026-11-15' }]);
    perfApi.submitReview.mockResolvedValue({});
    renderPage(ReviewCycles);
    await userEvent.click(await screen.findByRole('button', { name: 'Write' }));
    await userEvent.selectOptions(screen.getByLabelText('Rating'), '4');
    await userEvent.type(screen.getByLabelText('What went well'), 'Shipped payroll');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(perfApi.submitReview).toHaveBeenCalled());
    expect(perfApi.submitReview.mock.calls[0][0]).toBe(41);
    expect(perfApi.submitReview.mock.calls[0][1]).toMatchObject({ rating: 4, strengths: 'Shipped payroll' });
  });

  it('hides the cycles tab from people who manage nobody', async () => {
    perfApi.reviewTasks.mockResolvedValue([]);
    renderPage(ReviewCycles);
    expect(await screen.findByText("You're all caught up")).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /cycles|my team/i })).toBeNull();
  });
});

describe('Okrs', () => {
  it('shows key results and checks in progress', async () => {
    const objective = {
      id: 5, level: 'PERSONAL', ownerEmployeeId: 7, ownerName: 'Asha', period: currentQuarter(), title: 'Close deals', status: 'ON_TRACK', progress: 20, canEdit: true,
      keyResults: [{ id: 9, title: 'Deals closed', startValue: 0, targetValue: 10, currentValue: 2, unit: 'deals', progress: 20 }],
    };
    perfApi.okrs.mockResolvedValue([objective]);
    perfApi.checkIn.mockResolvedValue({ ...objective, progress: 50 });
    renderPage(Okrs);
    expect(await screen.findByText('Deals closed')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Check in' }));
    const input = screen.getByLabelText(/Current value/);
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(perfApi.checkIn).toHaveBeenCalled());
    expect(perfApi.checkIn.mock.calls[0][0]).toBe(9);
    expect(perfApi.checkIn.mock.calls[0][1]).toMatchObject({ currentValue: 5 });
  });
});

describe('Conversations', () => {
  it('posts public praise to the wall', async () => {
    perfApi.wall.mockResolvedValue([]);
    perfApi.giveFeedback.mockResolvedValue({ id: 1, visibility: 'PUBLIC', toName: 'Ravi' });
    renderPage(Conversations);
    await userEvent.click(await screen.findByRole('button', { name: /Give feedback/ }));
    await waitFor(() => expect(screen.getByRole('option', { name: /Ravi/ })).toBeTruthy());
    expect(screen.queryByRole('option', { name: 'Asha' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('To'), '8');
    await userEvent.type(screen.getByLabelText('Message'), 'Thanks for the weekend fix');
    await userEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() => expect(perfApi.giveFeedback).toHaveBeenCalled());
    expect(perfApi.giveFeedback.mock.calls[0][0]).toMatchObject({ toEmployeeId: 8, kind: 'PRAISE', visibility: 'PUBLIC' });
  });
});
