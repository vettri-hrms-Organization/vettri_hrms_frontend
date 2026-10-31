import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Plus, Trash2, X } from 'lucide-react';
import { perfApi, currentQuarter, errorText } from '../../api/endpoints/performanceSuite';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const STATUS = { ON_TRACK: ['On track', 'success'], AT_RISK: ['At risk', 'warning'], OFF_TRACK: ['Off track', 'danger'], DONE: ['Done', 'info'], DROPPED: ['Dropped', 'neutral'] };
const LEVEL = { COMPANY: 'Company', DEPARTMENT: 'Department', PERSONAL: 'Personal' };

function periods() {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].flatMap((yr) => [`${yr}-Q1`, `${yr}-Q2`, `${yr}-Q3`, `${yr}-Q4`, `${yr}-H1`, `${yr}-H2`, `${yr}`]);
}

/** OKRs for a period: company, department and personal objectives with measurable key results. */
export default function Okrs() {
  const [period, setPeriod] = useState(currentQuarter());
  const [filter, setFilter] = useState('ALL');
  const [creating, setCreating] = useState(false);
  const { data: me } = useQuery({ queryKey: ['perf-me'], queryFn: perfApi.me });
  const { data, isLoading } = useQuery({ queryKey: ['okrs', period], queryFn: () => perfApi.okrs(period) });
  const rows = useMemo(() => (data || []).filter((o) => {
    if (filter === 'MINE') return o.ownerEmployeeId === me?.employeeId;
    if (filter === 'TEAM') return (me?.reportIds || []).includes(o.ownerEmployeeId);
    if (filter === 'COMPANY') return o.level !== 'PERSONAL';
    return true;
  }), [data, filter, me]);
  const avg = rows.length ? rows.reduce((s, o) => s + Number(o.progress), 0) / rows.length : 0;
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Performance" title="OKRs" description="Objectives and key results, aligned from company to team to you"
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New objective</Button>} />
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <select className="form-select form-select-sm" style={{ width: 130 }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          {periods().map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="btn-group" role="group" aria-label="Show">
          {[['ALL', 'All'], ['COMPANY', 'Company & department'], ['MINE', 'Mine'], ...((me?.reportIds || []).length ? [['TEAM', 'My team']] : [])].map(([k, l]) => (
            <button key={k} type="button" className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {rows.length > 0 && <span style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{rows.length} objective{rows.length === 1 ? '' : 's'} · average progress {avg.toFixed(0)}%</span>}
      </div>
      {isLoading ? <Card><SkeletonText lines={5} /></Card> : !rows.length ? (
        <Card><EmptyState icon={Flag} title={`No objectives for ${period}`} description="Add an objective and break it into 2–5 measurable key results." /></Card>
      ) : rows.map((o) => <Objective key={o.id} o={o} all={data} period={period} />)}
      {creating && <CreateDialog period={period} me={me} objectives={data || []} onClose={() => setCreating(false)} />}
    </div>
  );
}

function Progress({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = v >= 70 ? 'var(--hz-success-500, #16a34a)' : v >= 40 ? 'var(--hz-warning-500, #f59e0b)' : 'var(--hz-danger-500, #dc2626)';
  return (
    <div className="d-flex align-items-center gap-2" style={{ minWidth: 140 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--hz-gray-200)', borderRadius: 4, overflow: 'hidden' }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${v}%`, height: '100%', background: tone }} />
      </div>
      <strong style={{ fontSize: 12, width: 40, textAlign: 'right' }}>{v.toFixed(0)}%</strong>
    </div>
  );
}

function useOkrMutation(fn, period, message) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['okrs', period] }); if (message) toast.success(message); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
}

function Objective({ o, all, period }) {
  const confirm = useConfirm();
  const [checking, setChecking] = useState(null);
  const [adding, setAdding] = useState(false);
  const parent = o.parentId ? (all || []).find((x) => x.id === o.parentId) : null;
  const status = useOkrMutation(({ id, s }) => perfApi.okrStatus(id, s), period, 'Status updated.');
  const remove = useOkrMutation((id) => perfApi.deleteOkr(id), period, 'Objective deleted.');
  const removeKr = useOkrMutation((id) => perfApi.removeKeyResult(id), period, 'Key result removed.');
  const owner = o.level === 'PERSONAL' ? o.ownerName : o.level === 'DEPARTMENT' ? o.departmentName || 'Department' : 'Company';
  return (
    <Card
      title={<span>{o.title} <Badge variant="neutral" className="ms-1">{LEVEL[o.level]}</Badge></span>}
      subtitle={`${owner || ''}${parent ? ` · supports “${parent.title}”` : ''}`}
      actions={(
        <div className="d-flex gap-2 align-items-center">
          {o.canEdit ? (
            <select className="form-select form-select-sm" style={{ width: 120 }} value={o.status} onChange={(e) => status.mutate({ id: o.id, s: e.target.value })} aria-label="Status">
              {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
          ) : <Badge variant={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge>}
          {o.canEdit && (
            <button type="button" className="btn btn-sm btn-light border-0" aria-label="Delete objective" onClick={async () => {
              if (await confirm({ title: 'Delete this objective?', description: 'Its key results and check-ins go with it.', confirmLabel: 'Delete' })) remove.mutate(o.id);
            }}><Trash2 size={14} /></button>
          )}
        </div>
      )}>
      {o.description && <p style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{o.description}</p>}
      <div className="mb-3"><Progress value={o.progress} /></div>
      {o.keyResults.length === 0 ? <p style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>No key results yet.</p> : (
        <table className="table table-sm align-middle mb-2" style={{ fontSize: 13 }}>
          <thead><tr><th>Key result</th><th className="text-end">Current / target</th><th>Progress</th><th aria-label="Actions" /></tr></thead>
          <tbody>{o.keyResults.map((k) => (
            <tr key={k.id}>
              <td>{k.title}{k.lastNote && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>“{k.lastNote}”</div>}</td>
              <td className="text-end">{Number(k.currentValue).toLocaleString('en-IN')} / {Number(k.targetValue).toLocaleString('en-IN')} {k.unit || ''}</td>
              <td><Progress value={k.progress} /></td>
              <td className="text-end">{o.canEdit && (
                <div className="d-flex gap-1 justify-content-end">
                  <Button size="sm" variant="secondary" onClick={() => setChecking({ ...k, value: k.currentValue, note: '' })}>Check in</Button>
                  <button type="button" className="btn btn-sm btn-light border-0" aria-label={`Remove ${k.title}`} onClick={() => removeKr.mutate(k.id)}><X size={14} /></button>
                </div>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {o.canEdit && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>Key result</Button>}
      {checking && <CheckInDialog kr={checking} period={period} onClose={() => setChecking(null)} />}
      {adding && <KeyResultDialog objectiveId={o.id} period={period} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function CheckInDialog({ kr, period, onClose }) {
  const [value, setValue] = useState(kr.value);
  const [note, setNote] = useState('');
  const save = useOkrMutation(() => perfApi.checkIn(kr.id, { currentValue: Number(value), note }), period, 'Progress updated.');
  return (
    <Dialog open onClose={onClose} title={kr.title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Save</Button></>}>
      <FormField type="number" label={`Current value${kr.unit ? ` (${kr.unit})` : ''}`} value={value} onChange={setValue} hint={`Started at ${kr.startValue}, target ${kr.targetValue}`} />
      <FormField as="textarea" rows={2} label="What changed? (optional)" value={note} onChange={setNote} maxLength={500} />
    </Dialog>
  );
}

const emptyKr = () => ({ title: '', startValue: '0', targetValue: '', unit: '' });
const krBody = (k) => ({ title: k.title, startValue: Number(k.startValue || 0), targetValue: Number(k.targetValue), unit: k.unit || null });

function KeyResultFields({ kr, onChange }) {
  const set = (key) => (v) => onChange({ ...kr, [key]: v });
  return (
    <div className="row g-2">
      <FormField col={12} label="Key result" value={kr.title} onChange={set('title')} placeholder="e.g. Close 10 enterprise deals" maxLength={200} />
      <FormField col={4} type="number" label="Start" value={kr.startValue} onChange={set('startValue')} />
      <FormField col={4} type="number" label="Target" value={kr.targetValue} onChange={set('targetValue')} />
      <FormField col={4} label="Unit" value={kr.unit} onChange={set('unit')} placeholder="deals, %, ₹" maxLength={20} />
    </div>
  );
}

function KeyResultDialog({ objectiveId, period, onClose }) {
  const [kr, setKr] = useState(emptyKr());
  const save = useOkrMutation(() => perfApi.addKeyResult(objectiveId, krBody(kr)), period, 'Key result added.');
  return (
    <Dialog open onClose={onClose} title="Add key result"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!kr.title || kr.targetValue === ''} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Add</Button></>}>
      <KeyResultFields kr={kr} onChange={setKr} />
    </Dialog>
  );
}

function CreateDialog({ period, me, objectives, onClose }) {
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const [form, setForm] = useState({ level: 'PERSONAL', ownerEmployeeId: '', department: '', title: '', description: '', parentId: '' });
  const [krs, setKrs] = useState([emptyKr()]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const departments = useMemo(() => {
    const map = new Map();
    people.forEach((p) => { if (p.departmentId) map.set(p.departmentId, p.department); });
    return [...map.entries()];
  }, [people]);
  const owners = people.filter((p) => p.id === me?.employeeId || me?.hr || (me?.reportIds || []).includes(p.id));
  const save = useOkrMutation(() => perfApi.createOkr({
    level: form.level,
    period,
    title: form.title,
    description: form.description,
    ownerEmployeeId: form.ownerEmployeeId ? Number(form.ownerEmployeeId) : null,
    departmentId: form.level === 'DEPARTMENT' && form.department ? Number(form.department) : null,
    parentId: form.parentId ? Number(form.parentId) : null,
    keyResults: krs.filter((k) => k.title && k.targetValue !== '').map(krBody),
  }), period, 'Objective created.');
  const parents = objectives.filter((o) => o.level !== 'PERSONAL' || form.level === 'PERSONAL');
  return (
    <Dialog open onClose={onClose} title={`New objective · ${period}`} size="lg" hasUnsavedChanges={!!form.title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.title} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>Create</Button></>}>
      <div className="row g-2">
        {me?.hr && (
          <FormField col={6} as="select" label="Level" value={form.level} onChange={set('level')}>
            <option value="PERSONAL">Personal</option>
            <option value="DEPARTMENT">Department</option>
            <option value="COMPANY">Company</option>
          </FormField>
        )}
        {form.level === 'PERSONAL' && owners.length > 1 && (
          <FormField col={6} as="select" label="Owner" value={form.ownerEmployeeId} onChange={set('ownerEmployeeId')}>
            <option value="">Me</option>
            {owners.filter((p) => p.id !== me?.employeeId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FormField>
        )}
        {form.level === 'DEPARTMENT' && <DepartmentPicker value={form.department} onChange={set('department')} names={departments} />}
        <FormField col={12} label="Objective" value={form.title} onChange={set('title')} placeholder="e.g. Become the go-to HRMS for mid-size firms" maxLength={200} />
        <FormField col={12} as="textarea" rows={2} label="Why it matters (optional)" value={form.description} onChange={set('description')} maxLength={1000} />
        {parents.length > 0 && (
          <FormField col={12} as="select" label="Supports (optional)" value={form.parentId} onChange={set('parentId')}>
            <option value="">—</option>
            {parents.map((o) => <option key={o.id} value={o.id}>{LEVEL[o.level]}: {o.title}</option>)}
          </FormField>
        )}
      </div>
      <hr />
      <strong style={{ fontSize: 13 }}>Key results</strong>
      {krs.map((k, i) => (
        <div key={i} className="mt-2 p-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 8 }}>
          <KeyResultFields kr={k} onChange={(v) => setKrs((all) => all.map((x, j) => (j === i ? v : x)))} />
        </div>
      ))}
      {krs.length < 5 && <Button className="mt-2" size="sm" variant="secondary" icon={Plus} onClick={() => setKrs((all) => [...all, emptyKr()])}>Another key result</Button>}
    </Dialog>
  );
}

function DepartmentPicker({ value, onChange, names }) {
  return (
    <FormField col={6} as="select" label="Department" value={value} onChange={onChange}>
      <option value="">Choose…</option>
      {names.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </FormField>
  );
}
