import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute.jsx';

const mocks = vi.hoisted(() => ({ auth: null }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));

function setAuth(userOverrides) {
  mocks.auth = {
    user: { employeeId: 7, roles: ['EMPLOYEE'], permissions: ['SELF_PROFILE_VIEW'], ...userOverrides },
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (code) => code === 'SELF_PROFILE_VIEW',
    hasRole: (role) => role === 'EMPLOYEE',
    hasAnyRole: (list) => list.includes('EMPLOYEE'),
  };
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/privacy/accept" element={<div>legal acceptance page</div>} />
          <Route path="*" element={<div>page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('legal acceptance gate', () => {
  afterEach(() => cleanup());

  it('sends a user with a pending document version to the acceptance page', () => {
    setAuth({ legalAcceptanceRequired: true, pendingLegalDocuments: ['TERMS'] });
    renderAt('/my-profile');
    expect(screen.getByText('legal acceptance page')).toBeTruthy();
    expect(screen.queryByText('page content')).toBeNull();
  });

  it('lets the user through once nothing is pending', () => {
    setAuth({ legalAcceptanceRequired: false, pendingLegalDocuments: [] });
    renderAt('/my-profile');
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('keeps the change-password gate ahead of the legal gate', () => {
    setAuth({ mustChangePassword: true, legalAcceptanceRequired: true });
    renderAt('/account/security');
    expect(screen.getByText('page content')).toBeTruthy();
  });
});
