import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import MyHolidays from './MyHolidays.jsx';

const { holidayCalendarApi } = vi.hoisted(() => ({
  holidayCalendarApi: { mine: vi.fn(), pick: vi.fn(), unpick: vi.fn() },
}));

vi.mock('../../api/endpoints/settlement', () => ({ holidayCalendarApi }));

const year = new Date().getFullYear();

function view(picked) {
  return {
    employeeId: 7, employeeName: 'Asha', year, officeLocationId: 3, officeLocationName: 'Chennai',
    maxOptionalHolidays: 2, optionalPicked: picked ? 1 : 0,
    holidays: [
      { id: 1, name: 'Pongal', date: `${year}-01-15`, holidayType: 'MANDATORY', locationNames: ['Chennai'], picked: false, counts: true, canPick: false, canUnpick: false },
      { id: 2, name: 'Karva Chauth', date: `${year}-12-20`, holidayType: 'OPTIONAL', locationNames: [], picked, counts: picked, canPick: !picked, canUnpick: picked },
    ],
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <MyHolidays />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyHolidays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holidayCalendarApi.mine.mockResolvedValue(view(false));
    holidayCalendarApi.pick.mockResolvedValue(view(true));
  });

  afterEach(() => cleanup());

  it('shows location holidays and lets the employee pick an optional holiday', async () => {
    renderPage();
    expect(await screen.findByText('Pongal')).toBeTruthy();
    expect(screen.getByText('Holidays for Chennai')).toBeTruthy();
    expect(screen.getByText(/You can pick 2 per year - 0 picked/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Pick Karva Chauth' }));

    await waitFor(() => expect(holidayCalendarApi.pick).toHaveBeenCalled());
    expect(holidayCalendarApi.pick.mock.calls[0][0]).toBe(2);
    expect(await screen.findByRole('button', { name: 'Drop Karva Chauth' })).toBeTruthy();
    expect(screen.getByText('Picked')).toBeTruthy();
  });
});
