import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { taxDeclarationApi } from '../../../api/endpoints/salary';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ErrorBanner from '../../../components/ui/ErrorBanner';
import FormField from '../../../components/ui/FormField';
import { SkeletonText } from '../../../components/ui/Skeleton';
import { useToast } from '../../../components/ui/Toast';
import { formatCurrency } from '../../../utils/formatCurrency';

const AMOUNT_FIELDS = [
  { key: 'section80C', label: '80C investments (₹/year)', hint: 'PPF, ELSS, LIC, tuition fees, principal on home loan... Your PF is added automatically. Max ₹1,50,000.' },
  { key: 'section80D', label: '80D medical insurance (₹/year)', hint: 'Self/family and parents premiums.' },
  { key: 'rentPaid', label: 'Rent paid (₹/year)', hint: 'For the HRA exemption.' },
  { key: 'homeLoanInterest', label: 'Home loan interest 24(b) (₹/year)', hint: 'Self-occupied property, max ₹2,00,000.' },
  { key: 'nps80ccd1b', label: 'NPS 80CCD(1B) (₹/year)', hint: 'Additional NPS contribution, max ₹50,000.' },
  { key: 'otherDeductions', label: 'Other Chapter VI-A deductions (₹/year)', hint: 'e.g. 80E education loan interest, 80G donations.' },
];

const EMPTY = { regime: 'NEW', section80C: 0, section80D: 0, rentPaid: 0, metroCity: false, homeLoanInterest: 0, nps80ccd1b: 0, otherDeductions: 0, otherDeductionsNote: '' };

/**
 * Regime choice + annual investment declaration for one FY, with a live
 * new-vs-old regime comparison. `employeeId` null = the signed-in employee
 * (self-service endpoints); otherwise the HR endpoints for that employee.
 */
export default function TaxDeclarationForm({ employeeId = null, fy, canEdit = true, onSaved }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const self = employeeId == null;
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const declarationKey = ['tax-declaration', employeeId ?? 'me', fy];
  const projectionKey = ['tax-projection', employeeId ?? 'me', fy];

  const { data, isLoading, isError } = useQuery({
    queryKey: declarationKey,
    queryFn: () => (self ? taxDeclarationApi.getMine(fy) : taxDeclarationApi.getForEmployee(employeeId, fy)),
  });
  const { data: projection } = useQuery({
    queryKey: projectionKey,
    queryFn: () => (self ? taxDeclarationApi.projectMine(fy) : taxDeclarationApi.projectForEmployee(employeeId, fy)),
  });

  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] ?? EMPTY[k]])) });
  }, [data]);

  const save = useMutation({
    mutationFn: (payload) => (self ? taxDeclarationApi.saveMine(fy, payload) : taxDeclarationApi.saveForEmployee(employeeId, fy, payload)),
    onSuccess: (saved) => {
      queryClient.setQueryData(declarationKey, saved);
      queryClient.invalidateQueries({ queryKey: projectionKey });
      queryClient.invalidateQueries({ queryKey: ['tax-declarations'] });
      toast.success('Tax declaration saved. It applies from the next payroll run.');
      onSaved?.(saved);
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not save the declaration'),
  });

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...form };
    AMOUNT_FIELDS.forEach(({ key }) => { payload[key] = payload[key] === '' ? 0 : Number(payload[key]); });
    save.mutate(payload);
  }

  if (isLoading) return <SkeletonText lines={6} />;
  if (isError) return <ErrorBanner>Couldn&apos;t load the tax declaration.</ErrorBanner>;

  const oldRegime = form.regime === 'OLD';

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-7">
        <form onSubmit={handleSubmit}>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <fieldset disabled={!canEdit}>
            <p className="hz-form-label mb-2">Tax regime</p>
            <div className="d-flex flex-wrap gap-3 mb-3">
              {[
                ['NEW', 'New regime (default)', 'Lower slab rates, ₹75,000 standard deduction, no investment deductions'],
                ['OLD', 'Old regime', 'Higher slabs; HRA, 80C, 80D, home loan and NPS deductions allowed'],
              ].map(([value, label, desc]) => (
                <label
                  key={value}
                  className="d-flex gap-2 p-3 flex-grow-1"
                  style={{ border: `1px solid ${form.regime === value ? 'var(--hz-primary-600)' : 'var(--hz-border)'}`, borderRadius: 'var(--hz-radius-lg)', cursor: 'pointer', minWidth: 220, flexBasis: 0 }}
                >
                  <input type="radio" name="regime" className="form-check-input mt-1" checked={form.regime === value} onChange={() => set('regime', value)} />
                  <span style={{ fontSize: 13 }}>
                    <strong>{label}</strong>
                    <span className="d-block" style={{ color: 'var(--hz-text-muted)' }}>{desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {!oldRegime && (
              <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                The amounts below only count under the old regime. You can still fill them in to compare both regimes on the right.
              </p>
            )}

            <div className="row g-2">
              {AMOUNT_FIELDS.map((f) => (
                <FormField key={f.key} col={6} type="number" min="0" step="1" label={f.label} hint={f.hint} value={form[f.key]} onChange={(v) => set(f.key, v)} />
              ))}
              <div className="col-12 col-md-6">
                <label className="form-check d-flex align-items-center gap-2 mb-3" style={{ fontSize: 13 }}>
                  <input type="checkbox" className="form-check-input" checked={!!form.metroCity} onChange={(e) => set('metroCity', e.target.checked)} />
                  I live in a metro city (Delhi, Mumbai, Kolkata, Chennai) - 50% HRA limit
                </label>
              </div>
              <FormField col={6} label="Note for other deductions" value={form.otherDeductionsNote || ''} onChange={(v) => set('otherDeductionsNote', v)} maxLength={500} />
            </div>
          </fieldset>
          {canEdit && (
            <div className="d-flex align-items-center justify-content-between mt-2">
              <span style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                {data?.submitted ? `Last saved ${data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : ''}` : 'Not submitted yet'}
              </span>
              <Button type="submit" icon={Save} loading={save.isPending}>Save declaration</Button>
            </div>
          )}
        </form>
      </div>

      <div className="col-12 col-lg-5">
        <Card title="Estimated tax" subtitle={projection ? `${projection.financialYearLabel} - ${projection.monthsPaid} month(s) paid, ${projection.monthsProjected} projected` : undefined}>
          {!projection && <SkeletonText lines={4} />}
          {projection && !projection.hasSalaryStructure && projection.monthsPaid === 0 && (
            <p className="mb-0" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>No salary structure yet, so there is nothing to estimate.</p>
          )}
          {projection && (projection.hasSalaryStructure || projection.monthsPaid > 0) && (
            <div style={{ fontSize: 13 }}>
              <table className="table table-sm mb-2">
                <thead>
                  <tr><th /><th className="text-end">New</th><th className="text-end">Old</th></tr>
                </thead>
                <tbody>
                  <Row label="Gross salary" a={projection.newRegime.grossSalary} b={projection.oldRegime.grossSalary} />
                  <Row label="Exemptions & deductions" a={sumDeductions(projection.newRegime)} b={sumDeductions(projection.oldRegime)} />
                  <Row label="Taxable income" a={projection.newRegime.taxableIncome} b={projection.oldRegime.taxableIncome} />
                  <Row label="Rebate 87A" a={projection.newRegime.rebate87A} b={projection.oldRegime.rebate87A} />
                  <Row label="Annual tax (incl. cess)" a={projection.newRegime.totalTax} b={projection.oldRegime.totalTax} bold />
                </tbody>
              </table>
              <p className="mb-1">
                <strong>{projection.recommendedRegime === 'OLD' ? 'Old' : 'New'} regime</strong> costs less with these figures.
              </p>
              <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>
                TDS so far: {formatCurrency(projection.tdsDeductedSoFar)} · estimated monthly TDS ({projection.selectedRegime === 'OLD' ? 'old' : 'new'} regime): {formatCurrency(projection.estimatedMonthlyTds)}.
                Save to see the effect of changes.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function sumDeductions(r) {
  return ['standardDeduction', 'hraExemption', 'professionalTax', 'homeLoanInterest', 'chapterVIATotal']
    .reduce((sum, key) => sum + Number(r[key] || 0), 0);
}

function Row({ label, a, b, bold }) {
  const style = bold ? { fontWeight: 700 } : undefined;
  return (
    <tr style={style}>
      <td>{label}</td>
      <td className="text-end">{formatCurrency(a)}</td>
      <td className="text-end">{formatCurrency(b)}</td>
    </tr>
  );
}
