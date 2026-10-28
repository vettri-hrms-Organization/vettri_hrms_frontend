import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileDown, Trash2, Save } from 'lucide-react';
import { settlementApi, formatINR } from '../../api/endpoints/settlement';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Tabs from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';

const TABS = [
  { key: 'settlements', label: 'Settlements' },
  { key: 'settings', label: 'Gratuity & notice settings' },
];

const MANUAL_CODES = {
  EARNING: [['BONUS', 'Bonus'], ['OTHER_EARNING', 'Other earning']],
  DEDUCTION: [['ADVANCE', 'Salary advance'], ['LOAN', 'Loan recovery'], ['ASSET_RECOVERY', 'Asset recovery'], ['OTHER_DEDUCTION', 'Other deduction']],
};

function errorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

/** Full & Final settlement for exiting employees: DRAFT -> REVIEWED -> APPROVED -> PAID, statement PDF. */
export default function FullAndFinal() {
  const [tab, setTab] = useState('settlements');
  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Payroll"
        title="Full & Final settlement"
        description="Final dues for exiting employees: last salary, leave encashment, gratuity, pending claims, notice recovery and TDS"
      />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'settlements' && <SettlementsPanel />}
      {tab === 'settings' && <SettlementSettingsPanel />}
    </div>
  );
}

function SettlementsPanel() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('SALARY_MANAGE');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const { data: rows = [], isLoading, isError, refetch } = useQuery({ queryKey: ['settlements'], queryFn: settlementApi.list });

  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => <><div style={{ fontWeight: 600 }}>{r.employeeName}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.employeeCode}</div></> },
    { key: 'lwd', label: 'Last working date', render: (r) => r.lastWorkingDate },
    { key: 'service', label: 'Service', render: (r) => `${r.serviceYears}y ${r.serviceMonths}m` },
    { key: 'net', label: 'Net payable', align: 'right', render: (r) => formatINR(r.netPayable) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <Card
      title="Settlements"
      actions={canManage && <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>New settlement</Button>}
    >
      <SettlementTable rows={rows} columns={columns} isLoading={isLoading} isError={isError} onRetry={refetch} onOpen={setOpenId} />
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={(s) => { setCreating(false); setOpenId(s.id); }} />}
      {openId && <SettlementDialog id={openId} canManage={canManage} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

function SettlementTable({ rows, columns, isLoading, isError, onRetry, onOpen }) {
  if (isError) return <ErrorBanner>Couldn&apos;t load settlements. <button type="button" className="btn btn-link p-0" onClick={onRetry}>Retry</button></ErrorBanner>;
  if (isLoading) return <p style={{ color: 'var(--hz-text-muted)' }}>Loading...</p>;
  if (!rows.length) return <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>No settlements yet. Mark an employee Resigned or Terminated with a last working date, then start one here.</p>;
  return (
    <div className="table-responsive">
      <table className="table mb-0 align-middle hz-table" aria-label="Settlements">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} style={{ cursor: 'pointer' }}>
              {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateDialog({ onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ employeeId: '', resignationDate: '', noticePeriodDays: '' });
  const [error, setError] = useState(null);
  const { data: eligible = [], isLoading } = useQuery({ queryKey: ['settlements-eligible'], queryFn: settlementApi.eligible });
  const create = useMutation({
    mutationFn: () => settlementApi.create({
      employeeId: Number(form.employeeId),
      resignationDate: form.resignationDate || null,
      noticePeriodDays: form.noticePeriodDays === '' ? null : Number(form.noticePeriodDays),
    }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      queryClient.invalidateQueries({ queryKey: ['settlements-eligible'] });
      onCreated(s);
    },
    onError: (err) => setError(errorMessage(err, 'Could not create the settlement')),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Full & Final settlement"
      description="Only Resigned / Terminated employees with a last working date and no open settlement are listed."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.employeeId}>Create draft</Button>
        </>
      )}
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="row g-2">
        <FormField col={12} as="select" label="Employee" value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })} required>
          <option value="">{isLoading ? 'Loading...' : eligible.length ? 'Choose an employee' : 'No exiting employees to settle'}</option>
          {eligible.map((e) => (
            <option key={e.employeeId} value={e.employeeId}>{e.employeeName} ({e.employeeCode}) - {e.status}, LWD {e.lastWorkingDate}</option>
          ))}
        </FormField>
        <FormField col={6} type="date" label="Resignation / notice date" value={form.resignationDate} onChange={(v) => setForm({ ...form, resignationDate: v })} hint="Used to work out notice served" />
        <FormField col={6} type="number" min="0" label="Notice period (days)" value={form.noticePeriodDays} onChange={(v) => setForm({ ...form, noticePeriodDays: v })} hint="Blank = company default" />
      </div>
    </Dialog>
  );
}

function SettlementDialog({ id, canManage, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState(null);
  const [manual, setManual] = useState([]);
  const [payment, setPayment] = useState({ paymentReference: '', paymentDate: '' });
  const { data: s, isLoading } = useQuery({ queryKey: ['settlement', id], queryFn: () => settlementApi.get(id) });

  useEffect(() => {
    if (!s) return;
    setInputs({
      resignationDate: s.resignationDate || '',
      lastWorkingDate: s.lastWorkingDate || '',
      noticePeriodDays: String(s.noticePeriodDays ?? ''),
      noticeWaived: s.noticeWaived,
      noticeShortfallDaysOverride: '',
      noticeRecoveryBasis: s.noticeRecoveryBasis || 'BASIC',
      deathOrDisablement: s.deathOrDisablement,
      notes: s.notes || '',
    });
    setManual(s.lines.filter((l) => l.manual).map((l) => ({ kind: l.kind, code: l.code, label: l.label, amount: String(l.amount), taxable: l.taxableAmount > 0 })));
  }, [s]);

  const refresh = (updated) => {
    queryClient.setQueryData(['settlement', id], updated);
    queryClient.invalidateQueries({ queryKey: ['settlements'] });
    setError(null);
  };
  const save = useMutation({
    mutationFn: () => settlementApi.update(id, {
      resignationDate: inputs.resignationDate || null,
      lastWorkingDate: inputs.lastWorkingDate || null,
      noticePeriodDays: inputs.noticePeriodDays === '' ? null : Number(inputs.noticePeriodDays),
      noticeWaived: inputs.noticeWaived,
      noticeShortfallDaysOverride: inputs.noticeShortfallDaysOverride === '' ? null : Number(inputs.noticeShortfallDaysOverride),
      noticeRecoveryBasis: inputs.noticeRecoveryBasis,
      deathOrDisablement: inputs.deathOrDisablement,
      notes: inputs.notes,
      manualLines: manual.filter((m) => Number(m.amount) > 0).map((m) => ({ ...m, amount: Number(m.amount) })),
    }),
    onSuccess: (u) => { refresh(u); toast.success('Settlement recalculated'); },
    onError: (err) => setError(errorMessage(err, 'Could not save the settlement')),
  });
  const transition = useMutation({
    mutationFn: ({ kind }) => {
      if (kind === 'review') return settlementApi.review(id);
      if (kind === 'reopen') return settlementApi.reopen(id);
      if (kind === 'approve') return settlementApi.approve(id);
      return settlementApi.markPaid(id, { paymentReference: payment.paymentReference, paymentDate: payment.paymentDate || null });
    },
    onSuccess: (u) => { refresh(u); toast.success(`Settlement ${u.status.toLowerCase()}`); },
    onError: (err) => setError(errorMessage(err, 'Action failed')),
  });
  const cancel = useMutation({
    mutationFn: () => settlementApi.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settlements'] }); onClose(); },
    onError: (err) => setError(errorMessage(err, 'Could not cancel')),
  });
  const draft = s?.status === 'DRAFT';
  const earnings = s?.lines.filter((l) => l.kind === 'EARNING') || [];
  const deductions = s?.lines.filter((l) => l.kind === 'DEDUCTION') || [];

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={s ? `F&F - ${s.employeeName}` : 'Settlement'}
      description={s ? `Joined ${s.dateOfJoining || '-'} - last working day ${s.lastWorkingDate} - ${s.serviceYears}y ${s.serviceMonths}m ${s.serviceDays}d of service` : undefined}
      footer={s && (
        <div className="d-flex flex-wrap gap-2 w-100 justify-content-between">
          <div className="d-flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => settlementApi.downloadStatement(id, `full-and-final-${s.employeeCode || id}.pdf`)}>Statement PDF</Button>
            {canManage && (draft || s.status === 'REVIEWED') && (
              <Button variant="ghost" icon={Trash2} onClick={() => { if (window.confirm('Cancel this settlement?')) cancel.mutate(); }}>Cancel settlement</Button>
            )}
          </div>
          {canManage && (
            <div className="d-flex gap-2 align-items-center">
              {draft && <Button variant="secondary" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save &amp; recalculate</Button>}
              {draft && <Button loading={transition.isPending} onClick={() => transition.mutate({ kind: 'review' })}>Mark reviewed</Button>}
              {s.status === 'REVIEWED' && <Button variant="secondary" onClick={() => transition.mutate({ kind: 'reopen' })}>Back to draft</Button>}
              {s.status === 'REVIEWED' && <Button loading={transition.isPending} onClick={() => transition.mutate({ kind: 'approve' })}>Approve</Button>}
              {s.status === 'APPROVED' && (
                <>
                  <input className="form-control form-control-sm" style={{ width: 170 }} placeholder="Payment ref (UTR)" aria-label="Payment reference" value={payment.paymentReference} onChange={(e) => setPayment({ ...payment, paymentReference: e.target.value })} />
                  <input className="form-control form-control-sm" style={{ width: 150 }} type="date" aria-label="Payment date" value={payment.paymentDate} onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })} />
                  <Button loading={transition.isPending} disabled={!payment.paymentReference.trim()} onClick={() => transition.mutate({ kind: 'pay' })}>Mark paid</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    >
      {isLoading || !s || !inputs ? <p>Loading...</p> : (
        <div className="d-flex flex-column gap-3">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="d-flex gap-3 align-items-center flex-wrap">
            <StatusBadge status={s.status} />
            {s.paymentReference && <span style={{ fontSize: 13 }}>Paid {s.paymentDate} - ref {s.paymentReference}</span>}
            {s.approvedBy && <span style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>Approved by {s.approvedBy}</span>}
          </div>

          {draft && canManage && (
            <div className="row g-2">
              <FormField col={3} type="date" label="Resignation date" value={inputs.resignationDate} onChange={(v) => setInputs({ ...inputs, resignationDate: v })} />
              <FormField col={3} type="date" label="Last working date" value={inputs.lastWorkingDate} onChange={(v) => setInputs({ ...inputs, lastWorkingDate: v })} />
              <FormField col={2} type="number" min="0" label="Notice (days)" value={inputs.noticePeriodDays} onChange={(v) => setInputs({ ...inputs, noticePeriodDays: v })} />
              <FormField col={2} type="number" min="0" label="Shortfall override" value={inputs.noticeShortfallDaysOverride} onChange={(v) => setInputs({ ...inputs, noticeShortfallDaysOverride: v })} hint={`Computed: ${s.noticeShortfallDays} d`} />
              <FormField col={2} as="select" label="Recovery basis" value={inputs.noticeRecoveryBasis} onChange={(v) => setInputs({ ...inputs, noticeRecoveryBasis: v })}>
                <option value="BASIC">Basic / 30</option>
                <option value="GROSS">Gross / 30</option>
              </FormField>
              <div className="col-12 d-flex gap-4" style={{ fontSize: 13 }}>
                <label className="d-inline-flex gap-2 align-items-center"><input type="checkbox" checked={inputs.noticeWaived} onChange={(e) => setInputs({ ...inputs, noticeWaived: e.target.checked })} /> Waive notice shortfall</label>
                <label className="d-inline-flex gap-2 align-items-center"><input type="checkbox" checked={inputs.deathOrDisablement} onChange={(e) => setInputs({ ...inputs, deathOrDisablement: e.target.checked })} /> Death / disablement (gratuity without 5 years)</label>
              </div>
              <ManualLines lines={manual} onChange={setManual} />
              <FormField col={12} as="textarea" rows={2} label="Notes" value={inputs.notes} onChange={(v) => setInputs({ ...inputs, notes: v })} />
            </div>
          )}

          <div className="row g-3">
            <div className="col-md-6"><LinesTable title="Earnings" lines={earnings} total={s.totalEarnings} /></div>
            <div className="col-md-6"><LinesTable title="Deductions" lines={deductions} total={s.totalDeductions} /></div>
          </div>
          <div className="d-flex justify-content-between align-items-center p-3" style={{ background: 'var(--hz-surface-2, #eef7f0)', borderRadius: 8 }}>
            <strong>{Number(s.netPayable) < 0 ? 'Net recoverable from employee' : 'Net payable'}</strong>
            <strong style={{ fontSize: 18 }}>{formatINR(Math.abs(Number(s.netPayable)))}</strong>
          </div>
          <p className="mb-0" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
            Taxable in settlement: {formatINR(s.taxableAmount)}. {s.computationNotes}
          </p>
        </div>
      )}
    </Dialog>
  );
}

function LinesTable({ title, lines, total }) {
  return (
    <div>
      <h3 style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 700 }}>{title}</h3>
      <table className="table table-sm mb-0" aria-label={title}>
        <tbody>
          {lines.length === 0 && <tr><td style={{ color: 'var(--hz-text-muted)' }}>None</td><td /></tr>}
          {lines.map((l) => (
            <tr key={l.id ?? `${l.code}-${l.label}`}>
              <td style={{ fontSize: 13 }}>{l.label}{l.manual ? ' (manual)' : ''}</td>
              <td className="text-end" style={{ fontSize: 13 }}>{formatINR(l.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Total</td>
            <td className="text-end" style={{ fontWeight: 700 }}>{formatINR(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ManualLines({ lines, onChange }) {
  const update = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <div className="col-12">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>Manual lines (bonus, advances, loans, asset recovery)</span>
        <div className="d-flex gap-2">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...lines, { kind: 'EARNING', code: 'BONUS', label: 'Bonus', amount: '', taxable: true }])}>Earning</Button>
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...lines, { kind: 'DEDUCTION', code: 'ADVANCE', label: 'Salary advance', amount: '', taxable: false }])}>Deduction</Button>
        </div>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="d-flex gap-2 mb-1 align-items-center">
          <select className="form-select form-select-sm" style={{ width: 170 }} aria-label="Line type" value={l.code}
            onChange={(e) => {
              const found = MANUAL_CODES[l.kind].find(([c]) => c === e.target.value);
              update(i, { code: e.target.value, label: found ? found[1] : l.label });
            }}>
            {MANUAL_CODES[l.kind].map(([c, label]) => <option key={c} value={c}>{label}</option>)}
          </select>
          <input className="form-control form-control-sm" aria-label="Line label" value={l.label} onChange={(e) => update(i, { label: e.target.value })} />
          <input className="form-control form-control-sm" style={{ width: 130 }} type="number" min="0" step="0.01" aria-label="Amount" value={l.amount} onChange={(e) => update(i, { amount: e.target.value })} />
          {l.kind === 'EARNING' && (
            <label className="d-inline-flex gap-1 align-items-center" style={{ fontSize: 12 }}>
              <input type="checkbox" checked={l.taxable} onChange={(e) => update(i, { taxable: e.target.checked })} /> Taxable
            </label>
          )}
          <button type="button" className="btn btn-sm btn-light border-0" aria-label="Remove line" onClick={() => onChange(lines.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function SettlementSettingsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('SALARY_MANAGE');
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const { data } = useQuery({ queryKey: ['settlement-settings'], queryFn: settlementApi.getSettings });
  useEffect(() => { if (data) setForm({ ...data, gratuityCeiling: String(data.gratuityCeiling), defaultNoticePeriodDays: String(data.defaultNoticePeriodDays) }); }, [data]);
  const save = useMutation({
    mutationFn: () => settlementApi.updateSettings({
      ...form,
      gratuityCeiling: Number(form.gratuityCeiling),
      gratuityPartialYearDays: Number(form.gratuityPartialYearDays),
      defaultNoticePeriodDays: Number(form.defaultNoticePeriodDays),
    }),
    onSuccess: (saved) => { queryClient.setQueryData(['settlement-settings'], saved); setError(null); toast.success('Settlement settings saved'); },
    onError: (err) => setError(errorMessage(err, 'Could not save settings')),
  });
  if (!form) return <Card><p className="mb-0">Loading...</p></Card>;
  return (
    <Card title="Gratuity (Payment of Gratuity Act, 1972)" subtitle="15 x last drawn basic x years / 26; the last year counts when it is more than six months; 5 years' service required">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="d-flex flex-column gap-2" style={{ fontSize: 13 }}>
        <label className="d-inline-flex gap-2 align-items-center"><input type="checkbox" disabled={!canManage} checked={form.gratuityApplicable} onChange={(e) => setForm({ ...form, gratuityApplicable: e.target.checked })} /> Company pays gratuity</label>
        <label className="d-inline-flex gap-2 align-items-center"><input type="checkbox" disabled={!canManage} checked={form.gratuityCoveredUnderAct} onChange={(e) => setForm({ ...form, gratuityCoveredUnderAct: e.target.checked })} /> Covered under the Act (10+ employees). Unticked: 15/30 per completed year, no rounding.</label>
      </div>
      <div className="row g-2 mt-1">
        <FormField col={4} type="number" min="1" label="Gratuity ceiling (₹)" value={form.gratuityCeiling} onChange={(v) => setForm({ ...form, gratuityCeiling: v })} disabled={!canManage} />
        <FormField col={4} as="select" label="4-year service rule" value={String(form.gratuityPartialYearDays)} onChange={(v) => setForm({ ...form, gratuityPartialYearDays: Number(v) })} disabled={!canManage}
          hint="Optional s.2A reading: 4 years + these days in the 5th year counts as 5 years">
          <option value="0">Off - strict 5 years</option>
          <option value="240">240 days (6-day week)</option>
          <option value="190">190 days (5-day week)</option>
        </FormField>
        <FormField col={2} type="number" min="0" label="Default notice (days)" value={form.defaultNoticePeriodDays} onChange={(v) => setForm({ ...form, defaultNoticePeriodDays: v })} disabled={!canManage} />
        <FormField col={2} as="select" label="Notice recovery" value={form.noticeRecoveryBasis} onChange={(v) => setForm({ ...form, noticeRecoveryBasis: v })} disabled={!canManage}>
          <option value="BASIC">Basic / 30</option>
          <option value="GROSS">Gross / 30</option>
        </FormField>
      </div>
      {canManage && <div className="d-flex justify-content-end mt-2"><Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button></div>}
    </Card>
  );
}
