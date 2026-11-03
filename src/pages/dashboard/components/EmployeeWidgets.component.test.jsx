import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ApprovalsCard, EmployeeGreeting, HolidaysPanel, LeaveCard, PayslipCard, QuickLinksPanel, WeekCard,
} from './EmployeeWidgets.jsx';

function renderWith(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

afterEach(() => cleanup());

const hrefOf = (name) => screen.getByRole('link', { name }).getAttribute('href');

describe('EmployeeGreeting', () => {
  const base = { greeting: 'Good morning, Lakshmi', today: 'Tuesday, 3 November', firstName: 'Lakshmi', employee: { fullName: 'Lakshmi Nair', designationTitle: 'Designer', departmentName: 'Product' } };

  it('shows the shift and links to My Attendance to check in', () => {
    renderWith(<EmployeeGreeting {...base} hasCheckedIn={false} hasCheckedOut={false} shiftToday={{ shiftName: 'General', shiftStart: '10:00', shiftEnd: '18:30' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Lakshmi' })).toBeTruthy();
    expect(screen.getByText('Designer · Product')).toBeTruthy();
    expect(screen.getByText('Not checked in')).toBeTruthy();
    expect(screen.getByText(/General · 10:00 AM – 6:30 PM/)).toBeTruthy();
    expect(hrefOf('Check in on My Attendance')).toBe('/my-attendance');
  });

  it('reports a check-in with its detail and offers check-out', () => {
    renderWith(<EmployeeGreeting {...base} hasCheckedIn hasCheckedOut={false} attendanceDetail="In at 9:31 AM · 3h 12m so far" shiftToday={null} />);
    expect(screen.getByText('Checked in')).toBeTruthy();
    expect(screen.getByText('In at 9:31 AM · 3h 12m so far')).toBeTruthy();
    expect(screen.getByText(/No shift assigned for today/)).toBeTruthy();
    expect(hrefOf('Check out on My Attendance')).toBe('/my-attendance');
  });

  it('does not ask for a check-in on a weekly off', () => {
    renderWith(<EmployeeGreeting {...base} hasCheckedIn={false} hasCheckedOut={false} shiftToday={{ weekOff: true }} />);
    expect(screen.getByText('Weekly off')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Check in/ })).toBeNull();
    expect(hrefOf(/View attendance/)).toBe('/my-attendance');
  });
});

describe('LeaveCard', () => {
  it('totals the balances and lists each type with pending days', () => {
    renderWith(
      <LeaveCard
        year={2026}
        balances={[
          { leaveTypeId: 1, leaveTypeName: 'Casual Leave', remainingDays: 4, allocatedDays: 12, carriedForwardDays: 0 },
          { leaveTypeId: 2, leaveTypeName: 'Sick Leave', remainingDays: 2.5, allocatedDays: 6, carriedForwardDays: 0 },
        ]}
        requests={[{ id: 9, status: 'PENDING', leaveTypeName: 'Casual Leave', days: 1, startDate: '2999-01-05', endDate: '2999-01-05' }]}
      />,
    );
    expect(screen.getByText('6.5')).toBeTruthy();
    const types = screen.getByRole('list', { name: 'Leave balances by type' });
    expect(within(types).getByText('Casual Leave')).toBeTruthy();
    expect(within(types).getByText('1 pending')).toBeTruthy();
    expect(screen.getByText(/Next leave: Casual Leave/)).toBeTruthy();
    expect(hrefOf(/Request leave/)).toBe('/my-leave?apply=leave');
    expect(hrefOf(/View all/)).toBe('/my-leave');
  });

  it('has empty and loading states', () => {
    const { rerender } = renderWith(<LeaveCard year={2026} balances={[]} requests={[]} />);
    expect(screen.getByText('No leave balances yet')).toBeTruthy();
    rerender(<MemoryRouter><LeaveCard year={2026} balances={[]} requests={[]} loading /></MemoryRouter>);
    expect(screen.queryByText('No leave balances yet')).toBeNull();
    expect(screen.getByRole('region', { name: /Leave available/ }).getAttribute('aria-busy')).toBe('true');
  });
});

describe('WeekCard', () => {
  it('sums worked time and counts present and late days', () => {
    renderWith(
      <WeekCard
        monday="2026-11-02"
        today="2026-11-03"
        days={[
          { date: '2026-11-02', status: 'PRESENT', workedMinutes: 500, late: true },
          { date: '2026-11-03', status: 'PRESENT', workedMinutes: 130, late: false },
        ]}
      />,
    );
    expect(screen.getByText('10h 30m')).toBeTruthy();
    expect(screen.getByText('2 days present · 1 late')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Attendance this week' }).children).toHaveLength(7);
  });

  it('says when nothing is recorded or attendance is not available', () => {
    const { rerender } = renderWith(<WeekCard monday="2026-11-02" today="2026-11-03" days={[]} />);
    expect(screen.getByText('No attendance recorded this week yet')).toBeTruthy();
    rerender(<MemoryRouter><WeekCard monday="2026-11-02" today="2026-11-03" days={[]} unavailable /></MemoryRouter>);
    expect(screen.getByText("Attendance isn't available")).toBeTruthy();
  });
});

describe('PayslipCard', () => {
  it('shows the latest payslip', () => {
    renderWith(<PayslipCard salary={{ currentStructure: { netSalary: 50000 }, payrollHistory: [{ id: 1, periodLabel: 'Oct 2026', netSalary: 48250, paymentDate: null }] }} />);
    expect(screen.getByText(/Oct 2026/)).toBeTruthy();
    expect(screen.getByText('Payment pending')).toBeTruthy();
    expect(hrefOf(/View payslips/)).toBe('/my-payslip');
  });

  it('falls back to the salary structure, then to an empty state', () => {
    const { rerender } = renderWith(<PayslipCard salary={{ currentStructure: { netSalary: 50000, grossSalary: 60000, totalDeductions: 10000 }, payrollHistory: [] }} />);
    expect(screen.getByText('Monthly net salary · no payslips yet')).toBeTruthy();
    rerender(<MemoryRouter><PayslipCard salary={null} /></MemoryRouter>);
    expect(screen.getByText('No pay details yet')).toBeTruthy();
  });
});

describe('ApprovalsCard', () => {
  it('counts only approval queues from the to-do feed', () => {
    renderWith(
      <ApprovalsCard
        todos={[
          { key: 'timesheets', title: 'Timesheets to approve', count: 3, link: '/approvals' },
          { key: 'expenses', title: 'Expense claims to review', count: 2, link: '/expenses/approvals' },
          { key: 'surveys', title: 'Surveys waiting for your answer', count: 4, link: '/company?tab=surveys' },
        ]}
      />,
    );
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.queryByText('Surveys waiting for your answer')).toBeNull();
    expect(hrefOf(/Open approvals/)).toBe('/approvals');
  });

  it('is caught up when nothing waits', () => {
    renderWith(<ApprovalsCard todos={[]} />);
    expect(screen.getByText("You're all caught up")).toBeTruthy();
  });
});

describe('HolidaysPanel', () => {
  it('lists upcoming holidays only, soonest first', () => {
    renderWith(
      <HolidaysPanel
        today="2026-11-03"
        holidays={[
          { id: 1, name: 'Christmas', date: '2026-12-25' },
          { id: 2, name: 'Diwali', date: '2026-11-08' },
          { id: 3, name: 'Independence Day', date: '2026-08-15' },
        ]}
      />,
    );
    const names = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(names[0]).toMatch(/Diwali/);
    expect(names[1]).toMatch(/Christmas/);
    expect(screen.queryByText('Independence Day')).toBeNull();
  });

  it('has empty and error states', () => {
    const { rerender } = renderWith(<HolidaysPanel today="2026-11-03" holidays={[]} />);
    expect(screen.getByText('No upcoming holidays')).toBeTruthy();
    rerender(<MemoryRouter><HolidaysPanel today="2026-11-03" holidays={[]} error /></MemoryRouter>);
    expect(screen.getByText("Holidays couldn't load")).toBeTruthy();
  });
});

describe('QuickLinksPanel', () => {
  it('hides the payslip link without payslip access', () => {
    const { rerender } = renderWith(<QuickLinksPanel canViewPayslip={false} />);
    expect(screen.queryByRole('link', { name: /My payslips/ })).toBeNull();
    expect(hrefOf(/Ask HR/)).toBe('/helpdesk');
    rerender(<MemoryRouter><QuickLinksPanel canViewPayslip /></MemoryRouter>);
    expect(hrefOf(/My payslips/)).toBe('/my-payslip');
  });
});
