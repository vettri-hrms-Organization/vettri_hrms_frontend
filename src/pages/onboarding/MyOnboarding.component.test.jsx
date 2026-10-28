import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import MyOnboarding from './MyOnboarding.jsx';

const { onboardingApi } = vi.hoisted(() => ({
  onboardingApi: {
    my: vi.fn(),
    myTasks: vi.fn(),
    complete: vi.fn(),
    reopen: vi.fn(),
    uploadDocument: vi.fn(),
  },
}));

vi.mock('../../api/endpoints/onboarding', () => ({
  onboardingApi,
  OWNER_TYPE_LABEL: { NEW_HIRE: 'Employee', HR: 'HR', MANAGER: 'Manager', IT: 'IT', USER: 'Specific user' },
}));

function task(overrides) {
  return {
    id: 1, checklistId: 7, title: 'Share PAN and bank details', description: null, ownerType: 'NEW_HIRE',
    ownerName: 'Asha Rao', dueDate: '2026-11-02', status: 'PENDING', overdue: false, requiresDocument: false,
    documentId: null, linkKey: null, canComplete: true, employeeId: 5, employeeName: 'Asha Rao', checklistType: 'ONBOARDING',
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <MyOnboarding />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyOnboarding', () => {
  beforeEach(() => {
    onboardingApi.my.mockResolvedValue([{
      id: 7, employeeId: 5, employeeName: 'Asha Rao', employeeCode: 'EMP0005', checklistType: 'ONBOARDING',
      name: 'Standard onboarding', status: 'IN_PROGRESS', anchorDate: '2026-11-02', startedAt: '2026-10-28T10:00:00',
      completedAt: null, totalTasks: 2, doneTasks: 0, overdueTasks: 1, progressPercent: 0,
      tasks: [
        task({}),
        task({ id: 2, title: 'Submit ID and address proof', requiresDocument: true, overdue: true, dueDate: '2026-10-20' }),
      ],
    }]);
    onboardingApi.myTasks.mockResolvedValue([]);
    onboardingApi.complete.mockResolvedValue(task({ status: 'DONE' }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows progress, overdue highlighting and lets the new hire complete a task', async () => {
    renderPage();

    expect(await screen.findByText('Standard onboarding')).toBeTruthy();
    expect(screen.getByText('1 overdue')).toBeTruthy();
    expect(screen.getByText(/overdue\)/)).toBeTruthy();

    const buttons = screen.getAllByRole('button', { name: /mark done/i });
    // The document task can't be completed until a document is uploaded.
    expect(buttons[1].disabled).toBe(true);

    await userEvent.click(buttons[0]);
    await waitFor(() => expect(onboardingApi.complete).toHaveBeenCalledWith(1, { skip: false }));
  });
});
