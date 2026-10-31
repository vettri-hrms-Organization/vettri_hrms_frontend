import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Printer } from 'lucide-react';
import { billingApi } from '../../api/endpoints/platform';
import { errorText, inr } from '../../api/endpoints/workflows';
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
import { useConfirm } from '../../components/ui/ConfirmDialog';

const STATUS = { DRAFT: ['Draft', 'neutral'], SENT: ['Sent', 'info'], PAID: ['Paid', 'success'], VOID: ['Void', 'danger'] };
const iso = (d) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)); };
const monthEnd = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 0)); };

/** Project billing: rates, invoices from approved billable hours, utilization. */
export default function ProjectBilling() {
  const [tab, setTab] = useState('invoices');
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Timesheets" title="Project billing" description="Bill clients for approved hours and see who is billable" />
      <Tabs items={[{ key: 'invoices', label: 'Invoices' }, { key: 'rates', label: 'Rates' }, { key: 'utilization', label: 'Utilization' }]} value={tab} onChange={setTab} />
      {tab === 'invoices' && <Invoices />}
      {tab === 'rates' && <Rates />}
      {tab === 'utilization' && <UtilizationView />}
    </div>
  );
}

function Rates() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['billing-rates'], queryFn: billingApi.rates });
  const [editing, setEditing] = useState(null);
  const save = useMutation({
    mutationFn: () => billingApi.setRates(editing.projectId, { billingRate: editing.billingRate === '' ? null : Number(editing.billingRate), memberRates: editing.memberRates || {} }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['billing-rates'] }); setEditing(null); toast.success('Rate saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  return (
    <Card title="Billing rates" subtitle="Hourly rate charged to the client for each project">
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={FileText} title="No projects" description="Create projects under Timesheets first." /> : (
        <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
          <thead><tr><th>Project</th><th>Client</th><th>Billable</th><th className="text-end">Rate / hour</th><th className="text-end">Budget</th><th aria-label="Edit" /></tr></thead>
          <tbody>{data.map((p) => (
            <tr key={p.projectId}>
              <td><strong>{p.projectName}</strong></td>
              <td>{p.clientName || '—'}</td>
              <td>{p.billable ? <Badge variant="success">Yes</Badge> : <Badge variant="neutral">No</Badge>}</td>
              <td className="text-end">{p.billingRate != null ? inr(p.billingRate) : '—'}{Object.keys(p.memberRates || {}).length > 0 && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>+{Object.keys(p.memberRates).length} personal rates</div>}</td>
              <td className="text-end">{p.budgetMinutes ? `${Math.round(p.budgetMinutes / 60)} h` : '—'}</td>
              <td className="text-end"><button type="button" className="btn btn-sm btn-light border-0" aria-label={`Edit rate for ${p.projectName}`} onClick={() => setEditing({ ...p, billingRate: p.billingRate ?? '' })}><Pencil size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={`Rate · ${editing.projectName}`} size="sm"
          footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
          {!editing.billable && <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>This project isn't marked billable - turn that on in Timesheets to invoice it.</p>}
          <FormField type="number" min={0} label="Rate per hour ₹" value={editing.billingRate} onChange={(v) => setEditing((e) => ({ ...e, billingRate: v }))} />
        </Dialog>
      )}
    </Card>
  );
}

function Invoices() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['billing-invoices'], queryFn: billingApi.invoices });
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const status = useMutation({
    mutationFn: ({ id, s }) => billingApi.setStatus(id, s),
    onSuccess: (inv) => { queryClient.invalidateQueries({ queryKey: ['billing-invoices'] }); toast.success(`${inv.invoiceNumber} marked ${STATUS[inv.status][0].toLowerCase()}.`); },
    onError: (e) => toast.error(errorText(e, 'Could not update.')),
  });
  return (
    <Card title="Invoices" actions={<Button size="sm" icon={Plus} onClick={() => setCreating(true)}>New invoice</Button>}>
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={FileText} title="No invoices yet" description="Invoice a project for a period - only approved, billable hours are included, and each hour is billed once." /> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Invoice</th><th>Project</th><th>Period</th><th className="text-end">Total</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>{data.map((i) => (
              <tr key={i.id}>
                <td><button type="button" className="btn btn-link p-0" onClick={() => setViewing(i)}><strong>{i.invoiceNumber}</strong></button></td>
                <td>{i.projectName}<div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{i.clientName}</div></td>
                <td>{i.periodFrom} – {i.periodTo}</td>
                <td className="text-end"><strong>{inr(i.total)}</strong></td>
                <td><Badge variant={STATUS[i.status][1]}>{STATUS[i.status][0]}</Badge></td>
                <td className="text-end"><div className="d-flex gap-2 justify-content-end">
                  {i.status === 'DRAFT' && <Button size="sm" variant="secondary" onClick={() => status.mutate({ id: i.id, s: 'SENT' })}>Mark sent</Button>}
                  {['DRAFT', 'SENT'].includes(i.status) && <Button size="sm" variant="secondary" onClick={() => status.mutate({ id: i.id, s: 'PAID' })}>Mark paid</Button>}
                  {['DRAFT', 'SENT'].includes(i.status) && <Button size="sm" variant="secondary" onClick={async () => { if (await confirm({ title: `Void ${i.invoiceNumber}?`, description: 'Its hours become available to invoice again.', confirmLabel: 'Void' })) status.mutate({ id: i.id, s: 'VOID' }); }}>Void</Button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {creating && <CreateInvoiceDialog onClose={() => setCreating(false)} onCreated={(inv) => { setCreating(false); setViewing(inv); }} />}
      {viewing && <InvoiceDialog invoice={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

function CreateInvoiceDialog({ onClose, onCreated }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ['billing-rates'], queryFn: billingApi.rates });
  const [form, setForm] = useState({ projectId: '', from: monthStart(), to: monthEnd(), taxPercent: '18', notes: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const body = { ...form, projectId: Number(form.projectId), taxPercent: Number(form.taxPercent || 0) };
  const { data: preview, isFetching, error } = useQuery({
    queryKey: ['billing-preview', form.projectId, form.from, form.to],
    queryFn: () => billingApi.preview(body),
    enabled: !!form.projectId && !!form.from && !!form.to,
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => billingApi.createInvoice(body),
    onSuccess: (inv) => { queryClient.invalidateQueries({ queryKey: ['billing-invoices'] }); toast.success(`${inv.invoiceNumber} created.`); onCreated(inv); },
    onError: (e) => toast.error(errorText(e, 'Could not create the invoice.')),
  });
  const billable = projects.filter((p) => p.billable);
  const tax = preview ? (Number(preview.subtotal) * Number(form.taxPercent || 0)) / 100 : 0;
  return (
    <Dialog open onClose={onClose} title="New invoice" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!preview?.lines?.length} loading={create.isPending} onClick={() => create.mutate()}>Create invoice</Button></>}>
      <div className="row g-2">
        <FormField col={12} as="select" label="Project" value={form.projectId} onChange={set('projectId')}>
          <option value="">Choose a billable project…</option>
          {billable.map((p) => <option key={p.projectId} value={p.projectId}>{p.projectName}{p.clientName ? ` · ${p.clientName}` : ''}</option>)}
        </FormField>
        <FormField col={4} type="date" label="From" value={form.from} onChange={set('from')} />
        <FormField col={4} type="date" label="To" value={form.to} onChange={set('to')} />
        <FormField col={4} type="number" min={0} max={100} label="GST / tax %" value={form.taxPercent} onChange={set('taxPercent')} />
        <FormField col={12} as="textarea" rows={2} label="Notes (optional)" value={form.notes} onChange={set('notes')} maxLength={1000} />
      </div>
      {isFetching ? <SkeletonText lines={3} /> : error ? <p style={{ color: 'var(--hz-danger-600, #dc2626)', fontSize: 13 }}>{errorText(error, 'Could not preview.')}</p> : preview && (
        <>
          {preview.warnings.map((w) => <p key={w} className="mb-1" style={{ fontSize: 12, color: 'var(--hz-warning-700, #b45309)' }}>{w}</p>)}
          {!preview.lines.length ? <p style={{ fontSize: 13 }}>No approved, un-invoiced billable hours in this period.</p> : <Lines lines={preview.lines} subtotal={preview.subtotal} taxPercent={form.taxPercent} tax={tax} total={Number(preview.subtotal) + tax} />}
        </>
      )}
    </Dialog>
  );
}

function Lines({ lines, subtotal, taxPercent, tax, total }) {
  return (
    <table className="table table-sm align-middle mt-2 mb-0" style={{ fontSize: 13 }}>
      <thead><tr><th>Team member</th><th className="text-end">Hours</th><th className="text-end">Rate</th><th className="text-end">Amount</th></tr></thead>
      <tbody>{lines.map((l) => (
        <tr key={l.employeeId}><td>{l.employeeName}</td><td className="text-end">{Number(l.hours).toFixed(2)}</td><td className="text-end">{l.rate != null ? inr(l.rate) : '—'}</td><td className="text-end">{inr(l.amount)}</td></tr>
      ))}</tbody>
      <tfoot>
        <tr><th colSpan={3} className="text-end">Subtotal</th><th className="text-end">{inr(subtotal)}</th></tr>
        <tr><th colSpan={3} className="text-end">Tax ({Number(taxPercent || 0)}%)</th><th className="text-end">{inr(tax)}</th></tr>
        <tr><th colSpan={3} className="text-end">Total</th><th className="text-end">{inr(total)}</th></tr>
      </tfoot>
    </table>
  );
}

function InvoiceDialog({ invoice: i, onClose }) {
  const print = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    const rows = i.lines.map((l) => `<tr><td>${esc(l.employeeName)}</td><td style="text-align:right">${Number(l.hours).toFixed(2)}</td><td style="text-align:right">${esc(inr(l.rate))}</td><td style="text-align:right">${esc(inr(l.amount))}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(i.invoiceNumber)}</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style></head><body>
      <h2>Invoice ${esc(i.invoiceNumber)}</h2><p><strong>${esc(i.clientName || '')}</strong><br>Project: ${esc(i.projectName || '')}<br>Period: ${esc(i.periodFrom)} – ${esc(i.periodTo)}</p>
      <table><thead><tr><th>Team member</th><th style="text-align:right">Hours</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="text-align:right">Subtotal ${esc(inr(i.subtotal))}<br>Tax (${esc(String(i.taxPercent))}%) ${esc(inr(i.taxAmount))}<br><strong>Total ${esc(inr(i.total))}</strong></p>
      ${i.notes ? `<p>${esc(i.notes)}</p>` : ''}<script>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <Dialog open onClose={onClose} title={`${i.invoiceNumber} · ${i.projectName}`} description={`${i.periodFrom} – ${i.periodTo}`} size="lg"
      footer={<><Button variant="secondary" icon={Printer} onClick={print}>Print / PDF</Button><Button onClick={onClose}>Close</Button></>}>
      <Lines lines={i.lines} subtotal={i.subtotal} taxPercent={i.taxPercent} tax={i.taxAmount} total={i.total} />
      {i.notes && <p className="mt-2" style={{ fontSize: 13 }}>{i.notes}</p>}
    </Dialog>
  );
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function UtilizationView() {
  const [range, setRange] = useState({ from: monthStart(), to: monthEnd() });
  const { data, isLoading, error } = useQuery({ queryKey: ['billing-util', range], queryFn: () => billingApi.utilization(range.from, range.to), retry: false });
  return (
    <>
      <div className="d-flex gap-2 align-items-end flex-wrap">
        <FormField type="date" label="From" value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
        <FormField type="date" label="To" value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
      </div>
      {isLoading ? <Card><SkeletonText lines={4} /></Card> : error ? <Card><p>{errorText(error, 'Could not load.')}</p></Card> : (
        <>
          <Card title="People" subtitle="Billable hours as a share of all hours logged">
            {!data.people.length ? <EmptyState icon={FileText} title="No hours logged" description="Nothing in this period." /> : (
              <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
                <thead><tr><th>Name</th><th>Department</th><th className="text-end">Hours</th><th className="text-end">Billable</th><th style={{ width: 200 }}>Utilization</th></tr></thead>
                <tbody>{data.people.map((p) => (
                  <tr key={p.employeeId}>
                    <td>{p.employeeName}</td><td>{p.department || '—'}</td><td className="text-end">{p.totalHours}</td><td className="text-end">{p.billableHours}</td>
                    <td><div className="d-flex align-items-center gap-2"><div style={{ flex: 1, height: 6, background: 'var(--hz-gray-200)', borderRadius: 4 }}><div style={{ width: `${Math.min(100, p.utilizationPercent)}%`, height: '100%', background: 'var(--hz-primary-500, #4f46e5)', borderRadius: 4 }} /></div><span>{p.utilizationPercent}%</span></div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
          <Card title="Projects">
            {!data.projects.length ? <EmptyState icon={FileText} title="No project hours" description="Nothing in this period." /> : (
              <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
                <thead><tr><th>Project</th><th className="text-end">Hours</th><th className="text-end">Billable</th><th className="text-end">Budget used</th><th className="text-end">Billable value</th></tr></thead>
                <tbody>{data.projects.map((p) => (
                  <tr key={p.projectId}>
                    <td><strong>{p.projectName}</strong><div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{p.clientName}</div></td>
                    <td className="text-end">{p.hours}</td><td className="text-end">{p.billableHours}</td>
                    <td className="text-end" style={{ color: Number(p.budgetUsedPercent) > 100 ? 'var(--hz-danger-600, #dc2626)' : undefined }}>{p.budgetUsedPercent != null ? `${p.budgetUsedPercent}% of ${p.budgetHours} h` : '—'}</td>
                    <td className="text-end">{inr(p.billableValue)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
