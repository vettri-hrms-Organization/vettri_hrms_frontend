import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageShell from '../components/ui/PageShell';
import SectionHeader from '../components/ui/SectionHeader';
import Card from '../components/ui/Card';
import { useTheme } from '../contexts/ThemeContext';
import { notificationsApi } from '../api/endpoints/notifications';

const PREFERENCES_KEY = 'vettri.regional-preferences';
const DEFAULTS = { language: 'en-IN', timezone: 'Asia/Kolkata', currency: 'INR' };

export default function SettingsPreferences() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const notificationPreferences = useQuery({
    queryKey: ['notification-email-preferences'],
    queryFn: notificationsApi.emailPreferences,
  });
  const updateNotificationPreferences = useMutation({
    mutationFn: notificationsApi.updateEmailPreferences,
    onSuccess: (data) => queryClient.setQueryData(['notification-email-preferences'], data),
  });
  const [preferences, setPreferences] = useState(() => {
    try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(PREFERENCES_KEY)) || {}) }; } catch { return DEFAULTS; }
  });

  useEffect(() => { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }, [preferences]);
  const update = (key, value) => setPreferences((current) => ({ ...current, [key]: value }));

  return (
    <PageShell className="hz-admin-page hz-admin-page--preferences d-flex flex-column gap-4">
      <SectionHeader eyebrow="Preferences" title="Workspace preferences" description="Personalize how Vettri HRMS looks and presents regional information." />
      <div id="notifications">
        <Card title="Email notifications" subtitle="Choose whether workflow updates are also sent to your account email.">
          {notificationPreferences.isError && <p role="alert" className="text-danger">Couldn't load notification preferences. Reload this page to try again.</p>}
          {notificationPreferences.isLoading && <p className="text-secondary-hz">Loading email preferences…</p>}
          {!notificationPreferences.isLoading && !notificationPreferences.isError && (
            <>
              <label className="hz-preference-row">
                <span><strong>Workflow updates</strong><small>Leave, attendance, document and payroll notifications.</small></span>
                <input
                  type="checkbox"
                  aria-label="Email workflow updates"
                  checked={notificationPreferences.data?.workflowEmailEnabled ?? true}
                  disabled={updateNotificationPreferences.isPending}
                  onChange={(event) => updateNotificationPreferences.mutate({ workflowEmailEnabled: event.target.checked })}
                />
              </label>
              <p className="text-secondary-hz mb-0">Critical security alerts remain enabled.</p>
              {updateNotificationPreferences.isError && <p role="alert" className="text-danger mt-2 mb-0">Couldn't save email preferences.</p>}
            </>
          )}
        </Card>
      </div>
      <Card title="Appearance" subtitle="Your preference is saved on this device.">
        <label className="hz-preference-row"><span><strong>Theme</strong><small>Choose the most comfortable workspace appearance.</small></span><select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Theme"><option value="light">Light</option><option value="dark">Dark</option></select></label>
      </Card>
      <Card title="Regional format" subtitle="These defaults guide localized date and currency views.">
        <label className="hz-preference-row"><span><strong>Language and region</strong><small>Translation resources are currently available for English (India).</small></span><select value={preferences.language} onChange={(event) => update('language', event.target.value)} aria-label="Language and region"><option value="en-IN">English (India)</option></select></label>
        <label className="hz-preference-row"><span><strong>Time zone</strong><small>Saved as your preferred display time zone.</small></span><select value={preferences.timezone} onChange={(event) => update('timezone', event.target.value)} aria-label="Time zone"><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="Asia/Dubai">Asia/Dubai</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></label>
        <label className="hz-preference-row"><span><strong>Currency</strong><small>Saved as your preferred financial display currency.</small></span><select value={preferences.currency} onChange={(event) => update('currency', event.target.value)} aria-label="Currency"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="AED">AED</option><option value="GBP">GBP</option></select></label>
      </Card>
    </PageShell>
  );
}
