import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, KeyRound, ShieldAlert } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import SectionHeader from '../components/ui/SectionHeader';
import Card from '../components/ui/Card';
import FormField from '../components/ui/FormField';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/endpoints/auth';
import TwoFactorSection from '../components/auth/TwoFactorSection';

/** Mirrors the backend rule on ChangePasswordRequest / ActivateInvitationRequest. */
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function isStrongPassword(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value || ''));
}

/**
 * Change-password screen (user menu > Change password). Also the forced
 * landing page while /api/auth/me reports mustChangePassword - see
 * ProtectedRoute. The backend revokes every refresh token on success, so we
 * immediately sign in again with the new password to get a fresh session;
 * if that fails we log out and ask the user to sign in.
 */
export default function AccountSecurity() {
  const { user, login, logout, establishSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const forced = !!user?.mustChangePassword;
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const change = useMutation({
    mutationFn: ({ currentPassword, newPassword }) => authApi.changePassword(currentPassword, newPassword),
    onSuccess: async (data, { newPassword }) => {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      try {
        if (data?.accessToken && establishSession) {
          // The backend hands this (already two-step verified) session fresh tokens.
          await establishSession(data);
        } else {
          if (!user?.username) throw new Error('missing username');
          const result = await login(user.username, newPassword);
          if (result?.mfaRequired) throw new Error('second factor required');
        }
        toast.success('Password changed. Other sessions have been signed out.');
        navigate(forced ? '/dashboard' : '/account/security', { replace: true });
      } catch {
        toast.info('Password changed. Please sign in again with your new password.');
        await logout();
        navigate('/login', { replace: true });
      }
    },
    onError: (e) => setError(e.response?.data?.message || "We couldn't change your password. Please try again."),
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (!isStrongPassword(form.newPassword)) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    setError('');
    change.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  return (
    <PageShell className="hz-admin-page d-flex flex-column gap-4">
      <SectionHeader
        eyebrow="Account"
        title="Security"
        description="Your password and two-step verification for signing in to Vettri HRMS."
      />
      {forced && (
        <div role="alert" className="alert alert-warning d-flex align-items-start gap-2 mb-0">
          <ShieldAlert size={18} aria-hidden="true" className="flex-shrink-0 mt-1" />
          <span>You must change your password before you can continue using Vettri HRMS.</span>
        </div>
      )}
      <Card title="Change password" subtitle="You'll stay signed in here; all other sessions will be signed out.">
        <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 460 }}>
          <FormField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={set('currentPassword')}
            required
          />
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={set('newPassword')}
            required
          />
          <ul className="list-unstyled mb-3" aria-label="Password requirements" style={{ fontSize: 'var(--hz-text-sm)' }}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(form.newPassword);
              const Icon = met ? CheckCircle2 : Circle;
              return (
                <li
                  key={rule.label}
                  className="d-flex align-items-center gap-2"
                  style={{ color: met ? 'var(--hz-success-600)' : 'var(--hz-text-muted)' }}
                >
                  <Icon size={14} aria-hidden="true" /> {rule.label}
                </li>
              );
            })}
          </ul>
          <FormField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            required
          />
          {error && <p role="alert" className="text-danger">{error}</p>}
          <Button type="submit" icon={KeyRound} loading={change.isPending}>
            Change password
          </Button>
        </form>
      </Card>
      {/* Hidden during a forced password change - one thing at a time. */}
      {!forced && <TwoFactorSection />}
    </PageShell>
  );
}
