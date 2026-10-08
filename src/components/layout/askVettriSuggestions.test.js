import test from 'node:test';
import assert from 'node:assert/strict';
import { getAskVettriSuggestions, isAskVettriRoute } from './askVettriSuggestions.js';

function suggestions({ permissions = [], roles = [], employeeId = null, query = '' } = {}) {
  const user = { permissions, roles, employeeId };
  return getAskVettriSuggestions({
    query,
    user,
    hasPermission: (permission) => permissions.includes(permission),
    hasRole: (role) => roles.includes(role),
  });
}

test('role names do not grant actions without their required permission', () => {
  const results = suggestions({ roles: ['MANAGER'], query: 'approve team leave' });

  assert.equal(results.some((item) => item.id === 'team-leave'), false);
});

test('manager suggestions are permission-gated and prioritized for the manager audience', () => {
  const results = suggestions({
    roles: ['MANAGER'],
    permissions: ['LEAVE_APPROVE', 'SELF_PROFILE_VIEW'],
  });

  assert.equal(results[0].id, 'team-leave');
});

test('natural-language matching sends a personal payslip request to the existing self-service route', () => {
  const results = suggestions({
    permissions: ['SELF_PAYSLIP_VIEW'],
    query: 'Can I see my payslip?',
  });

  assert.equal(results[0].id, 'payslip');
  assert.equal(results[0].route, '/my-payslip');
  assert.equal(results.some((item) => item.route === '/salary'), false);
});

test('IT device suggestions require the IT management and monitoring permissions', () => {
  const results = suggestions({
    permissions: ['MONITORING_VIEW'],
    query: 'check device status',
  });

  assert.equal(results.some((item) => item.id === 'devices'), false);
});

test('platform administration is suggested only to users with the existing super-admin role', () => {
  const companyAdminSuggestions = suggestions({ roles: ['COMPANY_ADMIN'] });
  const superAdminSuggestions = suggestions({ roles: ['SUPER_ADMIN'] });

  assert.equal(companyAdminSuggestions.some((item) => item.id === 'platform-admin'), false);
  assert.equal(superAdminSuggestions.some((item) => item.id === 'platform-admin'), true);
});

test('default suggestions reflect employee, HR, IT, and company-admin scopes', () => {
  const employee = suggestions({
    roles: ['EMPLOYEE'],
    permissions: ['SELF_PROFILE_VIEW', 'SELF_ATTENDANCE_VIEW', 'SELF_PAYSLIP_VIEW'],
  });
  const hr = suggestions({
    roles: ['HR_ADMIN'],
    permissions: ['RECRUITMENT_VIEW', 'EMPLOYEE_VIEW'],
  });
  const it = suggestions({
    permissions: ['IT_MANAGEMENT_ACCESS', 'MONITORING_VIEW', 'DEVICE_MANAGE'],
  });
  const admin = suggestions({
    roles: ['COMPANY_ADMIN'],
    permissions: ['USER_VIEW', 'ORG_MANAGE'],
  });

  assert.equal(employee[0].id, 'profile');
  assert.equal(hr.some((item) => item.id === 'recruitment'), true);
  assert.equal(it[0].id, 'devices');
  assert.equal(admin[0].id, 'users');
});

test('custom permission grants enable route suggestions without a named role', () => {
  const results = suggestions({
    roles: ['CUSTOM_HR'],
    permissions: ['EMPLOYEE_VIEW'],
    query: 'open employee directory',
  });

  assert.equal(results[0].id, 'employees');
});

test('unmatched requests do not create a fallback route', () => {
  assert.deepEqual(suggestions({
    permissions: ['SELF_PROFILE_VIEW'],
    query: 'book a flight to mars',
  }), []);
  assert.equal(isAskVettriRoute('/assistant'), false);
});

test('every intent destination is present in the existing navigation catalog', () => {
  for (const result of suggestions({
    roles: ['SUPER_ADMIN'],
    permissions: [
      'SELF_PROFILE_VIEW',
      'SELF_ATTENDANCE_VIEW',
      'SELF_LEAVE_VIEW',
      'LEAVE_APPROVE',
      'ATTENDANCE_VIEW',
      'EMPLOYEE_VIEW',
      'RECRUITMENT_VIEW',
      'SELF_PAYSLIP_VIEW',
      'SALARY_VIEW',
      'MONITORING_VIEW',
      'IT_MANAGEMENT_ACCESS',
      'SOFTWARE_VIEW',
      'DEVICE_MANAGE',
      'REPORTS_VIEW',
      'USER_VIEW',
      'ORG_MANAGE',
    ],
  })) {
    assert.equal(isAskVettriRoute(result.route), true, `${result.id} points to an unregistered route`);
  }
});
