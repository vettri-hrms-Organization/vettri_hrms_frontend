import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Headset, Lock, Pencil, Plus, Star } from 'lucide-react';
import { helpdeskApi, errorText, when } from '../../api/endpoints/workflows';
import { perfApi } from '../../api/endpoints/performanceSuite';
import { useAuth } from '../../hooks/useAuth';
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

const STATUS = { OPEN: ['Open', 'warning'], IN_PROGRESS: ['In progress', 'info'], WAITING_ON_EMPLOYEE: ['Waiting on you', 'warning'], RESOLVED: ['Resolved', 'success'], CLOSED: ['Closed', 'neutral'] };
const AGENT_STATUS = { ...STATUS, WAITING_ON_EMPLOYEE: ['Waiting on employee', 'neutral'] };
const PRIORITY = { LOW: 'neutral', NORMAL: 'neutral', HIGH: 'warning', URGENT: 'danger' };

/** HR helpdesk: raise and follow tickets; HR works the queue and manages categories. */
export default function Helpdesk() {
  const { hasPermission } = useAuth();
  const isHr = hasPermission('EMPLOYEE_MANAGE');
  const [tab, setTab] = useState('mine');
  const [raising, setRaising] = useState(false);
  const [open, setOpen] = useState(null);
  const items = [{ key: 'mine', label: 'My tickets' }, { key: 'queue', label: 'Ticket queue' }];
  if (isHr) items.push({ key: 'categories', label: 'Categories' });
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Support" title="HR helpdesk" description="Ask HR anything - payroll, leave, documents, policies - and track the answer"
        actions={<Button icon={Plus} onClick={() => setRaising(true)}>Raise a ticket</Button>} />
      <Tabs items={items} value={tab} onChange={setTab} />
      {tab === 'mine' && <MyTickets onOpen={setOpen} />}
      {tab === 'queue' && <Queue isHr={isHr} onOpen={setOpen} />}
      {tab === 'categories' && <Categories />}
      {raising && <RaiseDialog onClose={() => setRaising(false)} onRaised={(t) => { setRaising(false); setOpen(t.id); }} />}
      {open && <TicketDialog id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TicketList({ rows, onOpen, agent = false }) {
  const map = agent ? AGENT_STATUS : STATUS;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
        <thead><tr><th>Ticket</th>{agent && <th>Employee</th>}<th>Category</th><th>Status</th><th>{agent ? 'Due' : 'Raised'}</th>{agent && <th>Assignee</th>}</tr></thead>
        <tbody>{rows.map((t) => (
          <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(t.id)}>
            <td>
              <button type="button" className="btn btn-link p-0 text-start" onClick={(e) => { e.stopPropagation(); onOpen(t.id); }}>
                <strong>{t.ticketNumber}</strong> {t.subject}
              </button>
              {t.confidential && <Lock size={12} className="ms-1" aria-label="Confidential" />}
              {t.priority !== 'NORMAL' && <Badge className="ms-2" variant={PRIORITY[t.priority]}>{t.priority.toLowerCase()}</Badge>}
            </td>
            {agent && <td>{t.employeeName}</td>}
            <td>{t.categoryName}</td>
            <td><Badge variant={map[t.status][1]}>{map[t.status][0]}</Badge></td>
            <td>{agent ? <span style={{ color: t.overdue ? 'var(--hz-danger-600, #dc2626)' : undefined }}>{t.overdue ? 'Overdue · ' : ''}{when(t.dueAt)}</span> : when(t.createdAt)}</td>
            {agent && <td>{t.assigneeName || <span style={{ color: 'var(--hz-text-muted)' }}>Unassigned</span>}</td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function MyTickets({ onOpen }) {
  const { data, isLoading } = useQuery({ queryKey: ['helpdesk-mine'], queryFn: helpdeskApi.mine });
  return (
    <Card title="My tickets">
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length
        ? <EmptyState icon={Headset} title="No tickets" description="Raise a ticket and HR will get back to you here." />
        : <TicketList rows={data} onOpen={onOpen} />}
    </Card>
  );
}

function Queue({ isHr, onOpen }) {
  const [status, setStatus] = useState('ACTIVE');
  const { data, isLoading, error } = useQuery({ queryKey: ['helpdesk-queue', status], queryFn: () => helpdeskApi.queue(status), retry: false });
  const { data: summary } = useQuery({ queryKey: ['helpdesk-summary'], queryFn: helpdeskApi.summary, enabled: isHr });
  if (error?.response?.status === 403) return <Card><EmptyState icon={Headset} title="No queue for you" description="Tickets assigned to you by HR appear here." /></Card>;
  return (
    <>
      {summary && (
        <div className="row g-3">
          {[['Open', summary.open], ['Overdue', summary.overdue], ['Unassigned', summary.unassigned], ['Resolved this week', summary.resolvedThisWeek], ['Avg rating', summary.averageRating ?? '—']].map(([l, v]) => (
            <div key={l} className="col-6 col-md"><Card><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{l}</div><strong style={{ fontSize: 20 }}>{v}</strong></Card></div>
          ))}
        </div>
      )}
      <Card title="Queue" actions={(
        <div className="btn-group" role="group">{[['ACTIVE', 'Active'], ['RESOLVED', 'Resolved'], ['ALL', 'All']].map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm ${status === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setStatus(k)}>{l}</button>
        ))}</div>
      )}>
        {isLoading ? <SkeletonText lines={4} /> : !(data || []).length ? <EmptyState icon={Headset} title="Queue is clear" description="Nothing waiting." /> : <TicketList rows={data} onOpen={onOpen} agent />}
      </Card>
    </>
  );
}

function RaiseDialog({ onClose, onRaised }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['helpdesk-categories'], queryFn: helpdeskApi.categories });
  const [form, setForm] = useState({ categoryId: '', subject: '', description: '', priority: 'NORMAL', confidential: false });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const raise = useMutation({
    mutationFn: () => helpdeskApi.raise({ ...form, categoryId: Number(form.categoryId) }),
    onSuccess: (t) => { queryClient.invalidateQueries({ queryKey: ['helpdesk-mine'] }); toast.success(`${t.ticketNumber} raised. HR will reply here.`); onRaised(t); },
    onError: (e) => toast.error(errorText(e, 'Could not raise the ticket.')),
  });
  const category = categories.find((c) => String(c.id) === String(form.categoryId));
  return (
    <Dialog open onClose={onClose} title="Raise a ticket" hasUnsavedChanges={!!form.description}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.categoryId || !form.subject.trim() || !form.description.trim()} loading={raise.isPending} onClick={() => raise.mutate()}>Raise</Button></>}>
      <FormField as="select" label="What is it about?" value={form.categoryId} onChange={set('categoryId')} hint={category ? `${category.description || ''} · usually answered within ${category.slaHours} hours` : undefined}>
        <option value="">Choose…</option>
        {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </FormField>
      <FormField label="Subject" value={form.subject} onChange={set('subject')} maxLength={200} />
      <FormField as="textarea" rows={5} label="Details" value={form.description} onChange={set('description')} maxLength={10000} />
      <FormField as="select" label="Priority" value={form.priority} onChange={set('priority')}>
        <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
      </FormField>
      <label className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 13 }}>
        <input type="checkbox" className="form-check-input m-0" checked={form.confidential || category?.name === 'Grievance'} disabled={category?.name === 'Grievance'} onChange={(e) => set('confidential')(e.target.checked)} />
        Confidential - only HR and the assigned person can see it
      </label>
    </Dialog>
  );
}

function TicketDialog({ id, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: t, isLoading } = useQuery({ queryKey: ['helpdesk-ticket', id], queryFn: () => helpdeskApi.get(id) });
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people, enabled: !!t?.canWork });
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [rating, setRating] = useState(0);
  const refresh = (v) => { queryClient.setQueryData(['helpdesk-ticket', id], v); ['helpdesk-mine', 'helpdesk-queue', 'helpdesk-summary'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); };
  const send = useMutation({
    mutationFn: (status) => helpdeskApi.comment(id, { body: reply, internal, status: status || null }),
    onSuccess: (v) => { refresh(v); setReply(''); setInternal(false); toast.success('Reply sent.'); },
    onError: (e) => toast.error(errorText(e, 'Could not send.')),
  });
  const update = useMutation({ mutationFn: (body) => helpdeskApi.update(id, body), onSuccess: (v) => { refresh(v); toast.success('Ticket updated.'); }, onError: (e) => toast.error(errorText(e, 'Could not update.')) });
  const rate = useMutation({ mutationFn: () => helpdeskApi.rate(id, { rating }), onSuccess: (v) => { refresh(v); toast.success('Thanks for the feedback.'); }, onError: (e) => toast.error(errorText(e, 'Could not rate.')) });
  const map = t?.canWork ? AGENT_STATUS : STATUS;
  return (
    <Dialog open onClose={onClose} title={t ? `${t.ticketNumber} · ${t.subject}` : 'Ticket'} size="lg" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {isLoading || !t ? <SkeletonText lines={5} /> : (
        <>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2" style={{ fontSize: 13 }}>
            <Badge variant={map[t.status][1]}>{map[t.status][0]}</Badge>
            <span>{t.categoryName}</span>
            {t.canWork && <span>· {t.employeeName} ({t.employeeCode})</span>}
            {t.confidential && <span><Lock size={12} /> Confidential</span>}
            <span style={{ color: t.overdue ? 'var(--hz-danger-600, #dc2626)' : 'var(--hz-text-muted)' }}>· due {when(t.dueAt)}</span>
          </div>
          {t.canWork && (
            <div className="row g-2 mb-3">
              <FormField col={4} as="select" label="Status" value={t.status} onChange={(v) => update.mutate({ status: v })}>
                {Object.entries(AGENT_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </FormField>
              <FormField col={4} as="select" label="Priority" value={t.priority} onChange={(v) => update.mutate({ priority: v })}>
                {Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </FormField>
              <FormField col={4} as="select" label="Assignee" value={t.assigneeEmployeeId || ''} onChange={(v) => v && update.mutate({ assigneeEmployeeId: Number(v) })}>
                <option value="">Unassigned</option>
                {people.filter((p) => p.id !== t.employeeId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FormField>
            </div>
          )}
          <div className="p-3 mb-2" style={{ background: 'var(--hz-surface-muted, var(--hz-gray-50))', borderRadius: 10, fontSize: 14, whiteSpace: 'pre-wrap' }}>{t.description}</div>
          <div className="d-flex flex-column gap-2">
            {t.comments.map((c) => (
              <div key={c.id} className="p-2 px-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10, marginLeft: c.fromEmployee ? 0 : 24, background: c.internal ? 'var(--hz-warning-50, #fffbeb)' : undefined }}>
                <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}><strong>{c.authorName}</strong> · {when(c.at)}{c.internal && ' · internal note'}</div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.body}</div>
              </div>
            ))}
          </div>
          {t.status !== 'CLOSED' && (
            <div className="mt-3">
              <FormField as="textarea" rows={3} label={t.canWork ? 'Reply to the employee' : 'Add a reply'} value={reply} onChange={setReply} maxLength={10000} />
              <div className="d-flex flex-wrap gap-2 align-items-center">
                {t.canWork && <label className="form-check d-inline-flex align-items-center gap-2 me-auto" style={{ fontSize: 13 }}><input type="checkbox" className="form-check-input m-0" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (hidden from the employee)</label>}
                <Button size="sm" variant="secondary" disabled={!reply.trim()} loading={send.isPending} onClick={() => send.mutate()}>Send</Button>
                {t.canWork && !internal && <Button size="sm" disabled={!reply.trim()} loading={send.isPending} onClick={() => send.mutate('RESOLVED')}>Send & resolve</Button>}
              </div>
            </div>
          )}
          {!t.canWork && t.status === 'RESOLVED' && (
            <div className="mt-3 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
              <div style={{ fontSize: 13 }} className="mb-2">Did this solve it? Rate the help you got (or reply above to reopen).</div>
              <div className="d-flex gap-1 align-items-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className="btn btn-sm btn-light border-0 p-1" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}>
                    <Star size={20} fill={n <= rating ? 'currentColor' : 'none'} style={{ color: 'var(--hz-warning-500, #f59e0b)' }} />
                  </button>
                ))}
                <Button size="sm" className="ms-2" disabled={!rating} loading={rate.isPending} onClick={() => rate.mutate()}>Rate & close</Button>
              </div>
            </div>
          )}
          {t.rating && <p className="mt-3 mb-0" style={{ fontSize: 13 }}>Rated {t.rating}/5{t.ratingComment ? ` - ${t.ratingComment}` : ''}</p>}
        </>
      )}
    </Dialog>
  );
}

function Categories() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['helpdesk-categories'], queryFn: helpdeskApi.categories });
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const [editing, setEditing] = useState(null);
  const save = useMutation({
    mutationFn: () => helpdeskApi.saveCategory({ ...editing, slaHours: Number(editing.slaHours), assigneeEmployeeId: editing.assigneeEmployeeId ? Number(editing.assigneeEmployeeId) : null }),
    onSuccess: (v) => { queryClient.setQueryData(['helpdesk-categories'], v); setEditing(null); toast.success('Category saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  return (
    <Card title="Categories" subtitle="Who picks up each kind of ticket, and how fast it should be resolved"
      actions={<Button size="sm" icon={Plus} onClick={() => setEditing({ name: '', description: '', slaHours: 48, assigneeEmployeeId: '', active: true })}>Add</Button>}>
      {isLoading ? <SkeletonText lines={4} /> : (
        <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
          <thead><tr><th>Category</th><th>Default owner</th><th className="text-end">SLA</th><th>Status</th><th aria-label="Edit" /></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c.id}>
              <td><strong>{c.name}</strong>{c.description && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{c.description}</div>}</td>
              <td>{c.assigneeName || <span style={{ color: 'var(--hz-text-muted)' }}>HR team</span>}</td>
              <td className="text-end">{c.slaHours} h</td>
              <td><Badge variant={c.active ? 'success' : 'neutral'}>{c.active ? 'Active' : 'Off'}</Badge></td>
              <td className="text-end"><button type="button" className="btn btn-sm btn-light border-0" aria-label={`Edit ${c.name}`} onClick={() => setEditing({ ...c, assigneeEmployeeId: c.assigneeEmployeeId || '' })}><Pencil size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.name}` : 'Add category'} size="sm"
          footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
          <FormField label="Name" value={editing.name} onChange={(v) => setEditing((e) => ({ ...e, name: v }))} maxLength={80} />
          <FormField label="Description" value={editing.description || ''} onChange={(v) => setEditing((e) => ({ ...e, description: v }))} maxLength={300} />
          <FormField as="select" label="Default owner" value={editing.assigneeEmployeeId} onChange={(v) => setEditing((e) => ({ ...e, assigneeEmployeeId: v }))}>
            <option value="">HR team (unassigned)</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FormField>
          <FormField type="number" min={1} max={720} label="Resolve within (hours)" value={editing.slaHours} onChange={(v) => setEditing((e) => ({ ...e, slaHours: v }))} />
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={editing.active} onChange={(ev) => setEditing((e) => ({ ...e, active: ev.target.checked }))} /> Active</label>
        </Dialog>
      )}
    </Card>
  );
}
