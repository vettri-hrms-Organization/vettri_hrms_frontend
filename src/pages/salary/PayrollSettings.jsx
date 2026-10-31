import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { statutorySettingsApi } from '../../api/endpoints/salary';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import LwfCard from './components/LwfCard';

const EDITABLE_KEYS = [
  'pfEnabled', 'pfEmployeeRate', 'pfEmployerRate', 'epsRate', 'pfWageCeiling', 'pfOnFullBasic',
  'esiEnabled', 'esiEmployeeRate', 'esiEmployerRate', 'esiWageThreshold',
  'ptEnabled', 'ptState', 'ptFixedOverride', 'ptFixedAmount', 'tdsEnabled',
];

/**
 * Company statutory payroll settings (SALARY_MANAGE, organization scope): PF, ESI,
 * professional tax and TDS. Used by every salary structure that has
 * "auto-calculate statutory deductions" switched on.
 */
export default function PayrollSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['statutory-settings'], queryFn: statutorySettingsApi.get });

  useEffect(() => {
    if (data) setForm(Object.fromEntries(EDITABLE_KEYS.map((key) => [key, data[key] ?? ''])));
  }, [data]);

  const save = useMutation({
    mutationFn: statutorySettingsApi.update,
    onSuccess: (saved) => {
      queryClient.setQueryData(['statutory-settings'], saved);
      toast.success('Payroll settings saved. They apply to the next payroll run you create.');
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not save payroll settings'),
  });

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...form };
    ['pfEmployeeRate', 'pfEmployerRate', 'epsRate', 'pfWageCeiling', 'esiEmployeeRate', 'esiEmployerRate', 'esiWageThreshold', 'ptFixedAmount']
      .forEach((key) => { payload[key] = payload[key] === '' ? 0 : Number(payload[key]); });
    payload.ptState = payload.ptState || null;
    save.mutate(payload);
  }

  if (isError) return <ErrorState description="Couldn't load payroll settings." onRetry={refetch} />;

  const states = data?.ptStates || [];
  const selectedState = states.find((s) => s.code === (form?.ptState || data?.resolvedPtState));

  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll Settings"
        description="Statutory deductions applied to salary structures with auto-calculation switched on"
      />

      {(isLoading || !form) && <Card><SkeletonText lines={8} /></Card>}

      {form && (
        <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {!data.configured && (
            <p className="mb-0" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>
              These are the statutory defaults. Save once to keep them as your company settings.
            </p>
          )}

          <Card title="Provident Fund (EPF)" subtitle="Computed on basic salary for the paid days" actions={<Toggle checked={form.pfEnabled} onChange={(v) => set('pfEnabled', v)} label="Enabled" />}>
            <div className="row g-2">
              <FormField col={3} type="number" step="0.01" min="0" label="Employee share (%)" value={form.pfEmployeeRate} onChange={(v) => set('pfEmployeeRate', v)} disabled={!form.pfEnabled} />
              <FormField col={3} type="number" step="0.01" min="0" label="Employer share (%)" value={form.pfEmployerRate} onChange={(v) => set('pfEmployerRate', v)} disabled={!form.pfEnabled} hint="EPS + EPF" />
              <FormField col={3} type="number" step="0.01" min="0" label="EPS (pension) (%)" value={form.epsRate} onChange={(v) => set('epsRate', v)} disabled={!form.pfEnabled} hint="On wages up to the ceiling" />
              <FormField col={3} type="number" step="1" min="0" label="PF wage ceiling (₹)" value={form.pfWageCeiling} onChange={(v) => set('pfWageCeiling', v)} disabled={!form.pfEnabled} />
            </div>
            <Toggle
              checked={form.pfOnFullBasic}
              onChange={(v) => set('pfOnFullBasic', v)}
              disabled={!form.pfEnabled}
              label="Contribute on full basic (above the ceiling). EPS and EDLI stay capped at the ceiling."
            />
          </Card>

          <Card title="Employees' State Insurance (ESI)" subtitle="Applies while monthly gross is at or below the threshold; coverage continues to the end of the contribution period (Apr-Sep / Oct-Mar)" actions={<Toggle checked={form.esiEnabled} onChange={(v) => set('esiEnabled', v)} label="Enabled" />}>
            <div className="row g-2">
              <FormField col={4} type="number" step="0.01" min="0" label="Employee share (%)" value={form.esiEmployeeRate} onChange={(v) => set('esiEmployeeRate', v)} disabled={!form.esiEnabled} />
              <FormField col={4} type="number" step="0.01" min="0" label="Employer share (%)" value={form.esiEmployerRate} onChange={(v) => set('esiEmployerRate', v)} disabled={!form.esiEnabled} />
              <FormField col={4} type="number" step="1" min="0" label="Gross threshold (₹/month)" value={form.esiWageThreshold} onChange={(v) => set('esiWageThreshold', v)} disabled={!form.esiEnabled} />
            </div>
          </Card>

          <Card title="Professional Tax" subtitle="Monthly slab by state on the month's gross" actions={<Toggle checked={form.ptEnabled} onChange={(v) => set('ptEnabled', v)} label="Enabled" />}>
            <div className="row g-2">
              <FormField
                col={6}
                as="select"
                label="State"
                value={form.ptState || ''}
                onChange={(v) => set('ptState', v)}
                disabled={!form.ptEnabled || form.ptFixedOverride}
                hint={!form.ptState && data.resolvedPtState ? `Using your office location: ${states.find((s) => s.code === data.resolvedPtState)?.name || data.resolvedPtState}` : undefined}
              >
                <option value="">From office location{data.resolvedPtState ? '' : ' (none found - no PT)'}</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </FormField>
              <FormField
                col={6}
                type="number"
                step="1"
                min="0"
                label="Fixed monthly amount (₹)"
                value={form.ptFixedAmount}
                onChange={(v) => set('ptFixedAmount', v)}
                disabled={!form.ptEnabled || !form.ptFixedOverride}
              />
            </div>
            <Toggle
              checked={form.ptFixedOverride}
              onChange={(v) => set('ptFixedOverride', v)}
              disabled={!form.ptEnabled}
              label="Override the state slab with a fixed monthly amount for every employee"
            />
            {selectedState && !form.ptFixedOverride && (
              <p className="mb-0 mt-2" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                {selectedState.name}: {selectedState.notes}
                {selectedState.basis === 'HALF_YEARLY' ? ' Levied half-yearly; deducted in six equal monthly parts.' : ''}
                {selectedState.effectiveFrom && selectedState.effectiveFrom !== '-' ? ` (rates effective ${selectedState.effectiveFrom})` : ''}
              </p>
            )}
          </Card>

          <Card title="Income Tax (TDS)" subtitle="Projected annual tax from salary and each employee's regime and investment declaration, spread over the remaining months of the financial year" actions={<Toggle checked={form.tdsEnabled} onChange={(v) => set('tdsEnabled', v)} label="Enabled" />}>
            <p className="mb-0" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>
              New regime is the default. Employees choose their regime and declare investments under My Workspace &rarr; Tax declaration;
              HR can review them under Payroll &rarr; Tax Declarations.
            </p>
          </Card>

          <div className="d-flex justify-content-end">
            <Button type="submit" icon={Save} loading={save.isPending}>Save settings</Button>
          </div>
        </form>
      )}
      {!isLoading && form && <LwfCard />}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className="form-check form-switch d-inline-flex align-items-center gap-2 mb-0" style={{ fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input
        type="checkbox"
        role="switch"
        className="form-check-input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
