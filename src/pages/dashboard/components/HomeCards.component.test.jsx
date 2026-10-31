import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AskVettriBox, SetupChecklist, TeamPulse, TodosCard } from './HomeCards.jsx';

const { homeApi } = vi.hoisted(() => ({ homeApi: { todos: vi.fn(), today: vi.fn(), setup: vi.fn() } }));
vi.mock('../../../api/endpoints/home', async (importOriginal) => ({ ...(await importOriginal()), homeApi }));

function renderWith(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  try { window.localStorage.removeItem('vettri.setup.dismissed'); } catch { /* ignore */ }
});
afterEach(() => cleanup());

describe('TodosCard', () => {
  it('lists every to-do with its count and link', async () => {
    homeApi.todos.mockResolvedValue([
      { key: 'sign', title: 'Documents to sign', detail: '1 document is waiting for your signature', count: 1, link: '/signatures', tone: 'self' },
      { key: 'leave', title: 'Leave requests to decide', detail: '3 waiting for you', count: 3, link: '/approvals', tone: 'action' },
    ]);
    renderWith(<TodosCard />);
    const link = await screen.findByRole('link', { name: /Documents to sign/ });
    expect(link.getAttribute('href')).toBe('/signatures');
    expect(screen.getByText('4 waiting')).toBeTruthy();
  });

  it('says you are caught up when nothing is waiting', async () => {
    homeApi.todos.mockResolvedValue([]);
    renderWith(<TodosCard />);
    expect(await screen.findByText("You're all caught up")).toBeTruthy();
  });
});

describe('SetupChecklist', () => {
  const setup = {
    visible: true, done: 1, total: 2,
    steps: [
      { key: 'leave', title: 'Leave policy', detail: 'Set leave types', done: true, link: '/settings/leave' },
      { key: 'employees', title: 'Add your employees', detail: 'Import from Excel', done: false, link: '/employees/import' },
    ],
  };

  it('shows progress and the next step, and can be hidden', async () => {
    homeApi.setup.mockResolvedValue(setup);
    renderWith(<SetupChecklist />);
    expect(await screen.findByText(/1 of 2 done · Next: add your employees/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Hide setup checklist' }));
    await waitFor(() => expect(screen.queryByText('Get your workspace ready')).toBeNull());
  });

  it('stays hidden for people who are not workspace admins', async () => {
    homeApi.setup.mockResolvedValue({ visible: false, done: 0, total: 0, steps: [] });
    renderWith(<SetupChecklist />);
    await waitFor(() => expect(homeApi.setup).toHaveBeenCalled());
    expect(screen.queryByText('Get your workspace ready')).toBeNull();
  });
});

describe('TeamPulse', () => {
  it('shows who is out and the IT snapshot for admins', async () => {
    homeApi.today.mockResolvedValue({
      outToday: [{ employeeId: 1, name: 'Priya Gupta', detail: 'Back tomorrow', date: '2026-11-02' }],
      birthdays: [], anniversaries: [],
      it: { devices: 12, online: 9, notSeenForWeek: 1, unassigned: 0 },
    });
    renderWith(<TeamPulse />);
    expect(await screen.findByText('Priya Gupta')).toBeTruthy();
    expect(screen.getByText('online now')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });
});

describe('AskVettriBox', () => {
  it('opens Ask Vettri with the question typed in', async () => {
    const heard = vi.fn();
    window.addEventListener('vettri:ask', heard);
    renderWith(<AskVettriBox />);
    await userEvent.type(screen.getByLabelText('Ask Vettri a question'), 'How much leave do I have?');
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(heard).toHaveBeenCalled();
    expect(heard.mock.calls[0][0].detail.query).toBe('How much leave do I have?');
    window.removeEventListener('vettri:ask', heard);
  });
});
