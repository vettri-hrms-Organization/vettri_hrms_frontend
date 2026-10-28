import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leavePolicyApi } from '../../api/endpoints/leave';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import Button from '../../components/ui/Button';
import ErrorBanner from '../../components/ui/ErrorBanner';

const toInput = (value) => (value === null || value === undefined ? '' : String(value));
const toNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

function initialForm(type) {
  const p = type.policy || {};
  return {
    accrualMode: p.accrualMode || 'YEARLY_UPFRONT',
    accrualRounding: p.accrualRounding || 'HALF_DAY',
    prorateOnJoining: Boolean(p.prorateOnJoining),
    joiningCutoffDay: toInput(p.joiningCutoffDay),
    maxBalanceDays: toInput(p.maxBalanceDays),
    probationDays: toInput(p.probationDays),
    negativeBalanceDays: toInput(p.negativeBalanceDays),
    carryForward: Boolean(type.carryForward),
    maxCarryForwardDays: toInput(p.maxCarryForwardDays),
    carryForwardExpiryMonths: toInput(p.carryForwardExpiryMonths),
    encashable: Boolean(p.encashable),
    maxEncashableDaysPerYear: toInput(p.maxEncashableDaysPerYear),
    encashmentBasis: p.encashmentBasis || 'BASIC',
    creditExpiryDays: toInput(p.creditExpiryDays ?? 90),
  };
}

/** Edits the accrual / carry-forward / encashment policy of one leave type (PUT /api/leave-types/{id}/policy). */
export default function LeavePolicyDialog({ type, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialForm(type));
  const [error, setError] = useState(null);
  const system = Boolean(type.policy?.systemManaged);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const save = useMutation({
    mutationFn: (payload) => leavePolicyApi.updatePolicy(type.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not save the policy'),
  });

  function submit(e) {
    e.preventDefault();
    setError(null);
    save.mutate({
      accrualMode: form.accrualMode,
      accrualRounding: form.accrualRounding,
      prorateOnJoining: form.prorateOnJoining,
      joiningCutoffDay: toNumber(form.joiningCutoffDay),
      maxBalanceDays: toNumber(form.maxBalanceDays),
      probationDays: toNumber(form.probationDays),
      negativeBalanceDays: toNumber(form.negativeBalanceDays),
      carryForward: form.carryForward,
      maxCarryForwardDays: form.carryForward ? toNumber(form.maxCarryForwardDays) : null,
      carryForwardExpiryMonths: form.carryForward ? toNumber(form.carryForwardExpiryMonths) : null,
      encashable: form.encashable,
      maxEncashableDaysPerYear: form.encashable ? toNumber(form.maxEncashableDaysPerYear) : null,
      encashmentBasis: form.encashmentBasis,
      creditExpiryDays: toNumber(form.creditExpiryDays),
    });
  }

  const check = (id, field, label) => (
    <div className="form-check mb-2">
      <input id={id} type="checkbox" className="form-check-input" checked={form[field]} onChange={(e) => set(field, e.target.checked)} />
      <label className="form-check-label" htmlFor={id} style={{ fontSize: 'var(--hz-text-sm)' }}>{label}</label>
    </div>
  );

  return (
    <Dialog open onClose={onClose} title={`${type.name} policy`} description={system ? 'Comp-off credits come from approved comp-off requests.' : `${type.defaultDaysPerYear} days per year`} size="lg">
      <form onSubmit={submit}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {system ? (
          <FormField label="Comp-off credit expiry (days after the day worked)" type="number" min="1" max="730" required value={form.creditExpiryDays} onChange={(v) => set('creditExpiryDays', v)} hint="Unused comp-off lapses after this many days. Default 90." />
        ) : (
          <>
            <h3 style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>Accrual</h3>
            <div className="row g-3 mb-2">
              <FormField col={6} as="select" label="Accrual mode" value={form.accrualMode} onChange={(v) => set('accrualMode', v)}>
                <option value="YEARLY_UPFRONT">Yearly, credited upfront on 1 Jan</option>
                <option value="MONTHLY">Monthly (1/12 on the 1st of each month)</option>
                <option value="QUARTERLY">Quarterly (on 1 Jan / Apr / Jul / Oct)</option>
              </FormField>
              <FormField col={6} as="select" label="Rounding" value={form.accrualRounding} onChange={(v) => set('accrualRounding', v)}>
                <option value="HALF_DAY">Nearest half day</option>
                <option value="EXACT">Exact (2 decimals)</option>
              </FormField>
              <FormField col={4} label="Joining cut-off day" type="number" min="1" max="31" value={form.joiningCutoffDay} onChange={(v) => set('joiningCutoffDay', v)} hint="Joined after this day: no credit for that month (e.g. 15)" />
              <FormField col={4} label="Probation (days)" type="number" min="0" value={form.probationDays} onChange={(v) => set('probationDays', v)} hint="Accrual starts after joining + N days" />
              <FormField col={4} label="Maximum balance (days)" type="number" min="0" step="0.5" value={form.maxBalanceDays} onChange={(v) => set('maxBalanceDays', v)} hint="Accrual stops at this cap" />
              <FormField col={6} label="Negative balance allowed (days)" type="number" min="0" step="0.5" value={form.negativeBalanceDays} onChange={(v) => set('negativeBalanceDays', v)} hint="Leave can be taken until the balance is -N" />
            </div>
            {form.accrualMode === 'YEARLY_UPFRONT' && check('policy-prorate', 'prorateOnJoining', 'Prorate the yearly allocation for mid-year joiners')}

            <h3 className="mt-3" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>Year-end carry-forward</h3>
            {check('policy-carry', 'carryForward', 'Carry unused days into the next year')}
            {form.carryForward && (
              <div className="row g-3 mb-2">
                <FormField col={6} label="Maximum carry-forward (days)" type="number" min="0" step="0.5" value={form.maxCarryForwardDays} onChange={(v) => set('maxCarryForwardDays', v)} hint="Blank = carry everything" />
                <FormField col={6} label="Carried days expire after (months)" type="number" min="1" max="12" value={form.carryForwardExpiryMonths} onChange={(v) => set('carryForwardExpiryMonths', v)} hint="Blank = never expire" />
              </div>
            )}

            <h3 className="mt-3" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>Encashment</h3>
            {check('policy-encash', 'encashable', 'Employees can encash this leave')}
            {form.encashable && (
              <div className="row g-3 mb-2">
                <FormField col={6} label="Maximum encashable days per year" type="number" min="0" step="0.5" value={form.maxEncashableDaysPerYear} onChange={(v) => set('maxEncashableDaysPerYear', v)} hint="Blank = no yearly limit" />
                <FormField col={6} as="select" label="Pay basis" value={form.encashmentBasis} onChange={(v) => set('encashmentBasis', v)} hint="Per day = monthly amount / 30">
                  <option value="BASIC">Basic salary</option>
                  <option value="GROSS">Gross salary</option>
                </FormField>
              </div>
            )}
          </>
        )}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save policy</Button>
        </div>
      </form>
    </Dialog>
  );
}
