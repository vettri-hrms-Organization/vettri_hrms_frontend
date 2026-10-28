import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import FormField from '../ui/FormField';
import { useToast } from '../ui/Toast';
import { authApi } from '../../api/endpoints/auth';

export const TWO_FACTOR_POLICIES = [
  { value: 'OFF', label: 'Off', help: 'Nobody can use two-step verification.' },
  { value: 'OPTIONAL', label: 'Optional', help: 'People can turn it on for their own account.' },
  { value: 'REQUIRED_ADMINS', label: 'Required for admins', help: 'Anyone with a management (*_MANAGE) permission or an admin role must use it.' },
  { value: 'REQUIRED_ALL', label: 'Required for everyone', help: 'Every user must use it.' },
];

/** Mirrors MfaController's admin rule: COMPANY_ADMIN / SUPER_ADMIN, or USER_MANAGE with organisation scope. */
export function canManageTwoFactor(user, hasPermission, hasRole) {
  return hasRole?.('COMPANY_ADMIN')
    || hasRole?.('SUPER_ADMIN')
    || (hasPermission?.('USER_MANAGE') && (user?.scopes?.USER_MANAGE || []).includes('ORGANIZATION'));
}

function apiMessage(err, fallback) {
  return err?.apiMessage || err?.response?.data?.message || fallback;
}

/** Settings > Users: company-wide two-step verification policy. */
export function TwoFactorPolicyCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const policy = useQuery({ queryKey: ['auth', 'mfa-policy'], queryFn: () => authApi.mfaPolicy() });
  const [draft, setDraft] = useState(null);
  const current = draft ?? policy.data?.policy ?? 'OPTIONAL';

  const save = useMutation({
    mutationFn: (value) => authApi.updateMfaPolicy(value),
    onSuccess: (data) => {
      setDraft(null);
      queryClient.setQueryData(['auth', 'mfa-policy'], data);
      queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
      toast.success('Two-step verification policy saved.');
    },
    onError: (err) => toast.error(apiMessage(err, "We couldn't save the policy.")),
  });

  const selected = TWO_FACTOR_POLICIES.find((item) => item.value === current);
  const dirty = draft !== null && draft !== policy.data?.policy;

  return (
    <Card
      title="Two-step verification"
      subtitle="People who must use it are asked to set it up the next time they sign in."
    >
      {policy.isError ? (
        <p className="text-secondary mb-0">Couldn't load the current policy.</p>
      ) : (
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div style={{ minWidth: 260 }}>
            <FormField
              as="select"
              label="Policy"
              value={current}
              onChange={setDraft}
              disabled={policy.isLoading || save.isPending}
              hint={selected?.help}
            >
              {TWO_FACTOR_POLICIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </FormField>
          </div>
          <div className="mb-3">
            <Button icon={ShieldCheck} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(current)}>
              Save policy
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Row action: wipe a user's 2FA (lost phone). Audited server-side as MFA_RESET_BY_ADMIN. */
export function ResetTwoFactorButton({ user }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const reset = useMutation({
    mutationFn: () => authApi.resetUserMfa(user.id),
    onSuccess: () => {
      setOpen(false);
      toast.success(`Two-step verification reset for ${user.fullName || user.email}.`);
    },
    onError: (err) => toast.error(apiMessage(err, "We couldn't reset two-step verification.")),
  });
  return (
    <>
      <Button variant="secondary" size="sm" icon={ShieldOff} onClick={() => setOpen(true)}>
        Reset 2FA
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => reset.mutate()}
        loading={reset.isPending}
        title="Reset two-step verification?"
        description={`${user.fullName || user.email}'s authenticator app, email codes, recovery codes and remembered devices stop working. They can set up two-step verification again after signing in (if your policy requires it, they will be asked for an emailed code meanwhile).`}
        confirmLabel="Reset"
      />
    </>
  );
}
