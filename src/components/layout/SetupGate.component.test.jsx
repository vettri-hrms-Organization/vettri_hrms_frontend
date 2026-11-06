import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetupLockedScreen, SetupProgressBanner, isOpenDuringSetup } from './SetupGate.jsx';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { companyName: 'Xenon Software', roles: ['COMPANY_ADMIN'] } }) }));

const step = (key, title, done, link, required = true) => ({ key, title, detail: `${title} detail`, done, link, required });
const setup = {
  locked: true, percent: 50, requiredDone: 2, requiredTotal: 4,
  steps: [
    step('company', 'Company details', true, '/settings/organization'),
    step('designations', 'Designations', true, '/settings/organization'),
    step('leave', 'Leave policy', false, '/settings/leave'),
    step('attendance', 'Attendance', false, '/settings/organization'),
    step('payroll', 'Run your first payroll', false, '/salary/payroll-processing', false),
  ],
};

afterEach(() => cleanup());

describe('isOpenDuringSetup', () => {
  it('keeps setup and account pages open and locks the rest', () => {
    expect(isOpenDuringSetup('/settings/leave', setup)).toBe(true);
    expect(isOpenDuringSetup('/onboarding', setup)).toBe(true);
    expect(isOpenDuringSetup('/my-profile', setup)).toBe(true);
    expect(isOpenDuringSetup('/company?tab=holidays', setup)).toBe(false);
    expect(isOpenDuringSetup('/dashboard', setup)).toBe(false);
    expect(isOpenDuringSetup('/salary/payroll-processing', setup)).toBe(false);
  });
});

describe('SetupLockedScreen', () => {
  it('shows the percentage, the required steps and the next step to do', () => {
    render(<MemoryRouter><SetupLockedScreen setup={setup} /></MemoryRouter>);
    expect(screen.getByRole('img', { name: '50% of required setup complete' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Set up Xenon Software' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continue: Leave policy/ }).getAttribute('href')).toBe('/settings/leave');
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.queryByText('Run your first payroll')).toBeNull();
    expect(screen.getByText(/After unlocking: run your first payroll/)).toBeTruthy();
  });
});

describe('SetupProgressBanner', () => {
  it('counts the required steps left', () => {
    render(<MemoryRouter><SetupProgressBanner setup={setup} /></MemoryRouter>);
    expect(screen.getByText('Workspace setup 50%')).toBeTruthy();
    expect(screen.getByText(/2 required steps left/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });
});
