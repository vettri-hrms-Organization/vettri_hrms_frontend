import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import { NAV_INDEX, visibleNavSections } from '../components/layout/navConfig.js';

const { authState } = vi.hoisted(() => ({
  authState: {
    permissions: [],
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {},
    isAuthenticated: true,
    isLoading: false,
    hasAnyRole: () => false,
    hasPermission: (permission) => authState.permissions.includes(permission),
    hasRole: () => false,
  }),
}));

describe('organization settings permission routing', () => {
  afterEach(() => {
    cleanup();
    authState.permissions = [];
  });

  it('lets an HR Manager with a location permission reach organization settings', () => {
    authState.permissions = ['OFFICE_LOCATION_VIEW'];
    render(
      <MemoryRouter
        initialEntries={['/settings/organization']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/settings/organization" element={<div>Organization settings content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Organization settings content')).toBeTruthy();
  });

  it('keeps the route and sidebar unavailable without a relevant permission', () => {
    render(
      <MemoryRouter
        initialEntries={['/settings/organization']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/settings/organization" element={<div>Organization settings content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Access Restricted')).toBeTruthy();
    const navItem = NAV_INDEX.find((item) => item.to === '/settings/organization');
    const visibleItems = visibleNavSections(() => false).flatMap((section) => section.items);
    expect(navItem.permissionsAny).toContain('OFFICE_LOCATION_VIEW');
    expect(visibleItems.some((item) => item.to === '/settings/organization')).toBe(false);
  });
});
