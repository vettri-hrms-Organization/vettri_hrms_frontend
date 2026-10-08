import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.jsx';
import ErrorBanner from './ErrorBanner.jsx';
import ErrorState from './ErrorState.jsx';
import PageLoader from './PageLoader.jsx';
import { ToastProvider, useToast } from './Toast.jsx';
import { vettriMicrocopy } from '../../utils/vettriMicrocopy.js';

function ToastProbe() {
  const toast = useToast();
  return <button type="button" onClick={() => toast.success()}>Show confirmation</button>;
}

describe('shared Vettri message states', () => {
  afterEach(() => cleanup());

  it('uses centralized, actionable copy for a generic empty state', () => {
    render(<EmptyState />);
    expect(screen.getByRole('status').textContent).toContain(vettriMicrocopy.empty.genericTitle);
    expect(screen.getByText(vettriMicrocopy.empty.genericDescription)).toBeTruthy();
  });

  it('uses the central friendly error message and retains a retry action', () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByRole('alert').textContent).toContain(vettriMicrocopy.error.generic);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('provides a useful default message for shared error banners', () => {
    render(<ErrorBanner />);
    expect(screen.getByRole('alert').textContent).toContain(vettriMicrocopy.error.generic);
  });

  it('announces a contextual workspace loading message to assistive technology', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status').textContent).toContain(vettriMicrocopy.loading.workspace);
  });

  it('uses the centralized confirmation when a success toast has no custom copy', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider><ToastProbe /></ToastProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show confirmation' }));
    expect(screen.getByText(vettriMicrocopy.success.saved)).toBeTruthy();
  });
});
