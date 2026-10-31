import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Wallet } from 'lucide-react';
import { fbpApi, fyLabel, rupees } from '../../api/endpoints/fbp';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import Tabs from '../../components/ui/Tabs';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const errorText = (e, f) => e?.response?.data?.message || f;
const STATUS = { SUBMITTED: ['Waiting', 'warning'], APPROVED: ['Approved', 'success'], REJECTED: ['Sent back', 'danger'] };

/** Payroll admins: FBP components, employee plans and bill claims. */
export default function FbpAdmin() {
  const [tab, setTab] = useState('claims');
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Flexible benefits (FBP)" description="Tax-free benefits employees fund from special allowance and claim back with bills" />
      <Tabs items={[{ key: 'claims', label: 'Claims' }, { key: 'plans', label: 'Employee plans' }, { key: 'components', label: 'Components' }]} value={tab} onChange={setTab} />
      {tab === 'claims' && <Claims />}
      {tab === 'plans' && <Plans />}
      {tab === 'components' && <Components />}
    </div>
  );
}

function useReview(mutationFn, keys, message) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => { keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); toast.success(message); },
    onError: (err) => toast.error(errorText(err, 'Could not save.')),
  });
}

function RejectButton({ onReject, busy }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={busy}>Reject</Button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} title="Reason" size="sm"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!note.trim()} onClick={() => { onReject(note); setOpen(false); }}>Send back</Button></>}>
          <FormField as="textarea" rows={3} label="Tell the employee why" value={note} onChange={setNote} maxLength={500} />
        </Dialog>
      )}
    </>
  );
}

function Claims() {
  const [status, setStatus] = useState('SUBMITTED');
  const { data, isLoading } = useQuery({ queryKey: ['fbp-claims', status], queryFn: () => fbpApi.claims(status) });
  const approve = useReview((id) => fbpApi.approveClaim(id), ['fbp-claims', 'approvals-inbox'], 'Claim approved - it will be paid tax-free with the next payroll.');
  const reject = useReview(({ id, note }) => fbpApi.rejectClaim(id, note), ['fbp-claims', 'approvals-inbox'], 'Claim rejected.');
  return (
    <Card title="Bill claims" actions={(
      <div className="btn-group" role="group">{Object.entries(STATUS).map(([k, [l]]) => <button key={k} type="button" className={`btn btn-sm ${status === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setStatus(k)}>{l}</button>)}</div>
    )}>
      {isLoading ? <SkeletonText lines={4} /> : !(data || []).length ? <EmptyState icon={Wallet} title="No claims" description="Claims employees submit appear here." /> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Benefit</th><th>Bill</th><th className="text-end">Amount</th><th aria-label="Actions" /></tr></thead>
            <tbody>{data.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.employeeName}</strong> <span style={{ color: 'var(--hz-text-muted)' }}>{c.employeeCode}</span></td>
                <td>{c.componentName}</td>
                <td>{c.billDate}{c.billReference ? ` · ${c.billReference}` : ''}{c.description && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{c.description}</div>}</td>
                <td className="text-end"><strong>{rupees(c.amount)}</strong></td>
                <td className="text-end">{c.status === 'SUBMITTED' ? (
                  <div className="d-flex gap-2 justify-content-end"><RejectButton busy={reject.isPending} onReject={(note) => reject.mutate({ id: c.id, note })} /><Button size="sm" loading={approve.isPending} onClick={() => approve.mutate(c.id)}>Approve</Button></div>
                ) : c.paid ? <Badge variant="success">Paid</Badge> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Plans() {
  const { data, isLoading } = useQuery({ queryKey: ['fbp-declarations'], queryFn: () => fbpApi.declarations() });
  const approve = useReview((id) => fbpApi.approveDeclaration(id), ['fbp-declarations', 'approvals-inbox'], 'Plan approved. Special allowance has been reduced by the FBP amount.');
  const reject = useReview(({ id, note }) => fbpApi.rejectDeclaration(id, note), ['fbp-declarations', 'approvals-inbox'], 'Plan sent back.');
  return (
    <Card title="Employee plans" subtitle="Approving moves the monthly FBP amount out of the employee's special allowance">
      {isLoading ? <SkeletonText lines={4} /> : !(data || []).length ? <EmptyState icon={Wallet} title="No plans yet" description="Employees choose their benefits under My Finances → Flexible benefits." /> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Year</th><th>Benefits</th><th className="text-end">Per month</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>{data.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.employeeName}</strong> <span style={{ color: 'var(--hz-text-muted)' }}>{d.employeeCode}</span></td>
                <td>{fyLabel(d.financialYear)}</td>
                <td>{d.lines.map((l) => `${l.name} ${rupees(l.annualAmount)}`).join(' · ')}</td>
                <td className="text-end"><strong>{rupees(d.monthlyTotal)}</strong></td>
                <td><Badge variant={STATUS[d.status][1]}>{STATUS[d.status][0]}</Badge></td>
                <td className="text-end">{d.status === 'SUBMITTED' && (
                  <div className="d-flex gap-2 justify-content-end"><RejectButton busy={reject.isPending} onReject={(note) => reject.mutate({ id: d.id, note })} /><Button size="sm" loading={approve.isPending} onClick={() => approve.mutate(d.id)}>Approve</Button></div>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Components() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['fbp-components'], queryFn: fbpApi.components });
  const seed = useMutation({ mutationFn: fbpApi.seedDefaults, onSuccess: (v) => { queryClient.setQueryData(['fbp-components'], v); toast.success('Common components added.'); } });
  const save = useMutation({
    mutationFn: fbpApi.saveComponent,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fbp-components'] }); setEditing(null); toast.success('Component saved.'); },
    onError: (err) => toast.error(errorText(err, 'Could not save.')),
  });
  return (
    <Card title="Components" subtitle="What employees can put their FBP towards, and the yearly limit for each"
      actions={<div className="d-flex gap-2"><Button size="sm" variant="secondary" loading={seed.isPending} onClick={() => seed.mutate()}>Add common ones</Button><Button size="sm" icon={Plus} onClick={() => setEditing({ name: '', description: '', annualLimit: '', active: true })}>Add</Button></div>}>
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={Wallet} title="No components" description="Add fuel, phone & internet, meals and books to get started." /> : (
        <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
          <thead><tr><th>Component</th><th className="text-end">Yearly limit</th><th>Status</th><th aria-label="Edit" /></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c.id}><td><strong>{c.name}</strong>{c.description && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{c.description}</div>}</td><td className="text-end">{rupees(c.annualLimit)}</td>
              <td><Badge variant={c.active ? 'success' : 'neutral'}>{c.active ? 'Offered' : 'Off'}</Badge></td>
              <td className="text-end"><button type="button" className="btn btn-sm btn-light border-0" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil size={14} /></button></td></tr>
          ))}</tbody>
        </table>
      )}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.name}` : 'Add component'} size="sm"
          footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate({ ...editing, annualLimit: Number(editing.annualLimit) })}>Save</Button></>}>
          <FormField label="Name" value={editing.name} onChange={(v) => setEditing((e) => ({ ...e, name: v }))} maxLength={80} />
          <FormField label="Description" value={editing.description || ''} onChange={(v) => setEditing((e) => ({ ...e, description: v }))} maxLength={300} />
          <FormField type="number" label="Yearly limit ₹" value={editing.annualLimit} onChange={(v) => setEditing((e) => ({ ...e, annualLimit: v }))} min={1} />
          {editing.id && <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={editing.active} onChange={(ev) => setEditing((e) => ({ ...e, active: ev.target.checked }))} /> Offered to employees</label>}
        </Dialog>
      )}
    </Card>
  );
}
