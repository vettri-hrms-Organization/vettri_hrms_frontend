import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, KeyRound, Mail, MonitorSmartphone, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import FormField from '../ui/FormField';
import StatusBadge from '../ui/StatusBadge';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/endpoints/auth';

export const MFA_STATUS_KEY = ['auth', 'mfa-status'];

const METHOD_LABELS = { TOTP: 'Authenticator app', EMAIL: 'Email code', RECOVERY: 'Recovery code' };

function apiMessage(err, fallback) {
  return err?.apiMessage || err?.response?.data?.message || fallback;
}

/** "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP" for typing into an app by hand. */
export function groupSecret(secret) {
  return (String(secret || '').match(/.{1,4}/g) || []).join(' ');
}

async function copyText(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard.');
  } catch {
    toast.info('Copy failed - select the text and copy it manually.');
  }
}

/**
 * Two-step verification settings on Account > Security: authenticator app
 * (TOTP) and email-code enrolment, recovery codes, remembered devices and
 * turning 2FA off. QR codes are not rendered (no QR library is bundled); the
 * otpauth:// link opens the authenticator app directly on a phone and the
 * grouped secret can be typed in on any device.
 */
export default function TwoFactorSection() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const status = useQuery({ queryKey: MFA_STATUS_KEY, queryFn: () => authApi.mfaStatus() });

  const [enrollment, setEnrollment] = useState(null); // { secret, otpauthUri, account }
  const [totpCode, setTotpCode] = useState('');
  const [emailStep, setEmailStep] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [dialog, setDialog] = useState(null); // 'disable' | 'regenerate'
  const [error, setError] = useState('');

  const afterChange = async (data) => {
    if (data?.recoveryCodes?.length) setRecoveryCodes(data.recoveryCodes);
    await queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY });
    try {
      await refreshUser?.();
    } catch {
      // /me refresh is best-effort; the next navigation re-reads it anyway.
    }
  };

  const enroll = useMutation({
    mutationFn: () => authApi.enrollTotp(),
    onSuccess: (data) => {
      setEnrollment(data);
      setTotpCode('');
      setError('');
    },
    onError: (err) => setError(apiMessage(err, "We couldn't start authenticator setup.")),
  });

  const confirmTotp = useMutation({
    mutationFn: (code) => authApi.confirmTotp(code),
    onSuccess: async (data) => {
      setEnrollment(null);
      setTotpCode('');
      setError('');
      toast.success('Authenticator app connected. Two-step verification is on.');
      await afterChange(data);
    },
    onError: (err) => setError(apiMessage(err, "That code didn't match. Try the newest code from your app.")),
  });

  const sendSetupEmail = useMutation({
    mutationFn: () => authApi.sendMfaSetupEmail(),
    onSuccess: (data) => {
      setEmailStep(true);
      setError('');
      toast.info(`Code sent to ${data?.sentTo || 'your email'}.`);
    },
    onError: (err) => setError(apiMessage(err, "We couldn't send the email.")),
  });

  const enableEmail = useMutation({
    mutationFn: (code) => authApi.enableEmailMfa(code),
    onSuccess: async (data) => {
      setEmailStep(false);
      setEmailCode('');
      setError('');
      toast.success('Email codes are on.');
      await afterChange(data);
    },
    onError: (err) => setError(apiMessage(err, 'Invalid or expired code.')),
  });

  const forgetDevices = useMutation({
    mutationFn: () => authApi.forgetTrustedDevices(),
    onSuccess: async () => {
      toast.success('Remembered devices will be asked for a code again.');
      await queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY });
    },
    onError: (err) => toast.error(apiMessage(err, "We couldn't update remembered devices.")),
  });

  if (status.isLoading) {
    return (
      <Card title="Two-step verification">
        <Skeleton height={80} />
      </Card>
    );
  }
  if (status.isError || !status.data) {
    return (
      <Card title="Two-step verification">
        <p className="text-secondary mb-2">We couldn't load your two-step verification settings.</p>
        <Button variant="secondary" size="sm" onClick={() => status.refetch()}>Try again</Button>
      </Card>
    );
  }

  const s = status.data;
  if (!s.available) {
    return (
      <Card title="Two-step verification" subtitle="Turned off by your organisation's administrator.">
        <p className="text-secondary mb-0">Ask your administrator if you'd like to protect your account with a second step.</p>
      </Card>
    );
  }

  const enabledMethods = [s.totpEnabled && 'TOTP', s.emailOtpEnabled && 'EMAIL', s.recoveryCodesRemaining > 0 && 'RECOVERY'].filter(Boolean);

  return (
    <Card
      title="Two-step verification"
      subtitle="After your password, confirm it's you with a code from your phone or email."
      actions={<StatusBadge variant={s.enabled ? 'success' : 'neutral'}>{s.enabled ? 'On' : 'Off'}</StatusBadge>}
    >
      {s.enrollmentRequired && (
        <div role="alert" className="alert alert-warning mb-3">
          Your organisation requires two-step verification. Set up an authenticator app or email codes to continue using Vettri HRMS.
        </div>
      )}
      {error && <p role="alert" className="text-danger">{error}</p>}

      {recoveryCodes && (
        <RecoveryCodesPanel codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
      )}

      <div className="d-flex flex-column gap-3">
        {/* Authenticator app */}
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 border rounded p-3">
          <div className="d-flex gap-2">
            <Smartphone size={20} aria-hidden="true" className="mt-1" />
            <div>
              <div className="fw-semibold">Authenticator app</div>
              <div className="text-secondary small">Google Authenticator, Microsoft Authenticator, Authy, 1Password and similar apps.</div>
            </div>
          </div>
          {s.totpEnabled && !enrollment ? (
            <div className="d-flex align-items-center gap-2">
              <StatusBadge variant="success">Enabled</StatusBadge>
              <Button variant="link" size="sm" onClick={() => enroll.mutate()} loading={enroll.isPending}>Move to a new phone</Button>
            </div>
          ) : !enrollment && (
            <Button size="sm" icon={ShieldCheck} onClick={() => enroll.mutate()} loading={enroll.isPending}>Set up</Button>
          )}
          {enrollment && (
            <div className="w-100 mt-2">
              <ol className="small ps-3 mb-3">
                <li className="mb-2">
                  In your authenticator app choose <em>Add account</em> &rarr; <em>Enter a setup key</em> and type this key
                  (time based, account <strong>{enrollment.account}</strong>):
                  <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                    <code data-testid="totp-secret" className="fs-5 px-2 py-1 border rounded" style={{ letterSpacing: '0.08em' }}>
                      {groupSecret(enrollment.secret)}
                    </code>
                    <Button variant="secondary" size="sm" icon={Copy} onClick={() => copyText(enrollment.secret, toast)}>Copy key</Button>
                  </div>
                  <div className="mt-2">
                    On this phone? <a href={enrollment.otpauthUri}>Open in authenticator app</a>
                  </div>
                </li>
                <li>Enter the 6-digit code the app shows to finish.</li>
              </ol>
              <form
                className="d-flex flex-wrap align-items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (totpCode.trim()) confirmTotp.mutate(totpCode.trim());
                }}
              >
                <div style={{ maxWidth: 200 }}>
                  <FormField label="Code from the app" value={totpCode} onChange={setTotpCode} inputMode="numeric" autoComplete="one-time-code" maxLength={8} />
                </div>
                <div className="mb-3 d-flex gap-2">
                  <Button type="submit" loading={confirmTotp.isPending}>Verify and turn on</Button>
                  <Button variant="secondary" onClick={() => setEnrollment(null)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Email code */}
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 border rounded p-3">
          <div className="d-flex gap-2">
            <Mail size={20} aria-hidden="true" className="mt-1" />
            <div>
              <div className="fw-semibold">Email code</div>
              <div className="text-secondary small">A 6-digit code sent to {s.email || 'your email'} each time you sign in.</div>
            </div>
          </div>
          {s.emailOtpEnabled ? (
            <StatusBadge variant="success">Enabled</StatusBadge>
          ) : !emailStep && (
            <Button size="sm" variant="secondary" icon={Mail} onClick={() => sendSetupEmail.mutate()} loading={sendSetupEmail.isPending}>
              Set up
            </Button>
          )}
          {emailStep && !s.emailOtpEnabled && (
            <form
              className="w-100 d-flex flex-wrap align-items-end gap-2 mt-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (emailCode.trim()) enableEmail.mutate(emailCode.trim());
              }}
            >
              <div style={{ maxWidth: 200 }}>
                <FormField label="Code from the email" value={emailCode} onChange={setEmailCode} inputMode="numeric" autoComplete="one-time-code" maxLength={8} />
              </div>
              <div className="mb-3 d-flex gap-2">
                <Button type="submit" loading={enableEmail.isPending}>Turn on</Button>
                <Button variant="link" onClick={() => sendSetupEmail.mutate()} loading={sendSetupEmail.isPending}>Resend</Button>
              </div>
            </form>
          )}
        </div>

        {s.enabled && (
          <>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded p-3">
              <div className="d-flex gap-2">
                <KeyRound size={20} aria-hidden="true" className="mt-1" />
                <div>
                  <div className="fw-semibold">Recovery codes</div>
                  <div className="text-secondary small">
                    {s.recoveryCodesRemaining} unused. Use one if you lose your phone or can't get email.
                  </div>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setDialog('regenerate')}>Generate new codes</Button>
            </div>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded p-3">
              <div className="d-flex gap-2">
                <MonitorSmartphone size={20} aria-hidden="true" className="mt-1" />
                <div>
                  <div className="fw-semibold">Remembered devices</div>
                  <div className="text-secondary small">{s.trustedDevices} device(s) skip the code for up to 30 days.</div>
                </div>
              </div>
              <Button size="sm" variant="secondary" disabled={!s.trustedDevices} onClick={() => forgetDevices.mutate()} loading={forgetDevices.isPending}>
                Forget all
              </Button>
            </div>

            {!s.required && (
              <div>
                <Button variant="link" className="text-danger px-0" icon={ShieldOff} onClick={() => setDialog('disable')}>
                  Turn off two-step verification
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <DisableDialog
        open={dialog === 'disable'}
        methods={enabledMethods}
        onClose={() => setDialog(null)}
        onDone={async () => {
          setDialog(null);
          toast.success('Two-step verification is off.');
          await afterChange(null);
        }}
      />
      <RegenerateDialog
        open={dialog === 'regenerate'}
        onClose={() => setDialog(null)}
        onDone={async (codes) => {
          setDialog(null);
          setRecoveryCodes(codes);
          await queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY });
        }}
      />
    </Card>
  );
}

function RecoveryCodesPanel({ codes, onDone }) {
  const toast = useToast();
  const text = codes.join('\n');
  const download = () => {
    const blob = new Blob([`Vettri HRMS recovery codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vettri-hrms-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="alert alert-info mb-3" role="region" aria-label="Recovery codes">
      <div className="fw-semibold mb-1">Save your recovery codes</div>
      <p className="small mb-2">This is the only time they are shown. Each code signs you in once if you lose access to your phone or email.</p>
      <div className="d-grid gap-1 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
        {codes.map((code) => (
          <code key={code} className="px-2 py-1 bg-white border rounded text-center">{code}</code>
        ))}
      </div>
      <div className="d-flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={Copy} onClick={() => copyText(text, toast)}>Copy</Button>
        <Button size="sm" variant="secondary" icon={Download} onClick={download}>Download</Button>
        <Button size="sm" onClick={onDone}>I've saved them</Button>
      </div>
    </div>
  );
}

function DisableDialog({ open, methods, onClose, onDone }) {
  const [form, setForm] = useState({ currentPassword: '', method: methods[0] || 'TOTP', code: '' });
  const [error, setError] = useState('');
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const method = methods.includes(form.method) ? form.method : methods[0] || 'TOTP';

  const sendCode = useMutation({
    mutationFn: () => authApi.sendMfaSetupEmail(),
    onSuccess: () => setError(''),
    onError: (err) => setError(apiMessage(err, "We couldn't send the email.")),
  });
  const disable = useMutation({
    mutationFn: () => authApi.disableMfa({ currentPassword: form.currentPassword, method, code: form.code.trim() }),
    onSuccess: () => {
      setForm({ currentPassword: '', method: methods[0] || 'TOTP', code: '' });
      setError('');
      onDone();
    },
    onError: (err) => setError(apiMessage(err, "We couldn't turn off two-step verification.")),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Turn off two-step verification"
      description="Your account will be protected by your password only."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={disable.isPending}
            disabled={!form.currentPassword || !form.code.trim()}
            onClick={() => disable.mutate()}
          >
            Turn off
          </Button>
        </>
      )}
    >
      <FormField label="Account password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} required />
      <FormField as="select" label="Confirm with" value={method} onChange={set('method')}>
        {methods.map((value) => <option key={value} value={value}>{METHOD_LABELS[value]}</option>)}
      </FormField>
      {method === 'EMAIL' && (
        <Button variant="link" size="sm" className="px-0 mb-2" onClick={() => sendCode.mutate()} loading={sendCode.isPending}>
          {sendCode.isSuccess ? 'Resend email code' : 'Email me a code'}
        </Button>
      )}
      <FormField label={method === 'RECOVERY' ? 'Recovery code' : 'Code'} value={form.code} onChange={set('code')} autoComplete="one-time-code" />
      {error && <p role="alert" className="text-danger mb-0">{error}</p>}
    </Dialog>
  );
}

function RegenerateDialog({ open, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const regenerate = useMutation({
    mutationFn: () => authApi.regenerateRecoveryCodes(password),
    onSuccess: (data) => {
      setPassword('');
      setError('');
      onDone(data?.recoveryCodes || []);
    },
    onError: (err) => setError(apiMessage(err, "We couldn't generate new codes.")),
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Generate new recovery codes"
      description="Your old recovery codes stop working immediately."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={regenerate.isPending} disabled={!password} onClick={() => regenerate.mutate()}>Generate</Button>
        </>
      )}
    >
      <FormField label="Account password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />
      {error && <p role="alert" className="text-danger mb-0">{error}</p>}
    </Dialog>
  );
}
