import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Plus } from 'lucide-react';
import { LOAN_STATUS, loanLabel, loansApi, monthLabel, nextMonth, rupees } from '../../api/endpoints/loans';
import { employeesApi } from '../../api/endpoints/employees';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import DataTable from '../../components/ui/DataTable';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { EmiPreview, LoanProgress, ScheduleTable } from './LoanPieces';

const errorText = (error, fallback) => error?.response?.data?.message || fallback;
const loanAmount = (l) => l.approvedAmount || l.requestedAmount;

function loanColumns(onOpen) {
  return [
    {
      key: 'employee', label: 'Employee', hideable: false,
      value: (l) => [l.employeeName, l.employeeCode].filter(Boolean).join(' '),
      exportValue: (l) => l.employeeName,
      render: (l) => <><div style={{ fontWeight: 700 }}>{l.employeeName}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{l.employeeCode}</div></>,
    },
    { key: 'employeeCode', label: 'Employee code', defaultHidden: true },
    { key: 'loanType', label: 'Type', value: (l) => loanLabel(l.loanType) },
    { key: 'amount', label: 'Amount', className: 'text-end', headerClassName: 'text-end', value: loanAmount, searchable: false, render: (l) => <strong>{rupees(loanAmount(l))}</strong> },
    { key: 'emi', label: 'EMI', value: (l) => l.emiAmount, searchable: false, render: (l) => (l.emiAmount ? `${rupees(l.emiAmount)} × ${l.tenureMonths}` : `${l.requestedMonths} months asked`) },
    { key: 'repayment', label: 'Repayment', sortable: false, searchable: false, export: false, style: { minWidth: 180 }, render: (l) => (l.status === 'ACTIVE' || l.status === 'CLOSED' ? <LoanProgress loan={l} /> : '—') },
    {
      key: 'status', label: 'Status', value: (l) => LOAN_STATUS[l.status]?.label || l.status,
      render: (l) => { const status = LOAN_STATUS[l.status] || {}; return <Badge variant={status.variant}>{status.label}</Badge>; },
    },
    {
      key: 'actions', label: '', className: 'text-end', hideable: false, sortable: false, searchable: false, export: false,
      render: (l) => <Button size="sm" variant={l.status === 'REQUESTED' ? 'primary' : 'secondary'} onClick={() => onOpen(l.id)}>{l.status === 'REQUESTED' ? 'Review' : 'Open'}</Button>,
    },
  ];
}

const FILTERS = [['OPEN', 'Requests & running'], ['REQUESTED', 'Waiting for approval'], ['ACTIVE', 'Repaying'], ['', 'All']];

/** Payroll admins: approve requests, pay out, and manage repayment of every loan and advance. */
export default function LoansAdmin() {
  const [filter, setFilter] = useState('OPEN');
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['loans', filter], queryFn: () => loansApi.list(filter) });
  const loans = data || [];
  const outstanding = loans.filter((l) => l.status === 'ACTIVE').reduce((s, l) => s + Number(l.outstanding || 0), 0);
  const waiting = loans.filter((l) => l.status === 'REQUESTED').length;
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Loans & advances" description="Requests, pay-outs and EMI recovery through payroll"
        actions={<Button icon={Plus} onClick={() => setAdding(true)}>Add loan</Button>} />
      <div className="row g-3">
        {[['Waiting for approval', waiting], ['Outstanding (repaying)', rupees(outstanding)]].map(([label, value]) => (
          <div key={label} className="col-6 col-lg-3">
            <div className="h-100 p-3" style={{ background: 'var(--hz-bg-surface)', border: '1px solid var(--hz-border)', borderRadius: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--hz-text-muted)', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--hz-text-primary)' }}>{value}</div>
            </div>
          </div>
        ))}
      </div>
      <Card title="Loans" actions={(
        <div className="btn-group flex-wrap" role="group" aria-label="Filter">
          {FILTERS.map(([key, label]) => <button key={key || 'all'} type="button" className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
      )}>
        <DataTable
          columns={loanColumns(setOpen)}
          rows={loans}
          isLoading={isLoading}
          ariaLabel="Loans"
          storageKey="loans"
          searchPlaceholder="Search employee or loan type"
          exportFileName={`loans-${(filter || 'all').toLowerCase()}`}
          emptyIcon={HandCoins}
          emptyTitle="Nothing here"
          emptyDescription="Employees request loans and advances from My Finances; you can also add one directly."
        />
      </Card>
      {open && <LoanDialog id={open} onClose={() => setOpen(null)} />}
      {adding && <AddLoanDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => ['loans', 'loan', 'approvals-inbox'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
}

function LoanDialog({ id, onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  const { data: loan, isLoading } = useQuery({ queryKey: ['loan', id], queryFn: () => loansApi.get(id) });
  const [terms, setTerms] = useState(null);
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState({ amount: '', paidOn: '' });
  const [disbursal, setDisbursal] = useState({ disbursedOn: '', reference: '' });
  const store = (result) => { queryClient.setQueryData(['loan', id], result); refresh(); };
  const onError = (err) => toast.error(errorText(err, 'Could not save.'));
  const approve = useMutation({ mutationFn: () => loansApi.approve(id, { ...current, amount: Number(current.amount), months: Number(current.months), annualInterestRate: Number(current.annualInterestRate || 0), note }), onSuccess: (r) => { store(r); toast.success('Approved. The employee has been told.'); }, onError });
  const reject = useMutation({ mutationFn: () => loansApi.reject(id, note), onSuccess: (r) => { store(r); toast.success('Request declined.'); }, onError });
  const disburse = useMutation({ mutationFn: () => loansApi.disburse(id, { disbursedOn: disbursal.disbursedOn || null, reference: disbursal.reference }), onSuccess: (r) => { store(r); toast.success('Marked as paid out. EMIs will start as scheduled.'); }, onError });
  const pay = useMutation({ mutationFn: () => loansApi.payment(id, { amount: Number(payment.amount), paidOn: payment.paidOn || null }), onSuccess: (r) => { store(r); setPayment({ amount: '', paidOn: '' }); toast.success('Repayment recorded.'); }, onError });
  const defer = useMutation({ mutationFn: (installmentId) => loansApi.defer(id, installmentId), onSuccess: (r) => { store(r); toast.success('EMI moved to the end of the schedule.'); }, onError });
  const cancel = useMutation({ mutationFn: () => loansApi.cancel(id, note), onSuccess: (r) => { store(r); toast.success('Loan cancelled.'); }, onError });
  if (isLoading || !loan) return <Dialog open onClose={onClose} title="Loan"><SkeletonText lines={4} /></Dialog>;
  const current = terms || { amount: String(loan.requestedAmount), months: String(loan.requestedMonths), annualInterestRate: '0', firstDeductionMonth: nextMonth(), disburseViaPayroll: true };
  const setTerm = (k, v) => setTerms({ ...current, [k]: v });
  const status = LOAN_STATUS[loan.status] || {};
  return (
    <Dialog open onClose={onClose} size="lg" title={`${loan.employeeName} · ${loanLabel(loan.loanType)}`} description={`${status.label} · requested ${rupees(loan.requestedAmount)} over ${loan.requestedMonths} months`}
      footer={loan.status === 'REQUESTED' ? (
        <>
          <Button variant="secondary" disabled={!note.trim()} loading={reject.isPending} onClick={() => reject.mutate()}>Decline</Button>
          <Button loading={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
        </>
      ) : loan.status === 'APPROVED' ? (
        <>
          <Button variant="ghost" loading={cancel.isPending} onClick={async () => { if (await confirm({ title: 'Cancel this loan?', description: 'Nothing has been paid out yet, so no EMIs will be deducted.', confirmLabel: 'Cancel loan' })) cancel.mutate(); }}>Cancel loan</Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {loan.reason && <p style={{ fontSize: 14 }}><strong>Reason:</strong> {loan.reason}</p>}
      {loan.status === 'REQUESTED' && (
        <div className="row g-3">
          <FormField col={4} type="number" label="Amount (₹)" value={current.amount} onChange={(v) => setTerm('amount', v)} min={1} />
          <FormField col={4} type="number" label="Months" value={current.months} onChange={(v) => setTerm('months', v)} min={1} />
          {loan.loanType === 'LOAN' && <FormField col={4} type="number" label="Interest (% a year)" value={current.annualInterestRate} onChange={(v) => setTerm('annualInterestRate', v)} min={0} max={36} step="0.1" />}
          <FormField col={6} type="month" label="First EMI with salary of" value={current.firstDeductionMonth} onChange={(v) => setTerm('firstDeductionMonth', v)} />
          <div className="col-12 col-md-6 d-flex align-items-center">
            <label className="form-check d-inline-flex align-items-center gap-2 mb-3"><input type="checkbox" className="form-check-input m-0" checked={current.disburseViaPayroll} onChange={(e) => setTerm('disburseViaPayroll', e.target.checked)} /> Pay out with the next payroll run</label>
          </div>
          <div className="col-12"><EmiPreview amount={current.amount} months={current.months} rate={loan.loanType === 'LOAN' ? current.annualInterestRate : 0} firstMonth={current.firstDeductionMonth} /></div>
          <FormField col={12} label="Note for the employee (required to decline)" value={note} onChange={setNote} maxLength={1000} />
        </div>
      )}
      {loan.status !== 'REQUESTED' && loan.schedule.length > 0 && (
        <>
          <div className="d-flex gap-4 flex-wrap mb-3" style={{ fontSize: 14 }}>
            <div><span style={{ color: 'var(--hz-text-muted)' }}>Approved</span><div style={{ fontWeight: 800 }}>{rupees(loan.approvedAmount)}</div></div>
            <div><span style={{ color: 'var(--hz-text-muted)' }}>EMI</span><div style={{ fontWeight: 800 }}>{rupees(loan.emiAmount)} × {loan.tenureMonths}</div></div>
            <div><span style={{ color: 'var(--hz-text-muted)' }}>Interest</span><div style={{ fontWeight: 800 }}>{Number(loan.annualInterestRate) ? `${loan.annualInterestRate}% · ${rupees(loan.totalInterest)}` : 'None'}</div></div>
            <div><span style={{ color: 'var(--hz-text-muted)' }}>Paid out</span><div style={{ fontWeight: 800 }}>{loan.disbursedOn ? `${loan.disbursedOn}${loan.disbursementReference ? ` · ${loan.disbursementReference}` : ''}` : loan.disburseViaPayroll ? 'With next payroll' : 'Not yet'}</div></div>
          </div>
          {(loan.status === 'ACTIVE' || loan.status === 'CLOSED') && <div className="mb-3"><LoanProgress loan={loan} /></div>}
          {loan.status === 'APPROVED' && !loan.disburseViaPayroll && (
            <div className="row g-2 align-items-end mb-3 p-2" style={{ background: 'var(--hz-info-50)', borderRadius: 12 }}>
              <FormField col={4} type="date" label="Paid out on" value={disbursal.disbursedOn} onChange={(v) => setDisbursal((d) => ({ ...d, disbursedOn: v }))} />
              <FormField col={5} label="Bank reference (UTR/cheque)" value={disbursal.reference} onChange={(v) => setDisbursal((d) => ({ ...d, reference: v }))} maxLength={100} />
              <div className="col-12 col-md-3 mb-3"><Button loading={disburse.isPending} onClick={() => disburse.mutate()}>Mark paid out</Button></div>
            </div>
          )}
          <ScheduleTable schedule={loan.schedule} renderAction={['APPROVED', 'ACTIVE'].includes(loan.status) ? (i) => i.status === 'PENDING' && (
            <button type="button" className="btn btn-link btn-sm p-0" disabled={defer.isPending} onClick={async () => {
              if (await confirm({ title: `Defer the ${monthLabel(i.dueMonth)} EMI?`, description: 'Nothing is deducted that month; the EMI moves to the end of the schedule.', confirmLabel: 'Defer', variant: 'primary' })) defer.mutate(i.id);
            }}>Defer</button>
          ) : null} />
          {loan.status === 'ACTIVE' && (
            <div className="row g-2 align-items-end mt-3">
              <div className="col-12" style={{ fontWeight: 700, fontSize: 14 }}>Record a repayment made outside payroll</div>
              <FormField col={4} type="number" label="Amount (₹)" value={payment.amount} onChange={(v) => setPayment((p) => ({ ...p, amount: v }))} min={1} hint={`Outstanding ${rupees(loan.outstanding)} - enter it all to close the loan`} />
              <FormField col={4} type="date" label="Paid on" value={payment.paidOn} onChange={(v) => setPayment((p) => ({ ...p, paidOn: v }))} />
              <div className="col-12 col-md-4 mb-3"><Button variant="secondary" loading={pay.isPending} disabled={!(Number(payment.amount) > 0)} onClick={() => pay.mutate()}>Record repayment</Button></div>
            </div>
          )}
        </>
      )}
      {loan.reviewNote && loan.status !== 'REQUESTED' && <p className="mt-3 mb-0" style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>Note: {loan.reviewNote} – {loan.reviewedBy}</p>}
    </Dialog>
  );
}

function AddLoanDialog({ onClose }) {
  const toast = useToast();
  const refresh = useRefresh();
  const { data: people } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list() });
  const [form, setForm] = useState({ employeeId: '', loanType: 'LOAN', amount: '', months: '12', annualInterestRate: '0', firstDeductionMonth: nextMonth(), disburseViaPayroll: false, reason: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => loansApi.create({ ...form, employeeId: Number(form.employeeId), amount: Number(form.amount), months: Number(form.months), annualInterestRate: Number(form.annualInterestRate || 0) }),
    onSuccess: () => { refresh(); toast.success('Loan added. The employee has been told.'); onClose(); },
  });
  return (
    <Dialog open onClose={onClose} size="lg" title="Add a loan or advance"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!form.employeeId || !(Number(form.amount) > 0)} onClick={() => save.mutate()}>Add loan</Button></>}>
      {save.isError && <ErrorBanner>{errorText(save.error, 'Could not add the loan.')}</ErrorBanner>}
      <div className="row g-3">
        <FormField col={8} as="select" label="Employee" value={form.employeeId} onChange={(v) => set('employeeId', v)} required>
          <option value="">Choose…</option>
          {(people || []).map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
        </FormField>
        <FormField col={4} as="select" label="Type" value={form.loanType} onChange={(v) => set('loanType', v)}>
          <option value="LOAN">Loan</option><option value="ADVANCE">Salary advance</option>
        </FormField>
        <FormField col={4} type="number" label="Amount (₹)" value={form.amount} onChange={(v) => set('amount', v)} min={1} />
        <FormField col={4} type="number" label="Months" value={form.months} onChange={(v) => set('months', v)} min={1} />
        {form.loanType === 'LOAN' && <FormField col={4} type="number" label="Interest (% a year)" value={form.annualInterestRate} onChange={(v) => set('annualInterestRate', v)} min={0} max={36} step="0.1" />}
        <FormField col={6} type="month" label="First EMI with salary of" value={form.firstDeductionMonth} onChange={(v) => set('firstDeductionMonth', v)} />
        <div className="col-12 col-md-6 d-flex align-items-center">
          <label className="form-check d-inline-flex align-items-center gap-2 mb-3"><input type="checkbox" className="form-check-input m-0" checked={form.disburseViaPayroll} onChange={(e) => set('disburseViaPayroll', e.target.checked)} /> Pay out with the next payroll run</label>
        </div>
        <FormField col={12} label="Reason / reference" value={form.reason} onChange={(v) => set('reason', v)} maxLength={1000} />
        <div className="col-12"><EmiPreview amount={form.amount} months={form.months} rate={form.loanType === 'LOAN' ? form.annualInterestRate : 0} firstMonth={form.firstDeductionMonth} /></div>
      </div>
    </Dialog>
  );
}
