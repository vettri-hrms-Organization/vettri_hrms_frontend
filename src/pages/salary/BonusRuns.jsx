import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus } from 'lucide-react';
import { axiosClient } from '../../api/axiosClient';
import { departmentsApi } from '../../api/endpoints/organization';
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
import { exportToCsv } from '../../utils/exportToCsv';

const bonusApi = {
  list: () => axiosClient.get('/api/salary/bonuses').then((res) => res.data),
  get: (id) => axiosClient.get(`/api/salary/bonuses/${id}`).then((res) => res.data),
  create: (body) => axiosClient.post('/api/salary/bonuses', body).then((res) => res.data),
  updateLine: (id, lineId, body) => axiosClient.put(`/api/salary/bonuses/${id}/lines/${lineId}`, body).then((res) => res.data),
  approve: (id) => axiosClient.post(`/api/salary/bonuses/${id}/approve`).then((res) => res.data),
  cancel: (id) => axiosClient.post(`/api/salary/bonuses/${id}/cancel`).then((res) => res.data),
};

const TYPES = { FESTIVAL: 'Festival', PERFORMANCE: 'Performance', ONE_TIME: 'One-time', STATUTORY: 'Statutory (Bonus Act)' };
const METHODS = { FIXED: 'Fixed amount per person', PERCENT_BASIC: '% of monthly basic', PERCENT_GROSS: '% of monthly gross' };
const STATUS = { DRAFT: ['Draft', 'neutral'], APPROVED: ['Approved', 'info'], PAID: ['Paid', 'success'], CANCELLED: ['Cancelled', 'neutral'] };
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthLabel = (ym) => (ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—');
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const lastFy = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() - 1 : d.getFullYear() - 2; };
const errorText = (error, fallback) => error?.response?.data?.message || fallback;
const describe = (b) => (b.method === 'FIXED' ? `${rupees(b.value)} each` : b.method === 'STATUTORY'
  ? `${b.value}% of FY ${b.financialYear}-${String(b.financialYear + 1).slice(2)} wages` : `${b.value}% of monthly ${b.method === 'PERCENT_BASIC' ? 'basic' : 'gross'}`);

/** Payroll: pay a bonus to many employees at once through payroll. */
export default function BonusRuns() {
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['bonuses'], queryFn: bonusApi.list });
  const rows = data || [];
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Bonuses" description="Festival, performance and statutory bonuses - approved here, paid with payroll"
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New bonus</Button>} />
      <Card title="Bonus runs">
        {isLoading ? <SkeletonText lines={4} /> : rows.length === 0 ? (
          <EmptyState icon={Gift} title="No bonuses yet" description="Create a bonus for everyone, a department or chosen people. Review the amounts, approve, and it's paid with the payroll month you pick." />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Bonus</th><th>How</th><th>Paid with</th><th className="text-end">Employees</th><th className="text-end">Total</th><th>Status</th><th aria-label="Open" /></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const [label, variant] = STATUS[b.status] || [b.status, 'neutral'];
                  return (
                    <tr key={b.id}>
                      <td><div style={{ fontWeight: 700 }}>{b.name}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{TYPES[b.bonusType] || b.bonusType}{b.taxable ? '' : ' · non-taxable'}</div></td>
                      <td>{describe(b)}</td>
                      <td>{monthLabel(b.payoutMonth)} payroll</td>
                      <td className="text-end">{b.employees}{b.status === 'APPROVED' && b.paidCount > 0 ? ` (${b.paidCount} paid)` : ''}</td>
                      <td className="text-end"><strong>{rupees(b.total)}</strong></td>
                      <td><Badge variant={variant}>{label}</Badge></td>
                      <td className="text-end"><Button size="sm" variant={b.status === 'DRAFT' ? 'primary' : 'secondary'} onClick={() => setOpen(b.id)}>{b.status === 'DRAFT' ? 'Review' : 'Open'}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpen(id); }} />}
      {open && <BatchDialog id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CreateDialog({ onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', bonusType: 'FESTIVAL', method: 'FIXED', value: '', financialYear: String(lastFy()), wageCeiling: '7000', payoutMonth: thisMonth(), taxable: true, scope: 'ALL', departmentId: '', employeeIds: new Set(), note: '' });
  const [search, setSearch] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const statutory = form.bonusType === 'STATUTORY';
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list, enabled: form.scope === 'DEPARTMENT' });
  const people = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list(), enabled: form.scope === 'SELECTED' });
  const save = useMutation({
    mutationFn: () => bonusApi.create({
      ...form, method: statutory ? 'STATUTORY' : form.method, value: form.value === '' ? null : Number(form.value),
      financialYear: statutory ? Number(form.financialYear) : null, wageCeiling: statutory ? Number(form.wageCeiling) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null, employeeIds: [...form.employeeIds],
    }),
    onSuccess: (b) => { queryClient.invalidateQueries({ queryKey: ['bonuses'] }); onCreated(b.id); },
  });
  const toggle = (id) => setForm((f) => { const s = new Set(f.employeeIds); if (s.has(id)) s.delete(id); else s.add(id); return { ...f, employeeIds: s }; });
  return (
    <Dialog open onClose={onClose} size="lg" title="New bonus"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>Calculate amounts</Button></>}>
      {save.isError && <ErrorBanner>{errorText(save.error, 'Could not create the bonus.')}</ErrorBanner>}
      <div className="row g-3">
        <FormField col={8} label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Diwali bonus 2026" maxLength={120} required />
        <FormField col={4} as="select" label="Type" value={form.bonusType} onChange={(v) => set('bonusType', v)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </FormField>
        {statutory ? (
          <>
            <FormField col={4} type="number" label="Bonus rate %" value={form.value} onChange={(v) => set('value', v)} placeholder="8.33" min={8.33} max={20} step="0.01" hint="8.33% minimum, 20% maximum" />
            <FormField col={4} as="select" label="For financial year" value={form.financialYear} onChange={(v) => set('financialYear', v)}>
              {[0, 1, 2].map((k) => { const y = lastFy() + 1 - k; return <option key={y} value={y}>{`FY ${y}-${String(y + 1).slice(2)}`}</option>; })}
            </FormField>
            <FormField col={4} type="number" label="Monthly wage ceiling ₹" value={form.wageCeiling} onChange={(v) => set('wageCeiling', v)} hint="₹7,000 or your state's minimum wage, if higher" />
            <div className="col-12" style={{ fontSize: 12.5, color: 'var(--hz-text-muted)' }}>Covers employees with basic up to ₹21,000 who worked at least 30 days in the year. Calculated from processed payroll in that year.</div>
          </>
        ) : (
          <>
            <FormField col={6} as="select" label="Amount" value={form.method} onChange={(v) => set('method', v)}>
              {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </FormField>
            <FormField col={6} type="number" label={form.method === 'FIXED' ? 'Amount per person ₹' : 'Percentage %'} value={form.value} onChange={(v) => set('value', v)} min={0} />
          </>
        )}
        <FormField col={6} type="month" label="Pay with payroll for" value={form.payoutMonth} onChange={(v) => set('payoutMonth', v)} />
        <div className="col-12 col-md-6 d-flex align-items-center">
          <label className="form-check d-inline-flex align-items-center gap-2 mb-3"><input type="checkbox" className="form-check-input m-0" checked={form.taxable} onChange={(e) => set('taxable', e.target.checked)} /> Taxable (counts for TDS)</label>
        </div>
        <FormField col={6} as="select" label="Who gets it" value={form.scope} onChange={(v) => set('scope', v)}>
          <option value="ALL">All active employees</option>
          <option value="DEPARTMENT">One department</option>
          <option value="SELECTED">Chosen employees</option>
        </FormField>
        {form.scope === 'DEPARTMENT' && (
          <FormField col={6} as="select" label="Department" value={form.departmentId} onChange={(v) => set('departmentId', v)}>
            <option value="">Choose…</option>
            {(departments.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </FormField>
        )}
        {form.scope === 'SELECTED' && (
          <div className="col-12">
            <input className="form-control form-control-sm mb-2" placeholder="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search employees" />
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--hz-border)', borderRadius: 8 }}>
              {(people.data || []).filter((e) => !search || `${e.fullName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase())).map((e) => (
                <label key={e.id} className="d-flex align-items-center gap-2 px-2 py-1" style={{ fontSize: 13 }}>
                  <input type="checkbox" className="form-check-input m-0" checked={form.employeeIds.has(e.id)} onChange={() => toggle(e.id)} /> {e.fullName} <span style={{ color: 'var(--hz-text-muted)' }}>{e.employeeCode}</span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--hz-text-muted)', marginTop: 4 }}>{form.employeeIds.size} selected</div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function BatchDialog({ id, onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: b, isLoading } = useQuery({ queryKey: ['bonus', id], queryFn: () => bonusApi.get(id) });
  const store = (result) => { queryClient.setQueryData(['bonus', id], result); queryClient.invalidateQueries({ queryKey: ['bonuses'] }); };
  const onError = (err) => toast.error(errorText(err, 'Could not save.'));
  const updateLine = useMutation({ mutationFn: ({ lineId, amount }) => bonusApi.updateLine(id, lineId, { amount }), onSuccess: store, onError });
  const approve = useMutation({ mutationFn: () => bonusApi.approve(id), onSuccess: (r) => { store(r); toast.success(`Approved. It will be paid with ${monthLabel(r.payoutMonth)} payroll.`); }, onError });
  const cancel = useMutation({ mutationFn: () => bonusApi.cancel(id), onSuccess: (r) => { store(r); toast.success('Bonus cancelled.'); }, onError });
  if (isLoading || !b) return <Dialog open onClose={onClose} title="Bonus"><SkeletonText lines={4} /></Dialog>;
  const [label, variant] = STATUS[b.status] || [b.status, 'neutral'];
  const draft = b.status === 'DRAFT';
  return (
    <Dialog open onClose={onClose} size="xl" title={b.name} description={`${describe(b)} · ${monthLabel(b.payoutMonth)} payroll · ${b.employees} employees · ${rupees(b.total)}`}
      footer={(
        <>
          {(draft || b.status === 'APPROVED') && b.paidCount === 0 && (
            <Button variant="ghost" loading={cancel.isPending} onClick={async () => { if (await confirm({ title: 'Cancel this bonus?', description: 'Nobody will be paid from it.', confirmLabel: 'Cancel bonus' })) cancel.mutate(); }}>Cancel bonus</Button>
          )}
          <Button variant="secondary" disabled={!b.lines.length} onClick={() => exportToCsv(`${b.name}.csv`, b.lines.map((l) => ({ Employee: l.employeeName, Code: l.employeeCode, Department: l.departmentName || '', Basis: l.basisAmount ?? '', Amount: l.amount, Paid: l.settled ? 'Yes' : 'No' })))}>Export</Button>
          {draft && <Button loading={approve.isPending} onClick={async () => { if (await confirm({ title: `Approve ${rupees(b.total)} for ${b.employees} employees?`, description: `Each person is told, and the bonus is added to ${monthLabel(b.payoutMonth)} payroll. Amounts can't change after this.`, confirmLabel: 'Approve', variant: 'primary' })) approve.mutate(); }}>Approve</Button>}
        </>
      )}>
      <div className="mb-2"><Badge variant={variant}>{label}</Badge>{b.approvedByName && <span className="ms-2" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>approved by {b.approvedByName}</span>}</div>
      {b.skipped?.length > 0 && (
        <div className="p-2 mb-2" style={{ fontSize: 13, background: 'var(--hz-warning-50)', borderRadius: 10 }}>
          <strong>Not included:</strong> {b.skipped.join('; ')}
        </div>
      )}
      {draft && <div className="mb-2" style={{ fontSize: 12.5, color: 'var(--hz-text-muted)' }}>Change any amount below (0 leaves that person out), then approve.</div>}
      <div className="table-responsive" style={{ maxHeight: 420 }}>
        <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
          <thead><tr><th>Employee</th><th>Department</th>{b.method !== 'FIXED' && <th className="text-end">{b.method === 'STATUTORY' ? 'Eligible wages' : 'Monthly basis'}</th>}<th className="text-end">Bonus</th><th>Paid</th></tr></thead>
          <tbody>
            {b.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.employeeName} <span style={{ color: 'var(--hz-text-muted)' }}>{l.employeeCode}</span></td>
                <td>{l.departmentName || '—'}</td>
                {b.method !== 'FIXED' && <td className="text-end">{l.basisAmount != null ? rupees(l.basisAmount) : '—'}</td>}
                <td className="text-end">
                  {draft ? (
                    <input type="number" min={0} className="form-control form-control-sm text-end d-inline-block" style={{ width: 120 }} defaultValue={l.amount}
                      aria-label={`Bonus for ${l.employeeName}`}
                      onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== Number(l.amount)) updateLine.mutate({ lineId: l.id, amount: v }); }} />
                  ) : <strong>{rupees(l.amount)}</strong>}
                </td>
                <td>{l.settled ? <Badge variant="success">Paid</Badge> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
