import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { axiosClient } from '../../api/axiosClient';
import { salaryStructuresApi } from '../../api/endpoints/salary';
import { employeesApi } from '../../api/endpoints/employees';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';

export const revisionsApi = {
  list: (employeeId) => axiosClient.get('/api/salary-revisions', { params: employeeId ? { employeeId } : {} }).then((res) => res.data),
  preview: (body) => axiosClient.post('/api/salary-revisions/preview', body).then((res) => res.data),
  create: (body) => axiosClient.post('/api/salary-revisions', body).then((res) => res.data),
  cancel: (id) => axiosClient.post(`/api/salary-revisions/${id}/cancel`).then((res) => res.data),
};

const TYPES = { ANNUAL_APPRAISAL: 'Annual appraisal', PROMOTION: 'Promotion', MARKET_CORRECTION: 'Market correction', ROLE_CHANGE: 'Role change', OTHER: 'Other' };
const COMPONENTS = [
  ['basicSalary', 'Basic'], ['hra', 'HRA'], ['specialAllowance', 'Special allowance'], ['medicalAllowance', 'Medical allowance'],
  ['travelAllowance', 'Travel allowance'], ['bonus', 'Bonus (monthly)'], ['incentives', 'Incentives'],
];
const STATUS = { SCHEDULED: ['Scheduled', 'info'], APPLIED: ['Applied', 'success'], CANCELLED: ['Cancelled', 'neutral'] };
const ARREARS = { PENDING: ['Arrears due', 'warning'], PAID: ['Arrears paid', 'success'], NONE: [null, null] };
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthLabel = (ym) => (ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—');
const dateLabel = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const errorText = (error, fallback) => error?.response?.data?.message || fallback;
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Payroll: revise salaries (appraisals, promotions) with automatic arrears for months already paid. */
export default function SalaryRevisions() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('SALARY_MANAGE');
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [revising, setRevising] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['salary-revisions'], queryFn: () => revisionsApi.list() });
  const cancel = useMutation({
    mutationFn: revisionsApi.cancel,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-revisions'] }); toast.success('Scheduled revision cancelled.'); },
    onError: (err) => toast.error(errorText(err, 'Could not cancel it.')),
  });
  const rows = data || [];
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Salary revisions" description="Raises, promotions and corrections - back-dated ones pay arrears automatically"
        actions={canManage && <Button icon={TrendingUp} onClick={() => setRevising(true)}>Revise salary</Button>} />
      <Card title="Revision history">
        {isLoading ? <SkeletonText lines={4} /> : rows.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No revisions yet" description="Use “Revise salary” for appraisals and promotions. If the date is in the past, the difference for months already paid is added to the next payroll." />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Employee</th><th>Type</th><th>Effective</th><th>Monthly gross</th><th className="text-end">Change</th><th>Arrears</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const [statusLabel, statusVariant] = STATUS[r.status] || [r.status, 'neutral'];
                  const [arrearsLabel, arrearsVariant] = ARREARS[r.arrearsStatus] || [];
                  const up = Number(r.incrementPercent) >= 0;
                  return (
                    <tr key={r.id}>
                      <td><div style={{ fontWeight: 700 }}>{r.employeeName}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.employeeCode}</div></td>
                      <td>{TYPES[r.revisionType] || r.revisionType}</td>
                      <td>{dateLabel(r.effectiveFrom)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{rupees(r.oldMonthlyGross)} <ArrowRight size={12} aria-hidden="true" /> <strong>{rupees(r.newMonthlyGross)}</strong></td>
                      <td className="text-end" style={{ fontWeight: 700, color: up ? 'var(--hz-success-600)' : 'var(--hz-danger-600)' }}>{up ? '+' : ''}{r.incrementPercent}%</td>
                      <td>{arrearsLabel ? <><Badge variant={arrearsVariant}>{arrearsLabel}</Badge><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{rupees(r.arrearsTotal)}{r.arrearsStatus === 'PENDING' ? ` with ${monthLabel(r.arrearsPayoutMonth)} payroll` : ''}</div></> : '—'}</td>
                      <td><Badge variant={statusVariant}>{statusLabel}</Badge></td>
                      <td className="text-end">{canManage && r.status === 'SCHEDULED' && (
                        <Button size="sm" variant="ghost" loading={cancel.isPending}
                          onClick={async () => { if (await confirm({ title: 'Cancel this scheduled revision?', description: `${r.employeeName} stays on ${rupees(r.oldMonthlyGross)} a month.`, confirmLabel: 'Cancel revision' })) cancel.mutate(r.id); }}>Cancel</Button>
                      )}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {revising && <ReviseDialog onClose={() => setRevising(false)} />}
    </div>
  );
}

function ReviseDialog({ onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [form, setForm] = useState({ revisionType: 'ANNUAL_APPRAISAL', effectiveFrom: '', reason: '', arrearsPayoutMonth: thisMonth(), percent: '' });
  const [components, setComponents] = useState(null);
  const [preview, setPreview] = useState(null);
  const { data: people } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list() });
  const current = useQuery({ queryKey: ['salary-current', employeeId], queryFn: () => salaryStructuresApi.getCurrent(employeeId), enabled: !!employeeId, retry: false });

  useEffect(() => {
    if (current.data?.components) setComponents(Object.fromEntries(COMPONENTS.map(([k]) => [k, String(current.data.components[k] ?? 0)])));
    setPreview(null);
  }, [current.data]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setPreview(null); };
  const setComponent = (k, v) => { setComponents((c) => ({ ...c, [k]: v })); setPreview(null); };
  const applyPercent = () => {
    const pct = Number(form.percent);
    if (!current.data?.components || !Number.isFinite(pct)) return;
    setComponents(Object.fromEntries(COMPONENTS.map(([k]) => [k, String(Math.round(Number(current.data.components[k] || 0) * (1 + pct / 100)))])));
    setPreview(null);
  };
  const body = () => ({
    employeeId: Number(employeeId), revisionType: form.revisionType, effectiveFrom: form.effectiveFrom, reason: form.reason,
    arrearsPayoutMonth: form.arrearsPayoutMonth, autoStatutory: current.data?.autoStatutory,
    components: { ...current.data.components, ...Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Number(v || 0)])) },
  });
  const check = useMutation({ mutationFn: () => revisionsApi.preview(body()), onSuccess: setPreview });
  const save = useMutation({
    mutationFn: () => revisionsApi.create(body()),
    onSuccess: (r) => {
      ['salary-revisions', 'salary-current', 'employee-salaries'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(r.status === 'SCHEDULED' ? `Revision scheduled for ${dateLabel(r.effectiveFrom)}.` : Number(r.arrearsTotal) > 0
        ? `Salary revised. Arrears of ${rupees(r.arrearsTotal)} will be paid with ${monthLabel(r.arrearsPayoutMonth)} payroll.` : 'Salary revised.');
      onClose();
    },
  });
  const ready = employeeId && components && form.effectiveFrom;
  return (
    <Dialog open onClose={onClose} size="xl" title="Revise salary"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!preview ? <Button disabled={!ready} loading={check.isPending} onClick={() => check.mutate()}>Preview</Button>
            : <Button loading={save.isPending} onClick={() => save.mutate()}>{preview.scheduled ? 'Schedule revision' : 'Confirm revision'}</Button>}
        </>
      )}>
      {(check.isError || save.isError) && <ErrorBanner>{errorText(check.error || save.error, 'Could not revise the salary.')}</ErrorBanner>}
      <div className="row g-3">
        <FormField col={6} as="select" label="Employee" value={employeeId} onChange={(v) => { setEmployeeId(v); setComponents(null); }}>
          <option value="">Choose…</option>
          {(people || []).map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
        </FormField>
        <FormField col={3} as="select" label="Type" value={form.revisionType} onChange={(v) => set('revisionType', v)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </FormField>
        <FormField col={3} type="date" label="Effective from" value={form.effectiveFrom} onChange={(v) => set('effectiveFrom', v)} hint="Past date = arrears; future = scheduled" />
        {employeeId && current.isError && <div className="col-12"><ErrorBanner>This employee has no salary structure yet - set one up on their salary page first.</ErrorBanner></div>}
        {components && (
          <>
            <div className="col-12 d-flex align-items-end gap-2 flex-wrap">
              <div style={{ fontSize: 14 }}>Current monthly gross <strong>{rupees(current.data.grossSalary)}</strong></div>
              <div className="ms-auto d-flex align-items-end gap-2">
                <FormField type="number" label="Raise everything by %" value={form.percent} onChange={(v) => setForm((f) => ({ ...f, percent: v }))} step="0.5" />
                <Button variant="secondary" className="mb-3" onClick={applyPercent} disabled={!form.percent}>Apply</Button>
              </div>
            </div>
            {COMPONENTS.map(([k, label]) => (
              <FormField key={k} col={3} type="number" label={`${label} (₹/month)`} value={components[k]} onChange={(v) => setComponent(k, v)} min={0}
                hint={Number(current.data.components[k] || 0) !== Number(components[k] || 0) ? `was ${rupees(current.data.components[k])}` : undefined} />
            ))}
            <FormField col={6} type="month" label="Pay any arrears with payroll for" value={form.arrearsPayoutMonth} onChange={(v) => set('arrearsPayoutMonth', v)} />
            <FormField col={6} label="Reason / note" value={form.reason} onChange={(v) => set('reason', v)} maxLength={1000} />
          </>
        )}
        {preview && (
          <div className="col-12">
            <div className="d-flex gap-4 flex-wrap p-3 mb-2" style={{ background: 'var(--hz-primary-50)', borderRadius: 12 }}>
              <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Monthly gross</div><div style={{ fontSize: 20, fontWeight: 800 }}>{rupees(preview.oldMonthlyGross)} → {rupees(preview.newMonthlyGross)}</div></div>
              <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Change</div><div style={{ fontSize: 20, fontWeight: 800, color: Number(preview.increment) >= 0 ? 'var(--hz-success-600)' : 'var(--hz-danger-600)' }}>{Number(preview.increment) >= 0 ? '+' : ''}{rupees(preview.increment)} ({preview.incrementPercent}%)</div></div>
              <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Arrears</div><div style={{ fontSize: 20, fontWeight: 800 }}>{preview.scheduled ? 'None (future date)' : rupees(preview.arrearsTotal)}</div></div>
            </div>
            {preview.arrears.length > 0 && (
              <table className="table table-sm mb-2" style={{ fontSize: 13 }}>
                <thead><tr><th>Month</th><th className="text-end">Paid</th><th className="text-end">Should have been</th><th className="text-end">Arrear</th></tr></thead>
                <tbody>{preview.arrears.map((a) => <tr key={a.period}><td>{monthLabel(a.period)}</td><td className="text-end">{rupees(a.paidGross)}</td><td className="text-end">{rupees(a.revisedGross)}</td><td className="text-end"><strong>{rupees(a.amount)}</strong></td></tr>)}</tbody>
              </table>
            )}
            {preview.notes.map((n) => <div key={n} style={{ fontSize: 13, color: 'var(--hz-warning-700)' }}>• {n}</div>)}
            <div style={{ fontSize: 12, color: 'var(--hz-text-muted)', marginTop: 6 }}>Arrears are taxable and appear as one line on the payslip. PF on arrears is not recalculated - adjust it manually if your policy requires.</div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
