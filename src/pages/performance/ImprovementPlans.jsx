import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Plus, X } from 'lucide-react';
import { perfApi, errorText } from '../../api/endpoints/performanceSuite';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const STATUS = { ACTIVE: ['Active', 'warning'], SUCCESSFUL: ['Successful', 'success'], UNSUCCESSFUL: ['Unsuccessful', 'danger'], CANCELLED: ['Cancelled', 'neutral'] };
const PROGRESS = { ON_TRACK: ['On track', 'success'], SOME_PROGRESS: ['Some progress', 'warning'], NO_PROGRESS: ['No progress', 'danger'] };

/** Performance improvement plans: the employee's own plan, and plans managers/HR run. */
export default function ImprovementPlans() {
  const { data: me } = useQuery({ queryKey: ['perf-me'], queryFn: perfApi.me });
  const canManage = me?.hr || (me?.reportIds || []).length > 0;
  const { data: mine = [], isLoading: loadingMine } = useQuery({ queryKey: ['pips-mine'], queryFn: perfApi.myPips });
  const { data: managed = [], isLoading } = useQuery({ queryKey: ['pips'], queryFn: perfApi.pips, enabled: !!canManage });
  const [creating, setCreating] = useState(false);
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Performance" title="Improvement plans" description="Clear expectations, regular check-ins and a documented outcome"
        actions={canManage && <Button icon={Plus} onClick={() => setCreating(true)}>New plan</Button>} />
      {loadingMine ? <Card><SkeletonText lines={3} /></Card> : mine.map((p) => <Plan key={p.id} p={p} self />)}
      {canManage && (
        isLoading ? <Card><SkeletonText lines={3} /></Card> : !managed.length ? (
          <Card><EmptyState icon={LifeBuoy} title="No plans" description="Plans you open for your team appear here. Use them sparingly, with clear and measurable expectations." /></Card>
        ) : managed.map((p) => <Plan key={p.id} p={p} />)
      )}
      {!canManage && !loadingMine && !mine.length && <Card><EmptyState icon={LifeBuoy} title="Nothing here" description="You don't have an improvement plan." /></Card>}
      {creating && <CreateDialog me={me} onClose={() => setCreating(false)} />}
    </div>
  );
}

function usePip(fn, message, after) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { ['pips', 'pips-mine'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); toast.success(message); after?.(); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
}

function Plan({ p, self = false }) {
  const [checkIn, setCheckIn] = useState(false);
  const [closing, setClosing] = useState(false);
  const ack = usePip(() => perfApi.acknowledgePip(p.id), 'Acknowledged.');
  return (
    <Card title={self ? 'Your improvement plan' : `${p.employeeName} · ${p.employeeCode || ''}`}
      subtitle={`${p.startDate} → ${p.endDate}${p.ownerName ? ` · owner ${p.ownerName}` : ''}`}
      actions={<div className="d-flex gap-2 align-items-center">
        <Badge variant={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
        {!self && p.status === 'ACTIVE' && <><Button size="sm" variant="secondary" onClick={() => setCheckIn(true)}>Check-in</Button><Button size="sm" variant="secondary" onClick={() => setClosing(true)}>Close / extend</Button></>}
      </div>}>
      <p style={{ fontSize: 13 }}><strong>Why:</strong> {p.reason}</p>
      <strong style={{ fontSize: 13 }}>Expectations</strong>
      <ol style={{ fontSize: 13 }}>{p.expectations.map((e, i) => <li key={i}>{e.goal}{e.measure && <span style={{ color: 'var(--hz-text-muted)' }}> - measured by {e.measure}</span>}</li>)}</ol>
      {p.checkIns.length > 0 && (
        <>
          <strong style={{ fontSize: 13 }}>Check-ins</strong>
          <div className="d-flex flex-column gap-1 mt-1">{p.checkIns.map((c, i) => (
            <div key={i} style={{ fontSize: 13 }}><span style={{ color: 'var(--hz-text-muted)' }}>{c.date} · {c.byName}</span>{c.rating && <Badge className="ms-2" variant={PROGRESS[c.rating][1]}>{PROGRESS[c.rating][0]}</Badge>}<div>{c.note}</div></div>
          ))}</div>
        </>
      )}
      {p.outcomeNote && <p className="mt-2" style={{ fontSize: 13 }}><strong>Outcome note:</strong> {p.outcomeNote}</p>}
      <div className="mt-3" style={{ fontSize: 12 }}>
        {p.acknowledgedAt ? <Badge variant="success">Acknowledged by employee</Badge>
          : self ? <Button size="sm" loading={ack.isPending} onClick={() => ack.mutate()}>I've read this plan</Button>
            : <span style={{ color: 'var(--hz-text-muted)' }}>Not yet acknowledged by the employee</span>}
      </div>
      {checkIn && <CheckInDialog p={p} onClose={() => setCheckIn(false)} />}
      {closing && <CloseDialog p={p} onClose={() => setClosing(false)} />}
    </Card>
  );
}

function CheckInDialog({ p, onClose }) {
  const [note, setNote] = useState('');
  const [rating, setRating] = useState('SOME_PROGRESS');
  const save = usePip(() => perfApi.pipCheckIn(p.id, { note, rating }), 'Check-in saved.', onClose);
  return (
    <Dialog open onClose={onClose} title={`Check-in · ${p.employeeName}`} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!note.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <FormField as="select" label="Progress" value={rating} onChange={setRating}>{Object.entries(PROGRESS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</FormField>
      <FormField as="textarea" rows={4} label="Notes" value={note} onChange={setNote} maxLength={2000} />
    </Dialog>
  );
}

function CloseDialog({ p, onClose }) {
  const [form, setForm] = useState({ outcome: 'SUCCESSFUL', note: '', newEndDate: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = usePip(() => perfApi.closePip(p.id, { ...form, newEndDate: form.newEndDate || null }), form.outcome === 'EXTENDED' ? 'Plan extended.' : 'Plan closed.', onClose);
  return (
    <Dialog open onClose={onClose} title={`Outcome · ${p.employeeName}`} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <FormField as="select" label="Outcome" value={form.outcome} onChange={set('outcome')}>
        <option value="SUCCESSFUL">Successful - expectations met</option>
        <option value="EXTENDED">Extend the plan</option>
        <option value="UNSUCCESSFUL">Unsuccessful</option>
        <option value="CANCELLED">Cancel the plan</option>
      </FormField>
      {form.outcome === 'EXTENDED' && <FormField type="date" label="New end date" value={form.newEndDate} onChange={set('newEndDate')} min={p.endDate} />}
      <FormField as="textarea" rows={3} label="Note (shared with the employee)" value={form.note} onChange={set('note')} maxLength={1000} />
    </Dialog>
  );
}

function CreateDialog({ me, onClose }) {
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const choices = people.filter((x) => x.id !== me?.employeeId && (me?.hr || (me?.reportIds || []).includes(x.id)));
  const [form, setForm] = useState({ employeeId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', reason: '' });
  const [items, setItems] = useState([{ goal: '', measure: '' }]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = usePip(() => perfApi.createPip({ ...form, employeeId: Number(form.employeeId), expectations: items.filter((e) => e.goal.trim()) }),
    'Plan shared with the employee.', onClose);
  return (
    <Dialog open onClose={onClose} title="New improvement plan" size="lg" hasUnsavedChanges={!!form.reason}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.employeeId || !form.endDate || !form.reason.trim()} loading={save.isPending} onClick={() => save.mutate()}>Share plan</Button></>}>
      <div className="row g-2">
        <FormField col={12} as="select" label="Employee" value={form.employeeId} onChange={set('employeeId')}>
          <option value="">Choose…</option>
          {choices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </FormField>
        <FormField col={6} type="date" label="Starts" value={form.startDate} onChange={set('startDate')} />
        <FormField col={6} type="date" label="Ends" value={form.endDate} onChange={set('endDate')} hint="Usually 30–90 days" />
        <FormField col={12} as="textarea" rows={3} label="Why this plan is needed" value={form.reason} onChange={set('reason')} maxLength={2000} />
      </div>
      <strong style={{ fontSize: 13 }}>Expectations</strong>
      {items.map((e, i) => (
        <div key={i} className="row g-2 align-items-end mt-1">
          <FormField col={6} label={`Expectation ${i + 1}`} value={e.goal} onChange={(v) => setItems((all) => all.map((x, j) => (j === i ? { ...x, goal: v } : x)))} maxLength={500} />
          <FormField col={5} label="How it's measured" value={e.measure} onChange={(v) => setItems((all) => all.map((x, j) => (j === i ? { ...x, measure: v } : x)))} maxLength={500} />
          <div className="col-1">{items.length > 1 && <button type="button" className="btn btn-sm btn-light border-0" aria-label="Remove" onClick={() => setItems((all) => all.filter((_, j) => j !== i))}><X size={14} /></button>}</div>
        </div>
      ))}
      <Button className="mt-2" size="sm" variant="secondary" icon={Plus} onClick={() => setItems((all) => [...all, { goal: '', measure: '' }])}>Another expectation</Button>
      <p className="mt-3 mb-0" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>The employee is notified and asked to acknowledge the plan. Only they, their manager and HR can see it.</p>
    </Dialog>
  );
}
