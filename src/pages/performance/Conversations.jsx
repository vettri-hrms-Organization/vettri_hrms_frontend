import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Heart, MessageSquare, Plus, Send } from 'lucide-react';
import { perfApi, errorText } from '../../api/endpoints/performanceSuite';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import Tabs from '../../components/ui/Tabs';
import Avatar from '../../components/ui/Avatar';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const VALUES = ['Ownership', 'Customer first', 'Teamwork', 'Integrity', 'Innovation', 'Going the extra mile'];
const KIND = { PRAISE: ['Praise', 'success'], CONSTRUCTIVE: ['Suggestion', 'info'], REQUEST: ['Feedback request', 'warning'] };
const MEETING = { SCHEDULED: ['Scheduled', 'info'], COMPLETED: ['Completed', 'success'], CANCELLED: ['Cancelled', 'neutral'] };

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const ago = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Kudos wall, continuous feedback and 1:1 meetings. */
export default function Conversations() {
  const [tab, setTab] = useState('wall');
  const [giving, setGiving] = useState(false);
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Performance" title="Feedback & 1:1s" description="Recognise colleagues, share feedback and keep 1:1 notes in one place"
        actions={<Button icon={Heart} onClick={() => setGiving(true)}>Give feedback</Button>} />
      <Tabs items={[{ key: 'wall', label: 'Kudos wall' }, { key: 'feedback', label: 'My feedback' }, { key: 'meetings', label: '1:1s' }]} value={tab} onChange={setTab} />
      {tab === 'wall' && <Wall />}
      {tab === 'feedback' && <MyFeedback />}
      {tab === 'meetings' && <Meetings />}
      {giving && <GiveDialog onClose={() => setGiving(false)} />}
    </div>
  );
}

function FeedbackItem({ f, show = 'both' }) {
  return (
    <div className="d-flex gap-3 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
      <Avatar name={show === 'to' ? f.toName : f.fromName} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="d-flex flex-wrap gap-2 align-items-center" style={{ fontSize: 13 }}>
          {show === 'both' && <span><strong>{f.fromName}</strong> → <strong>{f.toName}</strong></span>}
          {show === 'from' && <strong>{f.fromName}</strong>}
          {show === 'to' && <span>To <strong>{f.toName}</strong></span>}
          <Badge variant={KIND[f.kind][1]}>{KIND[f.kind][0]}</Badge>
          {f.valueTag && <Badge variant="neutral">#{f.valueTag}</Badge>}
          {f.visibility === 'PRIVATE' && show !== 'both' && <span style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>Private</span>}
          <span style={{ fontSize: 11, color: 'var(--hz-text-muted)', marginLeft: 'auto' }}>{ago(f.createdAt)}</span>
        </div>
        <p className="mb-0 mt-1" style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{f.message}</p>
      </div>
    </div>
  );
}

function Wall() {
  const { data, isLoading } = useQuery({ queryKey: ['kudos-wall'], queryFn: perfApi.wall });
  return (
    <Card title="Kudos wall" subtitle="Public praise from across the company">
      {isLoading ? <SkeletonText lines={4} /> : !(data || []).length ? (
        <EmptyState icon={Heart} title="No kudos yet" description="Be the first - thank a colleague publicly with Give feedback." />
      ) : <div className="d-flex flex-column gap-2">{data.map((f) => <FeedbackItem key={f.id} f={f} />)}</div>}
    </Card>
  );
}

function MyFeedback() {
  const [view, setView] = useState('received');
  const { data: me } = useQuery({ queryKey: ['perf-me'], queryFn: perfApi.me });
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const [member, setMember] = useState('');
  const reports = people.filter((p) => (me?.reportIds || []).includes(p.id));
  const { data, isLoading } = useQuery({
    queryKey: ['feedback', view, member],
    queryFn: () => (view === 'given' ? perfApi.given() : view === 'team' ? perfApi.received(member) : perfApi.received()),
    enabled: view !== 'team' || !!member,
  });
  return (
    <Card title="Feedback" actions={(
      <div className="btn-group" role="group">
        {[['received', 'Received'], ['given', 'Given'], ...(reports.length ? [['team', 'My team']] : [])].map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm ${view === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>
    )}>
      {view === 'team' && (
        <div className="mb-3" style={{ maxWidth: 320 }}>
          <select className="form-select form-select-sm" value={member} onChange={(e) => setMember(e.target.value)} aria-label="Team member">
            <option value="">Choose a team member…</option>
            {reports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      {view === 'team' && !member ? null : isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? (
        <EmptyState icon={MessageSquare} title="Nothing here yet" description={view === 'given' ? 'Feedback you send appears here.' : 'Feedback from colleagues appears here.'} />
      ) : <div className="d-flex flex-column gap-2">{data.map((f) => <FeedbackItem key={f.id} f={f} show={view === 'given' ? 'to' : 'from'} />)}</div>}
    </Card>
  );
}

function GiveDialog({ onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['perf-me'], queryFn: perfApi.me });
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const [form, setForm] = useState({ toEmployeeId: '', kind: 'PRAISE', visibility: 'PUBLIC', valueTag: '', message: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const send = useMutation({
    mutationFn: () => perfApi.giveFeedback({ ...form, toEmployeeId: Number(form.toEmployeeId), valueTag: form.valueTag || null }),
    onSuccess: (f) => {
      ['kudos-wall', 'feedback'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(f.visibility === 'PUBLIC' ? 'Posted to the kudos wall.' : `Sent privately to ${f.toName}.`);
      onClose();
    },
    onError: (e) => toast.error(errorText(e, 'Could not send.')),
  });
  return (
    <Dialog open onClose={onClose} title="Give feedback" hasUnsavedChanges={!!form.message}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Send} disabled={!form.toEmployeeId || !form.message.trim()} loading={send.isPending} onClick={() => send.mutate()}>Send</Button></>}>
      <FormField as="select" label="To" value={form.toEmployeeId} onChange={set('toEmployeeId')}>
        <option value="">Choose a colleague…</option>
        {people.filter((p) => p.id !== me?.employeeId).map((p) => <option key={p.id} value={p.id}>{p.name}{p.designation ? ` · ${p.designation}` : ''}</option>)}
      </FormField>
      <FormField as="select" label="Type" value={form.kind} onChange={set('kind')}>
        <option value="PRAISE">Praise - say thanks or recognise great work</option>
        <option value="CONSTRUCTIVE">Suggestion - something they could do better</option>
        <option value="REQUEST">Ask for their feedback on your work</option>
      </FormField>
      {form.kind === 'PRAISE' && (
        <>
          <FormField as="select" label="Who can see it" value={form.visibility} onChange={set('visibility')}>
            <option value="PUBLIC">Everyone (kudos wall)</option>
            <option value="PRIVATE">Only them, their manager and HR</option>
          </FormField>
          <FormField as="select" label="Value shown (optional)" value={form.valueTag} onChange={set('valueTag')}>
            <option value="">—</option>
            {VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
          </FormField>
        </>
      )}
      {form.kind !== 'PRAISE' && <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>This stays private: only they, their manager and HR can see it.</p>}
      <FormField as="textarea" rows={4} label="Message" value={form.message} onChange={set('message')} maxLength={2000} placeholder="Be specific - what did they do and what difference did it make?" />
    </Dialog>
  );
}

function Meetings() {
  const { data: me } = useQuery({ queryKey: ['perf-me'], queryFn: perfApi.me });
  const { data, isLoading } = useQuery({ queryKey: ['one-on-ones'], queryFn: perfApi.meetings });
  const [scheduling, setScheduling] = useState(false);
  const [open, setOpen] = useState(null);
  const canSchedule = me?.hr || (me?.reportIds || []).length > 0;
  const upcoming = (data || []).filter((m) => m.status === 'SCHEDULED');
  const past = (data || []).filter((m) => m.status !== 'SCHEDULED');
  const row = (m) => (
    <button key={m.id} type="button" className="d-flex w-100 align-items-center justify-content-between gap-3 p-3 text-start bg-transparent" style={{ border: '1px solid var(--hz-border)', borderRadius: 10, color: 'inherit' }} onClick={() => setOpen(m.id)}>
      <div>
        <strong>{m.iAmManager ? m.employeeName : m.managerName}</strong>
        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{when(m.scheduledAt)}{m.agenda ? ` · ${m.agenda.split('\n')[0].slice(0, 80)}` : ''}</div>
      </div>
      <Badge variant={MEETING[m.status][1]}>{MEETING[m.status][0]}</Badge>
    </button>
  );
  return (
    <Card title="1:1 meetings" actions={canSchedule && <Button size="sm" icon={Plus} onClick={() => setScheduling(true)}>Schedule</Button>}>
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? (
        <EmptyState icon={CalendarClock} title="No 1:1s yet" description={canSchedule ? 'Schedule a 1:1 with someone in your team.' : 'When your manager schedules a 1:1 it appears here, and you can add topics to the agenda.'} />
      ) : (
        <div className="d-flex flex-column gap-2">
          {upcoming.length > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--hz-text-muted)' }}>UPCOMING</div>}
          {upcoming.map(row)}
          {past.length > 0 && <div className="mt-2" style={{ fontSize: 12, fontWeight: 600, color: 'var(--hz-text-muted)' }}>PAST</div>}
          {past.map(row)}
        </div>
      )}
      {scheduling && <ScheduleDialog me={me} onClose={() => setScheduling(false)} />}
      {open && data?.find((m) => m.id === open) && <MeetingDialog meeting={data.find((m) => m.id === open)} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function ScheduleDialog({ me, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const choices = people.filter((p) => p.id !== me?.employeeId && (me?.hr || (me?.reportIds || []).includes(p.id)));
  const [form, setForm] = useState({ employeeId: '', scheduledAt: '', agenda: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => perfApi.scheduleMeeting({ employeeId: Number(form.employeeId), scheduledAt: form.scheduledAt.length === 16 ? `${form.scheduledAt}:00` : form.scheduledAt, agenda: form.agenda }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['one-on-ones'] }); toast.success('1:1 scheduled.'); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not schedule.')),
  });
  return (
    <Dialog open onClose={onClose} title="Schedule a 1:1"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.employeeId || !form.scheduledAt} loading={save.isPending} onClick={() => save.mutate()}>Schedule</Button></>}>
      <FormField as="select" label="With" value={form.employeeId} onChange={set('employeeId')}>
        <option value="">Choose…</option>
        {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </FormField>
      <FormField type="datetime-local" label="When" value={form.scheduledAt} onChange={set('scheduledAt')} />
      <FormField as="textarea" rows={3} label="Agenda (optional)" value={form.agenda} onChange={set('agenda')} maxLength={5000} />
    </Dialog>
  );
}

function MeetingDialog({ meeting, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ agenda: meeting.agenda || '', sharedNotes: meeting.sharedNotes || '', privateNotes: meeting.privateNotes || '', actionItems: meeting.actionItems || '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['one-on-ones'] });
  const save = useMutation({
    mutationFn: () => perfApi.updateMeeting(meeting.id, meeting.iAmManager ? form : { agenda: form.agenda, sharedNotes: form.sharedNotes, actionItems: form.actionItems }),
    onSuccess: () => { refresh(); toast.success('Saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  const status = useMutation({
    mutationFn: async (s) => { await perfApi.updateMeeting(meeting.id, form); return perfApi.meetingStatus(meeting.id, s); },
    onSuccess: (m) => { refresh(); toast.success(m.status === 'COMPLETED' ? '1:1 marked complete.' : '1:1 cancelled.'); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not update.')),
  });
  const other = meeting.iAmManager ? meeting.employeeName : meeting.managerName;
  const closed = meeting.status !== 'SCHEDULED';
  return (
    <Dialog open onClose={onClose} title={`1:1 with ${other}`} description={when(meeting.scheduledAt)} size="lg"
      footer={(
        <>
          {meeting.iAmManager && !closed && <Button variant="secondary" onClick={() => status.mutate('CANCELLED')}>Cancel 1:1</Button>}
          <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
          {meeting.iAmManager && !closed && <Button loading={status.isPending} onClick={() => status.mutate('COMPLETED')}>Mark complete</Button>}
        </>
      )}>
      <FormField as="textarea" rows={3} label="Agenda" hint="Both of you can add topics" value={form.agenda} onChange={set('agenda')} maxLength={5000} />
      <FormField as="textarea" rows={4} label="Shared notes" value={form.sharedNotes} onChange={set('sharedNotes')} maxLength={10000} />
      <FormField as="textarea" rows={3} label="Action items" value={form.actionItems} onChange={set('actionItems')} maxLength={5000} />
      {meeting.iAmManager && <FormField as="textarea" rows={3} label="Private notes" hint={`Only you can see these - not ${meeting.employeeName}`} value={form.privateNotes} onChange={set('privateNotes')} maxLength={10000} />}
    </Dialog>
  );
}
