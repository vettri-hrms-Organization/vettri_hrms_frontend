import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus, Star, Users } from 'lucide-react';
import { perfApi, ratingLabel, errorText } from '../../api/endpoints/performanceSuite';
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

const STAGES = { DRAFT: ['Draft', 'neutral'], SELF_REVIEW: ['Self review', 'info'], MANAGER_REVIEW: ['Manager review', 'warning'], CALIBRATION: ['Calibration', 'warning'], RELEASED: ['Released', 'success'] };
const PSTATUS = { SELF_PENDING: ['Self review pending', 'neutral'], MANAGER_PENDING: ['Manager review pending', 'info'], CALIBRATION: ['Ready for calibration', 'warning'], RELEASED: ['Released', 'success'] };
const KIND = { SELF: 'Self review', PEER: 'Peer feedback', MANAGER: 'Manager review' };
const NEXT = { DRAFT: 'Launch self reviews', SELF_REVIEW: 'Open manager reviews', MANAGER_REVIEW: 'Move to calibration' };

/** Review cycles: write your reviews, see your results, and (managers/HR) run the cycle. */
export default function ReviewCycles() {
  const { data: me } = useQuery({ queryKey: ['perf-me'], queryFn: perfApi.me });
  const canRun = me?.hr || (me?.reportIds || []).length > 0;
  const [tab, setTab] = useState('todo');
  const items = [{ key: 'todo', label: 'To do' }, { key: 'mine', label: 'My reviews' }];
  if (canRun) items.push({ key: 'cycles', label: me?.hr ? 'Cycles' : 'My team' });
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Performance" title="Review cycles" description="Self, peer and manager reviews, calibration and results" />
      <Tabs items={items} value={tab} onChange={setTab} />
      {tab === 'todo' && <Tasks />}
      {tab === 'mine' && <MyResults />}
      {tab === 'cycles' && canRun && <Cycles hr={!!me?.hr} />}
    </div>
  );
}

function Stars({ value }) {
  if (value == null) return <span style={{ color: 'var(--hz-text-muted)' }}>—</span>;
  return <span title={ratingLabel(value)}><Star size={13} style={{ verticalAlign: -2, color: 'var(--hz-warning-500, #f59e0b)' }} fill="currentColor" /> {Number(value).toFixed(1)}</span>;
}

function Tasks() {
  const { data, isLoading } = useQuery({ queryKey: ['perf-tasks'], queryFn: perfApi.reviewTasks });
  const [writing, setWriting] = useState(null);
  return (
    <Card title="Reviews to write">
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? (
        <EmptyState icon={ClipboardCheck} title="You're all caught up" description="Reviews you need to write appear here when a cycle opens." />
      ) : (
        <div className="d-flex flex-column gap-2">
          {data.map((t) => (
            <div key={t.responseId} className="d-flex align-items-center justify-content-between gap-3 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
              <div>
                <strong>{KIND[t.kind]}{t.kind !== 'SELF' && ` · ${t.employeeName}`}</strong>
                <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{t.cycleName}{t.due ? ` · due ${t.due}` : ''}</div>
              </div>
              <Button size="sm" onClick={() => setWriting(t)}>Write</Button>
            </div>
          ))}
        </div>
      )}
      {writing && <ReviewDialog task={writing} onClose={() => setWriting(null)} />}
    </Card>
  );
}

function ReviewDialog({ task, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ rating: '', strengths: '', improvements: '', comments: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = useMutation({
    mutationFn: () => perfApi.submitReview(task.responseId, { ...form, rating: form.rating ? Number(form.rating) : null }),
    onSuccess: () => {
      ['perf-tasks', 'perf-my-reviews', 'perf-participants', 'perf-cycles', 'approvals-inbox'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Review submitted.');
      onClose();
    },
    onError: (e) => toast.error(errorText(e, 'Could not submit the review.')),
  });
  const title = task.kind === 'SELF' ? 'Your self review' : `${KIND[task.kind]} for ${task.employeeName}`;
  return (
    <Dialog open onClose={onClose} title={title} size="lg" hasUnsavedChanges={Object.values(form).some(Boolean)}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={submit.isPending} onClick={() => submit.mutate()}>Submit</Button></>}>
      <p style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{task.cycleName}. You can't edit a review after submitting it.{task.kind === 'PEER' && ' Your name is not shown to the employee.'}</p>
      <FormField as="select" label="Rating" value={form.rating} onChange={set('rating')}>
        <option value="">No rating</option>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{ratingLabel(n)}</option>)}
      </FormField>
      <FormField as="textarea" rows={3} label="What went well" value={form.strengths} onChange={set('strengths')} maxLength={5000} />
      <FormField as="textarea" rows={3} label="What could be better" value={form.improvements} onChange={set('improvements')} maxLength={5000} />
      <FormField as="textarea" rows={2} label="Anything else" value={form.comments} onChange={set('comments')} maxLength={5000} />
    </Dialog>
  );
}

function Responses({ responses }) {
  if (!responses?.length) return null;
  return (
    <div className="d-flex flex-column gap-2 mt-2">
      {responses.filter((r) => r.status === 'SUBMITTED').map((r) => (
        <div key={r.id} className="p-2" style={{ background: 'var(--hz-surface-muted, var(--hz-gray-50))', borderRadius: 8, fontSize: 13 }}>
          <div className="d-flex justify-content-between"><strong>{KIND[r.kind]}{r.kind !== 'SELF' && r.reviewerName ? ` · ${r.reviewerName}` : ''}</strong><Stars value={r.rating} /></div>
          {r.strengths && <div><em>Went well:</em> {r.strengths}</div>}
          {r.improvements && <div><em>Could be better:</em> {r.improvements}</div>}
          {r.comments && <div>{r.comments}</div>}
        </div>
      ))}
    </div>
  );
}

function MyResults() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['perf-my-reviews'], queryFn: perfApi.myReviews });
  const ack = useMutation({
    mutationFn: perfApi.acknowledgeReview,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['perf-my-reviews'] }); toast.success('Acknowledged.'); },
    onError: (e) => toast.error(errorText(e, 'Could not acknowledge.')),
  });
  if (isLoading) return <Card><SkeletonText lines={4} /></Card>;
  if (!(data || []).length) return <Card><EmptyState icon={Star} title="No reviews yet" description="When you're part of a review cycle it shows here." /></Card>;
  return data.map((p) => (
    <Card key={p.id} title={p.cycleName} actions={<Badge variant={PSTATUS[p.status]?.[1]}>{PSTATUS[p.status]?.[0]}</Badge>}>
      {p.status === 'RELEASED' ? (
        <>
          <div className="d-flex flex-wrap gap-4 mb-2" style={{ fontSize: 14 }}>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Final rating</div><strong style={{ fontSize: 20 }}>{ratingLabel(p.finalRating)}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Self</div><Stars value={p.selfRating} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Manager</div><Stars value={p.managerRating} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Peers (avg)</div><Stars value={p.peerAverage} /></div>
          </div>
          {p.calibrationNote && <p style={{ fontSize: 13 }}><strong>HR note:</strong> {p.calibrationNote}</p>}
          <Responses responses={p.responses} />
          <div className="mt-3">{p.acknowledgedAt ? <Badge variant="success">Acknowledged</Badge> : <Button size="sm" loading={ack.isPending} onClick={() => ack.mutate(p.id)}>Acknowledge</Button>}</div>
        </>
      ) : (
        <p className="mb-0" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>Your results will appear here once HR releases this cycle.</p>
      )}
    </Card>
  ));
}

function Cycles({ hr }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['perf-cycles'], queryFn: perfApi.cycles });
  const refresh = () => ['perf-cycles', 'perf-participants', 'perf-tasks'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const advance = useMutation({ mutationFn: perfApi.advanceCycle, onSuccess: (c) => { refresh(); toast.success(`Moved to ${STAGES[c.status][0].toLowerCase()}.`); }, onError: (e) => toast.error(errorText(e, 'Could not move the cycle.')) });
  const release = useMutation({ mutationFn: perfApi.releaseCycle, onSuccess: () => { refresh(); toast.success('Results released to employees.'); }, onError: (e) => toast.error(errorText(e, 'Could not release.')) });
  return (
    <>
      <Card title="Review cycles" actions={hr && <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>New cycle</Button>}>
        {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={ClipboardCheck} title="No cycles yet" description={hr ? 'Create a cycle to start reviews.' : 'Cycles your team is part of appear here.'} /> : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
              <thead><tr><th>Cycle</th><th>Stage</th><th className="text-end">People</th><th className="text-end">Self done</th><th className="text-end">Manager done</th><th>Ratings</th><th aria-label="Actions" /></tr></thead>
              <tbody>{data.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{c.periodStart} → {c.periodEnd}</div></td>
                  <td><Badge variant={STAGES[c.status][1]}>{STAGES[c.status][0]}</Badge></td>
                  <td className="text-end">{c.participants}</td>
                  <td className="text-end">{c.selfDone}</td>
                  <td className="text-end">{c.managerDone}</td>
                  <td style={{ fontSize: 12 }}>{Object.entries(c.ratingDistribution || {}).map(([k, v]) => `${k}★ ${v}`).join(' · ') || '—'}</td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <Button size="sm" variant="secondary" icon={Users} onClick={() => setOpen(c)}>People</Button>
                      {hr && NEXT[c.status] && <Button size="sm" variant="secondary" loading={advance.isPending} onClick={() => advance.mutate(c.id)}>{NEXT[c.status]}</Button>}
                      {hr && c.status === 'CALIBRATION' && (
                        <Button size="sm" loading={release.isPending} onClick={async () => {
                          if (await confirm({ title: 'Release results?', description: 'Employees will see their final rating and reviews. Missing final ratings use the manager rating.', confirmLabel: 'Release', irreversible: true })) release.mutate(c.id);
                        }}>Release</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <ParticipantsDialog cycle={open} hr={hr} onClose={() => setOpen(null)} />}
      {creating && <CreateCycleDialog onClose={() => setCreating(false)} onCreated={refresh} />}
    </>
  );
}

function CreateCycleDialog({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', periodStart: '', periodEnd: '', selfDue: '', managerDue: '', peerReviews: true, scope: 'ALL', employeeIds: [] });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const departments = [...new Set(people.map((p) => p.department).filter(Boolean))];
  const [department, setDepartment] = useState('');
  const create = useMutation({
    mutationFn: () => {
      const ids = form.scope === 'DEPARTMENT' ? people.filter((p) => p.department === department).map((p) => p.id) : form.employeeIds;
      return perfApi.createCycle({ ...form, scope: form.scope === 'ALL' ? 'ALL' : 'SELECTED', employeeIds: ids, selfDue: form.selfDue || null, managerDue: form.managerDue || null });
    },
    onSuccess: (c) => { onCreated(); toast.success(`${c.name} created with ${c.participants} people. Launch it when ready.`); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not create the cycle.')),
  });
  return (
    <Dialog open onClose={onClose} title="New review cycle" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
      <div className="row g-2">
        <FormField col={12} label="Name" value={form.name} onChange={set('name')} placeholder="e.g. Annual review 2026" maxLength={120} />
        <FormField col={6} type="date" label="Period from" value={form.periodStart} onChange={set('periodStart')} />
        <FormField col={6} type="date" label="Period to" value={form.periodEnd} onChange={set('periodEnd')} />
        <FormField col={6} type="date" label="Self reviews due" value={form.selfDue} onChange={set('selfDue')} />
        <FormField col={6} type="date" label="Manager reviews due" value={form.managerDue} onChange={set('managerDue')} />
        <FormField col={6} as="select" label="Who's included" value={form.scope} onChange={set('scope')}>
          <option value="ALL">Everyone</option>
          <option value="DEPARTMENT">One department</option>
          <option value="SELECTED">Selected people</option>
        </FormField>
        {form.scope === 'DEPARTMENT' && (
          <FormField col={6} as="select" label="Department" value={department} onChange={setDepartment}>
            <option value="">Choose…</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </FormField>
        )}
        {form.scope === 'SELECTED' && (
          <div className="col-12">
            <label className="form-label" htmlFor="cycle-people">People <span style={{ fontWeight: 400, color: 'var(--hz-text-muted)' }}>(Ctrl/Cmd-click to pick several)</span></label>
            <select id="cycle-people" className="form-select" multiple size={8} value={form.employeeIds.map(String)}
              onChange={(e) => setForm((f) => ({ ...f, employeeIds: [...e.target.selectedOptions].map((o) => Number(o.value)) }))}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.department ? ` · ${p.department}` : ''}</option>)}
            </select>
          </div>
        )}
        <div className="col-12">
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={form.peerReviews} onChange={(e) => set('peerReviews')(e.target.checked)} /> Collect peer feedback (managers choose peers)</label>
        </div>
      </div>
    </Dialog>
  );
}

function ParticipantsDialog({ cycle, hr, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['perf-participants', cycle.id], queryFn: () => perfApi.participants(cycle.id) });
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people, enabled: cycle.peerReviews });
  const [expanded, setExpanded] = useState(null);
  const [calibrating, setCalibrating] = useState(null);
  const [peerFor, setPeerFor] = useState(null);
  const [peerPick, setPeerPick] = useState('');
  const refresh = () => ['perf-participants', 'perf-cycles'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const calibrate = useMutation({
    mutationFn: ({ id, rating, note }) => perfApi.calibrate(id, rating ? Number(rating) : null, note),
    onSuccess: () => { refresh(); setCalibrating(null); toast.success('Final rating saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  const addPeer = useMutation({
    mutationFn: ({ id, peerId }) => perfApi.addPeers(id, [Number(peerId)]),
    onSuccess: () => { refresh(); setPeerPick(''); toast.success('Peer asked for feedback.'); },
    onError: (e) => toast.error(errorText(e, 'Could not add the peer.')),
  });
  const canCalibrate = hr && ['MANAGER_REVIEW', 'CALIBRATION'].includes(cycle.status);
  const canPeer = cycle.peerReviews && !['DRAFT', 'RELEASED'].includes(cycle.status);
  return (
    <Dialog open onClose={onClose} title={cycle.name} size="xl" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {isLoading ? <SkeletonText lines={5} /> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Status</th><th>Self</th><th>Peers</th><th>Manager</th><th>Final</th><th aria-label="Actions" /></tr></thead>
            <tbody>{(data || []).map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td><button type="button" className="btn btn-link p-0 text-start" onClick={() => setExpanded(expanded === p.id ? null : p.id)}><strong>{p.employeeName}</strong></button>
                    <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{p.designation || p.employeeCode}{p.managerName ? ` · reports to ${p.managerName}` : ''}</div></td>
                  <td><Badge variant={PSTATUS[p.status]?.[1]}>{PSTATUS[p.status]?.[0]}</Badge></td>
                  <td><Stars value={p.selfRating} /></td>
                  <td><Stars value={p.peerAverage} /></td>
                  <td><Stars value={p.managerRating} /></td>
                  <td><Stars value={p.finalRating} /></td>
                  <td className="text-end"><div className="d-flex gap-2 justify-content-end">
                    {canPeer && <Button size="sm" variant="secondary" onClick={() => setPeerFor(peerFor === p.id ? null : p.id)}>Peers</Button>}
                    {canCalibrate && <Button size="sm" variant="secondary" onClick={() => setCalibrating({ id: p.id, name: p.employeeName, rating: p.finalRating ?? p.managerRating ?? '', note: p.calibrationNote || '' })}>Calibrate</Button>}
                  </div></td>
                </tr>
                {peerFor === p.id && (
                  <tr><td colSpan={7}>
                    <div className="d-flex gap-2 align-items-end">
                      <FormField as="select" label={`Ask a colleague for feedback on ${p.employeeName}`} value={peerPick} onChange={setPeerPick}>
                        <option value="">Choose…</option>
                        {people.filter((x) => x.id !== p.employeeId && !p.responses.some((r) => r.kind === 'PEER' && r.reviewerName === x.name)).map((x) => <option key={x.id} value={x.id}>{x.name}{x.department ? ` · ${x.department}` : ''}</option>)}
                      </FormField>
                      <Button size="sm" disabled={!peerPick} loading={addPeer.isPending} onClick={() => addPeer.mutate({ id: p.id, peerId: peerPick })}>Ask</Button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Asked so far: {p.responses.filter((r) => r.kind === 'PEER').map((r) => `${r.reviewerName} (${r.status === 'SUBMITTED' ? 'done' : 'pending'})`).join(', ') || 'nobody'}</div>
                  </td></tr>
                )}
                {expanded === p.id && <tr><td colSpan={7}><Responses responses={p.responses} />{!p.responses.some((r) => r.status === 'SUBMITTED') && <span style={{ color: 'var(--hz-text-muted)' }}>No reviews submitted yet.</span>}</td></tr>}
              </Fragment>
            ))}</tbody>
          </table>
        </div>
      )}
      {calibrating && (
        <Dialog open onClose={() => setCalibrating(null)} title={`Final rating · ${calibrating.name}`} size="sm"
          footer={<><Button variant="secondary" onClick={() => setCalibrating(null)}>Cancel</Button><Button loading={calibrate.isPending} onClick={() => calibrate.mutate(calibrating)}>Save</Button></>}>
          <FormField type="number" label="Final rating (1–5)" min={1} max={5} step={0.5} value={calibrating.rating} onChange={(v) => setCalibrating((c) => ({ ...c, rating: v }))} />
          <FormField as="textarea" rows={3} label="Note to the employee (optional)" value={calibrating.note} onChange={(v) => setCalibrating((c) => ({ ...c, note: v }))} maxLength={1000} />
        </Dialog>
      )}
    </Dialog>
  );
}

