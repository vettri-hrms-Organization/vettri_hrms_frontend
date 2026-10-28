import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { authApi } from '../../api/endpoints/auth';
import { usersApi } from '../../api/endpoints/users';
import { WHATSAPP_EVENTS, whatsappApi } from '../../api/endpoints/whatsapp';
import { formatDateTimeIST } from '../../utils/formatDateTime';

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

export default function SettingsSignIn() {
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Settings" title="Sign-in & WhatsApp"
        description="Single sign-on with Google or Microsoft, and WhatsApp alerts for important HR events." />
      <SsoSettingsCard />
      <WhatsAppSettingsCard />
    </div>
  );
}

function SsoSettingsCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['sso-settings'], queryFn: authApi.ssoSettings });
  const users = useQuery({ queryKey: ['users', 'list'], queryFn: usersApi.list });
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings.data) {
      setForm({
        ssoOnly: settings.data.ssoOnly,
        breakGlassUserId: settings.data.breakGlassUserId ? String(settings.data.breakGlassUserId) : '',
        autoProvisionEnabled: settings.data.autoProvisionEnabled,
        autoProvisionDomains: (settings.data.autoProvisionDomains || []).join(', '),
        trustSsoMfa: settings.data.trustSsoMfa,
      });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => authApi.updateSsoSettings({
      ssoOnly: form.ssoOnly,
      breakGlassUserId: form.breakGlassUserId ? Number(form.breakGlassUserId) : null,
      autoProvisionEnabled: form.autoProvisionEnabled,
      autoProvisionDomains: form.autoProvisionDomains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean),
      trustSsoMfa: form.trustSsoMfa,
    }),
    onSuccess: (data) => { queryClient.setQueryData(['sso-settings'], data); toast.success('Sign-in settings saved.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not save sign-in settings.')),
  });

  const providers = settings.data?.configuredProviders || [];
  const admins = (Array.isArray(users.data) ? users.data : [])
    .filter((u) => (u.roles || []).includes('COMPANY_ADMIN') && u.active !== false);
  const toggle = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.checked }));

  return (
    <Card title="Single sign-on" subtitle={providers.length
      ? `Available on this server: ${providers.map((p) => p.name).join(', ')}`
      : 'No SSO provider is configured on this server yet - ask your Vettri administrator.'}>
      {settings.isLoading && <SkeletonText lines={4} />}
      {settings.isError && <ErrorState description="Couldn't load sign-in settings." onRetry={settings.refetch} />}
      {form && (
        <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="d-flex flex-column gap-3">
          <p className="mb-0" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)' }}>
            Employees sign in with the Google or Microsoft account that uses the same verified email as their Vettri account.
          </p>
          <label className="form-check-label d-flex gap-2">
            <input type="checkbox" className="form-check-input" checked={!!form.ssoOnly} disabled={!providers.length} onChange={toggle('ssoOnly')} />
            <span><strong>Require SSO</strong> - turn off password sign-in for everyone except the break-glass admin.</span>
          </label>
          {form.ssoOnly && (
            <div className="row">
              <FormField col={6} as="select" label="Break-glass admin (may still use a password)" value={form.breakGlassUserId}
                onChange={(value) => setForm((current) => ({ ...current, breakGlassUserId: value }))}>
                <option value="">Any company admin</option>
                {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.fullName || admin.username}</option>)}
              </FormField>
            </div>
          )}
          <label className="form-check-label d-flex gap-2">
            <input type="checkbox" className="form-check-input" checked={!!form.trustSsoMfa} onChange={toggle('trustSsoMfa')} />
            <span><strong>Trust the identity provider's MFA</strong> - skip Vettri two-step verification after SSO.</span>
          </label>
          <label className="form-check-label d-flex gap-2">
            <input type="checkbox" className="form-check-input" checked={!!form.autoProvisionEnabled} onChange={toggle('autoProvisionEnabled')} />
            <span><strong>Auto-create accounts</strong> for verified emails on your company domain (employee role).</span>
          </label>
          {form.autoProvisionEnabled && (
            <div className="row">
              <FormField col={8} label="Company email domains" placeholder="acme.in, acme.com" value={form.autoProvisionDomains}
                onChange={(value) => setForm((current) => ({ ...current, autoProvisionDomains: value }))} />
            </div>
          )}
          <div><Button type="submit" loading={save.isPending}>Save sign-in settings</Button></div>
        </form>
      )}
    </Card>
  );
}

function WhatsAppSettingsCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['whatsapp-settings'], queryFn: whatsappApi.settings });
  const deliveries = useQuery({ queryKey: ['whatsapp-deliveries'], queryFn: whatsappApi.deliveries });
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings.data) setForm({ enabled: settings.data.enabled, events: settings.data.events || [] });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => whatsappApi.updateSettings(form),
    onSuccess: (data) => { queryClient.setQueryData(['whatsapp-settings'], data); toast.success('WhatsApp settings saved.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not save WhatsApp settings.')),
  });

  const serverEnabled = settings.data?.serverEnabled;
  const templates = settings.data?.templateConfigured || {};
  const rows = Array.isArray(deliveries.data) ? deliveries.data : [];

  return (
    <Card title="WhatsApp notifications" subtitle={serverEnabled
      ? 'Employees who opt in (Notifications page) get approved template messages for the events below.'
      : 'WhatsApp is not enabled on this server yet. Settings can still be prepared.'}>
      {settings.isLoading && <SkeletonText lines={4} />}
      {settings.isError && <ErrorState description="Couldn't load WhatsApp settings." onRetry={settings.refetch} />}
      {form && (
        <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="d-flex flex-column gap-3">
          <label className="form-check-label d-flex gap-2">
            <input type="checkbox" className="form-check-input" checked={!!form.enabled}
              onChange={(e) => setForm((current) => ({ ...current, enabled: e.target.checked }))} />
            <strong>Send WhatsApp messages for this company</strong>
          </label>
          <div className="d-flex flex-column gap-2 ps-4">
            {Object.entries(WHATSAPP_EVENTS).map(([event, label]) => (
              <label key={event} className="form-check-label d-flex gap-2">
                <input type="checkbox" className="form-check-input" disabled={!form.enabled} checked={form.events.includes(event)}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    events: e.target.checked ? [...current.events, event] : current.events.filter((x) => x !== event),
                  }))} />
                <span>{label}{templates[event] === false && <small className="text-warning ms-2">(no template configured)</small>}</span>
              </label>
            ))}
          </div>
          <div><Button type="submit" loading={save.isPending}>Save WhatsApp settings</Button></div>
        </form>
      )}
      {rows.length > 0 && (
        <div className="table-responsive mt-4">
          <table className="table table-sm mb-0 hz-table" aria-label="Recent WhatsApp deliveries">
            <thead><tr><th>When</th><th>Event</th><th>To</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTimeIST(row.createdAt)}</td>
                  <td>{WHATSAPP_EVENTS[row.eventType] || row.eventType}</td>
                  <td>{row.phone}</td>
                  <td>{row.status}</td>
                  <td className="text-truncate" style={{ maxWidth: 260 }}>{row.error || row.providerMessageId || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
