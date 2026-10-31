import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet } from 'lucide-react';
import { fbpApi, fyLabel, rupees } from '../../api/endpoints/fbp';
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

const STATUS = { SUBMITTED: ['Waiting for HR', 'warning'], APPROVED: ['Approved', 'success'], REJECTED: ['Sent back', 'danger'] };
const errorText = (e, f) => e?.response?.data?.message || f;

/** Employee: choose flexible benefits for the year, then claim bills against what's been earned. */
export default function MyFbp() {
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['my-fbp'], queryFn: () => fbpApi.mine() });
  const store = (v) => queryClient.setQueryData(['my-fbp'], v);
  if (isLoading || !data) return <div className="hz-module-page"><Card><SkeletonText lines={5} /></Card></div>;
  const d = data.declaration;
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="My finances" title="Flexible benefits" description={`Save tax by moving part of your special allowance into bills you'd pay anyway - ${fyLabel(data.financialYear)}`}
        actions={d?.status === 'APPROVED' && <Button icon={Plus} onClick={() => setClaiming(true)}>Claim a bill</Button>} />
      {data.components.length === 0 ? (
        <Card><EmptyState icon={Wallet} title="Flexible benefits aren't set up" description="Your company hasn't turned on flexible benefits yet." /></Card>
      ) : !d || d.status === 'REJECTED' ? (
        <DeclareCard view={data} onDone={store} previous={d} />
      ) : (
        <Card title={`Your plan · ${rupees(d.monthlyTotal)} a month`} subtitle={d.status === 'APPROVED' ? `Started with ${d.startMonth} payroll · ${d.monthsEarned} month${d.monthsEarned === 1 ? '' : 's'} earned so far` : 'HR will review it shortly'}
          actions={<Badge variant={STATUS[d.status][1]}>{STATUS[d.status][0]}</Badge>}>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
              <thead><tr><th>Benefit</th><th className="text-end">Per year</th><th className="text-end">Earned</th><th className="text-end">Claimed</th><th className="text-end">Can claim now</th></tr></thead>
              <tbody>{d.lines.map((l) => (
                <tr key={l.componentId}><td><strong>{l.name}</strong></td><td className="text-end">{rupees(l.annualAmount)}</td><td className="text-end">{rupees(l.earned)}</td><td className="text-end">{rupees(l.claimed)}</td><td className="text-end"><strong>{rupees(l.available)}</strong></td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2 mb-0" style={{ fontSize: 12.5, color: 'var(--hz-text-muted)' }}>Approved claims are paid tax-free with your next salary. Anything you don't claim by March is paid with March salary as taxable.</p>
        </Card>
      )}
      {data.claims.length > 0 && (
        <Card title="Your claims">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
              <thead><tr><th>Bill date</th><th>Benefit</th><th>Bill no.</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
              <tbody>{data.claims.map((c) => (
                <tr key={c.id}><td>{c.billDate}</td><td>{c.componentName}</td><td>{c.billReference || '—'}</td><td className="text-end">{rupees(c.amount)}</td>
                  <td><Badge variant={c.paid ? 'success' : STATUS[c.status][1]}>{c.paid ? 'Paid' : STATUS[c.status][0]}</Badge>{c.reviewNote && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{c.reviewNote}</div>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
      {claiming && <ClaimDialog lines={d.lines} onClose={() => setClaiming(false)} onDone={store} />}
    </div>
  );
}

function DeclareCard({ view, onDone, previous }) {
  const toast = useToast();
  const [amounts, setAmounts] = useState({});
  const monthly = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0) / 12, 0);
  const over = monthly > Number(view.monthlySpecialAllowance);
  const save = useMutation({
    mutationFn: () => fbpApi.declare({ financialYear: view.financialYear, lines: Object.entries(amounts).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ componentId: Number(id), annualAmount: Number(v) })) }),
    onSuccess: (v) => { onDone(v); toast.success('Sent to HR for approval.'); },
  });
  return (
    <Card title={`Choose your benefits for ${fyLabel(view.financialYear)}`} subtitle={`These come out of your special allowance (${rupees(view.monthlySpecialAllowance)} a month). Pick what you'll actually spend on - you claim it back with bills, tax-free.`}>
      {previous?.status === 'REJECTED' && <ErrorBanner>HR sent your last plan back: {previous.reviewNote}</ErrorBanner>}
      {save.isError && <ErrorBanner>{errorText(save.error, 'Could not save your plan.')}</ErrorBanner>}
      <div className="row g-3">
        {view.components.map((c) => (
          <FormField key={c.id} col={6} type="number" label={`${c.name} - per year (up to ${rupees(c.annualLimit)})`} value={amounts[c.id] || ''} min={0} max={c.annualLimit}
            hint={c.description} onChange={(v) => setAmounts((a) => ({ ...a, [c.id]: v }))} />
        ))}
      </div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2">
        <div style={{ fontSize: 14, color: over ? 'var(--hz-danger-600)' : undefined }}>That's <strong>{rupees(Math.round(monthly * 100) / 100)}</strong> a month{over ? ' - more than your special allowance' : ''}</div>
        <Button loading={save.isPending} disabled={monthly <= 0 || over} onClick={() => save.mutate()}>Submit plan</Button>
      </div>
    </Card>
  );
}

function ClaimDialog({ lines, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ componentId: String(lines[0]?.componentId || ''), billDate: new Date().toISOString().slice(0, 10), billReference: '', description: '', amount: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const line = lines.find((l) => String(l.componentId) === form.componentId);
  const save = useMutation({
    mutationFn: () => fbpApi.claim({ ...form, componentId: Number(form.componentId), amount: Number(form.amount) }),
    onSuccess: (v) => { onDone(v); toast.success('Claim sent to HR.'); onClose(); },
  });
  return (
    <Dialog open onClose={onClose} title="Claim a bill" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!(Number(form.amount) > 0)} onClick={() => save.mutate()}>Submit claim</Button></>}>
      {save.isError && <ErrorBanner>{errorText(save.error, 'Could not submit the claim.')}</ErrorBanner>}
      <div className="row g-3">
        <FormField col={12} as="select" label="Benefit" value={form.componentId} onChange={(v) => set('componentId', v)}>
          {lines.map((l) => <option key={l.componentId} value={l.componentId}>{l.name} ({rupees(l.available)} available)</option>)}
        </FormField>
        <FormField col={6} type="date" label="Bill date" value={form.billDate} onChange={(v) => set('billDate', v)} />
        <FormField col={6} type="number" label="Amount ₹" value={form.amount} onChange={(v) => set('amount', v)} min={1} max={line?.available} />
        <FormField col={12} label="Bill / invoice number" value={form.billReference} onChange={(v) => set('billReference', v)} maxLength={100} />
        <FormField col={12} label="What it was for" value={form.description} onChange={(v) => set('description', v)} maxLength={500} />
        <div className="col-12" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Keep the original bill - HR may ask to see it.</div>
      </div>
    </Dialog>
  );
}
