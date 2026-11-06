import { describe, expect, it } from 'vitest';
import { visibleNavSections } from './navConfig';

const EMPLOYEE = ['SELF_PROFILE_VIEW', 'SELF_ATTENDANCE_VIEW', 'SELF_LEAVE_VIEW', 'SELF_EXPENSE_SUBMIT', 'SELF_PAYSLIP_VIEW'];

function sidebar(permissions, roles = []) {
  return visibleNavSections((permission) => permissions === 'ALL' || permissions.includes(permission), (role) => roles.includes(role));
}

function find(sections, to) {
  for (const section of sections) {
    const item = section.items.find((entry) => entry.to === to);
    if (item) return { section: section.label, label: item.label };
  }
  return null;
}

describe('visibleNavSections', () => {
  it('gives a Company Admin only organisation and employee administration', () => {
    const sections = sidebar('ALL', ['COMPANY_ADMIN']);
    expect(sections.map((section) => section.label)).toEqual(['Home', 'Organization', 'Employees', 'Settings', 'Billing & Security']);
    expect(find(sections, '/settings/organization')).toEqual({ section: 'Organization', label: 'Departments & Locations' });
    expect(find(sections, '/employees')).toEqual({ section: 'Employees', label: 'Employees' });
    for (const hidden of ['/my-profile', '/my-payslip', '/my-leave', '/performance', '/leave', '/salary/payroll-processing']) {
      expect(find(sections, hidden)).toBeNull();
    }
  });

  it('keeps the full menu for a Company Admin who is also HR', () => {
    const sections = sidebar('ALL', ['COMPANY_ADMIN', 'HR_ADMIN']);
    expect(find(sections, '/leave')).toEqual({ section: 'Time & Leave', label: 'Leave Management' });
  });

  it('shows each page once', () => {
    const paths = sidebar('ALL', ['HR_ADMIN']).flatMap((section) => section.items.map((item) => item.to));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives admins the company-wide names for pages that are also self-service links', () => {
    const sections = sidebar('ALL', ['HR_ADMIN']);
    expect(find(sections, '/leave')).toEqual({ section: 'Time & Leave', label: 'Leave Management' });
    expect(find(sections, '/performance')).toEqual({ section: 'People', label: 'Performance' });
    expect(find(sections, '/performance/reviews')).toEqual({ section: 'People', label: 'Review Cycles' });
    expect(find(sections, '/helpdesk')).toEqual({ section: 'Employee Services', label: 'HR Helpdesk' });
  });

  it('keeps the self-service names for employees', () => {
    const sections = sidebar(EMPLOYEE);
    expect(find(sections, '/performance')).toEqual({ section: 'Growth', label: 'My Performance' });
    expect(find(sections, '/helpdesk')).toEqual({ section: 'My Workspace', label: 'HR Helpdesk' });
    expect(find(sections, '/my-interviews')).toEqual({ section: 'My Workspace', label: 'My Interviews' });
    expect(find(sections, '/leave')).toBeNull();
  });

  it('keeps "Team Leave" for managers who only approve leave', () => {
    expect(find(sidebar([...EMPLOYEE, 'LEAVE_APPROVE']), '/leave')).toEqual({ section: 'My Workspace', label: 'Team Leave' });
  });
});
