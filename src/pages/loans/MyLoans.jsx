import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Plus } from 'lucide-react';
import { LOAN_STATUS, loanLabel, loansApi, monthLabel, rupees } from '../../api/endpoints/loans';
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
import { EmiPreview, LoanProgress, ScheduleTable } from './LoanPieces';

const errorText = (error, fallback) => error?.response?.data?.message || fallback;

/** Employee: request a loan or salary advance and follow its repayment. */
export default function MyLoans() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['my-loans'], queryFn: loansApi.mine });
  const cancel = useMutation({
    mutationFn: loansApi.cancelMine,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-loans'] }); toast.success('Request cancelled.'); },
    onError: (err) => toast.error(errorText(err, 'Could not cancel it.')),
  });
  const loans = data || [];
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="My finances" title="Loans & advances" description="Borrow against your salary and repay through monthly deductions"
        actions={<Button icon={Plus} onClick={() => setAsking(true)}>Request</Button>} />
      {isLoading ? <Card><SkeletonText lines={4} /></Card> : loans.length === 0 ? (
        <Card><EmptyState icon={HandCoins} title="No loans or advances" description="Need money before payday? Request a salary advance or a loan; it's repaid automatically from your salary." /></Card>
      ) : (
        <div className="row g-3">
          {loans.map((l) => {
            const status = LOAN_STATUS[l.status] || {};
            return (
              <div key={l.id} className="col-12 col-lg-6">
                <Card title={`${loanLabel(l.loanType)} · ${rupees(l.approvedAmount || l.requestedAmount)}`}
                  subtitle={l.emiAmount ? `${rupees(l.emiAmount)} a month · ${l.tenureMonths} months${Number(l.annualInterestRate) ? ` · ${l.annualInterestRate}% interest` : ' · interest-free'}` : `${l.requestedMonths} months requested`}
                  actions={<Badge variant={status.variant}>{status.label}</Badge>}>
                  {(l.status === 'ACTIVE' || l.status === 'CLOSED') && <LoanProgress loan={l} />}
                  {l.status === 'ACTIVE' && l.nextDueMonth && <p className="mt-2 mb-0" style={{ fontSize: 13 }}>Next deduction: <strong>{monthLabel(l.nextDueMonth)}</strong> salary</p>}
                  {l.status === 'APPROVED' && <p className="mb-0" style={{ fontSize: 13 }}>{l.disburseViaPayroll ? 'It will be paid with your next salary.' : 'Payroll will transfer the money shortly.'} Deductions start {monthLabel(l.firstDeductionMonth)}.</p>}
                  {l.reviewNote && <p className="mt-2 mb-0" style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>“{l.reviewNote}” – {l.reviewedBy}</p>}
                  <div className="d-flex gap-2 justify-content-end mt-3">
                    {l.schedule.length > 0 && <Button size="sm" variant="secondary" onClick={() => setOpen(l)}>Schedule</Button>}
                    {l.status === 'REQUESTED' && <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(l.id)}>Cancel request</Button>}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
      {asking && <RequestDialog onClose={() => setAsking(false)} />}
      {open && (
        <Dialog open onClose={() => setOpen(null)} size="lg" title={`${loanLabel(open.loanType)} schedule`} description={`${rupees(open.approvedAmount)} · ${rupees(open.totalInterest)} interest`}
          footer={<Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>}>
          <ScheduleTable schedule={open.schedule} />
        </Dialog>
      )}
    </div>
  );
}

function RequestDialog({ onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ loanType: 'ADVANCE', amount: '', months: '1', reason: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => loansApi.request({ ...form, amount: Number(form.amount), months: Number(form.months) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-loans'] }); toast.success('Request sent to payroll.'); onClose(); },
  });
  const maxMonths = form.loanType === 'ADVANCE' ? 12 : 84;
  return (
    <Dialog open onClose={onClose} size="md" title="Request a loan or advance"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!(Number(form.amount) > 0)} onClick={() => save.mutate()}>Send request</Button></>}>
      {save.isError && <ErrorBanner>{errorText(save.error, 'Could not send the request.')}</ErrorBanner>}
      <div className="row g-3">
        <FormField col={12} as="select" label="Type" value={form.loanType} onChange={(v) => set('loanType', v)}>
          <option value="ADVANCE">Salary advance (interest-free, repaid within a year)</option>
          <option value="LOAN">Loan (longer repayment; payroll sets any interest)</option>
        </FormField>
        <FormField col={6} type="number" label="Amount (₹)" value={form.amount} onChange={(v) => set('amount', v)} min={1} required />
        <FormField col={6} type="number" label="Repay over (months)" value={form.months} onChange={(v) => set('months', v)} min={1} max={maxMonths} required />
        <FormField col={12} as="textarea" rows={2} label="Reason (optional)" value={form.reason} onChange={(v) => set('reason', v)} maxLength={1000} />
        <div className="col-12"><EmiPreview amount={form.amount} months={form.months} /></div>
        <div className="col-12" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Payroll may change the amount, months or interest when approving. You'll see the final terms before anything is deducted.</div>
      </div>
    </Dialog>
  );
}
