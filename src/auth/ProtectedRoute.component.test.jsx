import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute.jsx';

const mocks = vi.hoisted(() => ({ auth: null }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));

function setAuth(permissions, { employeeId = null, roles = [] } = {}) {
  mocks.auth = {
    user: { employeeId, roles, permissions },
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (code) => permissions.includes(code),
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (list) => list.some((role) => roles.includes(role)),
  };
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="*" element={<div>page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => cleanup());

  it('lets a LEAVE_VIEW holder open /leave even though "Team Leave" needs LEAVE_APPROVE', () => {
    setAuth(['LEAVE_VIEW', 'EMPLOYEE_VIEW']);
    renderAt('/leave');
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('lets a leave approver without LEAVE_VIEW open /leave', () => {
    setAuth(['LEAVE_APPROVE']);
    renderAt('/leave');
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('denies /leave to a user with neither leave permission', () => {
    setAuth(['MONITORING_VIEW']);
    renderAt('/leave');
    expect(screen.getByText('Access Restricted')).toBeTruthy();
  });

  it('still denies a route when no matching nav entry grants access', () => {
    setAuth(['SELF_PROFILE_VIEW']);
    renderAt('/salary/employees');
    expect(screen.getByText('Access Restricted')).toBeTruthy();
  });

  it('allows an employee to open their own profile without EMPLOYEE_VIEW', () => {
    setAuth(['SELF_PROFILE_VIEW'], { employeeId: 7 });
    renderAt('/employees/7');
    expect(screen.getByText('page content')).toBeTruthy();
  });
});
