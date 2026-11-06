import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupProgressScreen, SetupPrompt } from './SetupGate.jsx';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 5, companyName: 'Xenon Software', roles: ['COMPANY_ADMIN'] } }) }));

const step = (key, title, done, link, required = true) => ({ key, title, detail: `${title} detail`, done, link, required });
const setup = {
  locked: true, percent: 40, requiredDone: 2, requiredTotal: 5,
  steps: [
    step('company', 'Company details', true, '/billing'),
    step('departments', 'Departments', true, '/settings/organization?tab=departments'),
    step('designations', 'Designations', false, '/settings/organization?tab=designations'),
    step('locations', 'Company locations', false, '/settings/organization?tab=locations'),
    step('team', 'Add HR and managers', false, '/settings/users'),
    step('payroll', 'Run your first payroll', false, '/salary/payroll-processing', false),
  ],
};

function renderPrompt() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<SetupPrompt setup={setup} userId={5} />} />
        <Route path="/onboarding" element={<p>Setup page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { try { sessionStorage.clear(); } catch { /* no storage */ } });
afterEach(() => cleanup());

describe('SetupPrompt', () => {
  it('asks to complete the workspace details and lists what is left', () => {
    renderPrompt();
    expect(screen.getByRole('dialog', { name: 'Complete your workspace details' })).toBeTruthy();
    expect(screen.getByText('3 steps left')).toBeTruthy();
    expect(screen.getByRole('img', { name: '40% of required setup complete' })).toBeTruthy();
  });

  it('opens Workspace Setup on "Set up now"', async () => {
    renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Set up now' }));
    expect(screen.getByText('Setup page')).toBeTruthy();
  });

  it('stays closed for the rest of the sign-in after "Skip for now"', async () => {
    renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    renderPrompt();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('SetupProgressScreen', () => {
  it('shows the percentage, the required steps and the next one to do', () => {
    render(<MemoryRouter><SetupProgressScreen setup={setup} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Set up Xenon Software' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continue: Designations/ }).getAttribute('href')).toBe('/settings/organization?tab=designations');
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.queryByText('Run your first payroll')).toBeNull();
    expect(screen.getByText(/Later, usually by HR: run your first payroll/)).toBeTruthy();
  });
});
