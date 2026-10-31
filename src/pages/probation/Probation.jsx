import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck } from 'lucide-react';
import { probationApi, errorText } from '../../api/endpoints/workflows';
import { perfApi } from '../../api/endpoints/performanceSuite';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const STATUS = { ON_PROBATION: ['On probation', 'info'], MANAGER_REVIEW: ['Manager review due', 'warning'], HR_REVIEW: ['Waiting for HR', 'warning'], CONFIRMED: ['Confirmed', 'success'], NOT_CONFIRMED: ['Not confirmed', 'danger'] };
const REC = { CONFIRM: 'Confirm', EXTEND: 'Extend probation', NOT_CONFIRM: 'Do not confirm' };

/** Probation & confirmation: my status, my team's reviews (managers), and the company list (HR). */
export default function Probation() {
  const { hasPermission } = useAuth();
  const isHr = hasPermission('EMPLOYEE_MANAGE');
  const [starting, setStarting] = useState(false);
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="People" title="Probation & confirmation" description="Track probation end dates, collect manager recommendations and confirm employees"
        actions={isHr && <Button icon={Plus} onClick={() => setStarting(true)}>Set probation</Button>} />
      <Mine />
      {isHr && <SettingsCard />}
      <Reviews />
      {starting && <StartDialog onClose={() => setStarting(false)} />}
    </div>
  );
}

function Mine() {
  const { data } = useQuery({ queryKey: ['probation-me'], queryFn: probationApi.mine });
  if (!data) return null;
  return (
    <Card title="My probation" actions={<Badge variant={STATUS[data.status][1]}>{STATUS[data.status][0]}</Badge>}>
      <p className="mb-0" style={{ fontSize: 14 }}>
        {data.status === 'CONFIRMED' ? `You were confirmed${data.decidedAt ? ` on ${data.decidedAt.slice(0, 10)}` : ''}.`
          : data.status === 'NOT_CONFIRMED' ? 'HR has shared the outcome of your probation. Please speak to HR.'
            : `Your probation ends on ${data.probationEnd}${data.daysLeft >= 0 ? ` (${data.daysLeft} days to go)` : ''}.${data.extensions ? ` Extended ${data.extensions} time${data.extensions > 1 ? 's' : ''}.` : ''}`}
      </p>
      {data.hrNote && <p className="mt-2 mb-0" style={{ fontSize: 13 }}><strong>HR note:</strong> {data.hrNote}</p>}
    </Card>
  );
}

function SettingsCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['probation-settings'], queryFn: probationApi.settings, retry: false });
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const save = useMutation({
    mutationFn: () => probationApi.saveSettings({ ...form, defaultMonths: Number(form.defaultMonths), reviewWindowDays: Number(form.reviewWindowDays) }),
    onSuccess: (v) => { queryClient.setQueryData(['probation-settings'], v); queryClient.invalidateQueries({ queryKey: ['probation'] }); toast.success(v.enabled ? 'Saved. New joiners go on probation automatically.' : 'Saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  if (!form) return null;
  return (
    <Card title="Probation policy">
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-4">
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Put new joiners on probation automatically</label>
        </div>
        <FormField col={3} type="number" min={1} max={24} label="Probation length (months)" value={form.defaultMonths} onChange={(v) => setForm((f) => ({ ...f, defaultMonths: v }))} />
        <FormField col={3} type="number" min={1} max={90} label="Ask the manager (days before end)" value={form.reviewWindowDays} onChange={(v) => setForm((f) => ({ ...f, reviewWindowDays: v }))} />
        <div className="col-12 col-md-2"><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></div>
      </div>
    </Card>
  );
}

function Reviews() {
  const [filter, setFilter] = useState('OPEN');
  const { data, isLoading } = useQuery({ queryKey: ['probation'], queryFn: probationApi.list });
  const [action, setAction] = useState(null);
  if (!isLoading && !(data || []).length) return null;
  const rows = (data || []).filter((p) => filter === 'ALL' || (filter === 'OPEN' ? !['CONFIRMED', 'NOT_CONFIRMED'].includes(p.status) : ['MANAGER_REVIEW', 'HR_REVIEW'].includes(p.status)));
  return (
    <Card title="Probation reviews" actions={(
      <div className="btn-group" role="group">{[['OPEN', 'On probation'], ['DUE', 'Reviews due'], ['ALL', 'All']].map(([k, l]) => (
        <button key={k} type="button" className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(k)}>{l}</button>
      ))}</div>
    )}>
      {isLoading ? <SkeletonText lines={4} /> : !rows.length ? <EmptyState icon={UserCheck} title="Nothing here" description="No probations match this filter." /> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Joined</th><th>Probation ends</th><th>Status</th><th>Manager says</th><th aria-label="Actions" /></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.employeeName}</strong> <span style={{ color: 'var(--hz-text-muted)' }}>{p.employeeCode}</span><div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{p.designation}{p.managerName ? ` · reports to ${p.managerName}` : ''}</div></td>
                <td>{p.dateOfJoining}</td>
                <td>{p.probationEnd}{!['CONFIRMED', 'NOT_CONFIRMED'].includes(p.status) && <div style={{ fontSize: 11, color: p.daysLeft < 0 ? 'var(--hz-danger-600, #dc2626)' : 'var(--hz-text-muted)' }}>{p.daysLeft < 0 ? `${-p.daysLeft} days overdue` : `${p.daysLeft} days left`}</div>}</td>
                <td><Badge variant={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>{p.extensions > 0 && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>Extended ×{p.extensions}</div>}</td>
                <td>{p.managerRecommendation ? <span title={p.managerFeedback || ''}>{REC[p.managerRecommendation]}</span> : '—'}</td>
                <td className="text-end"><div className="d-flex gap-2 justify-content-end">
                  {p.canRecommend && <Button size="sm" variant={p.status === 'MANAGER_REVIEW' ? 'primary' : 'secondary'} onClick={() => setAction({ kind: 'recommend', p })}>Recommend</Button>}
                  {p.canDecide && <Button size="sm" variant={p.status === 'HR_REVIEW' ? 'primary' : 'secondary'} onClick={() => setAction({ kind: 'decide', p })}>Decide</Button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {action && <ActionDialog action={action} onClose={() => setAction(null)} />}
    </Card>
  );
}

function ActionDialog({ action, onClose }) {
  const { kind, p } = action;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ choice: p.managerRecommendation || 'CONFIRM', text: '', newEnd: '', issueLetter: true });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => (kind === 'recommend'
      ? probationApi.recommend(p.id, { recommendation: form.choice, feedback: form.text })
      : probationApi.decide(p.id, { decision: form.choice, note: form.text, newEnd: form.newEnd || null, issueLetter: form.choice === 'CONFIRM' && form.issueLetter })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['probation'] });
      toast.success(kind === 'recommend' ? 'Recommendation sent to HR.' : form.choice === 'CONFIRM' ? `${p.employeeName} is confirmed.` : form.choice === 'EXTEND' ? 'Probation extended.' : 'Outcome recorded.');
      onClose();
    },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  const ready = kind === 'recommend' ? form.text.trim() : form.choice !== 'EXTEND' || form.newEnd;
  return (
    <Dialog open onClose={onClose} title={`${kind === 'recommend' ? 'Recommendation' : 'Decision'} · ${p.employeeName}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      {kind === 'decide' && p.managerRecommendation && (
        <div className="p-2 px-3 mb-3" style={{ background: 'var(--hz-surface-muted, var(--hz-gray-50))', borderRadius: 8, fontSize: 13 }}>
          <strong>{p.managerName} recommends: {REC[p.managerRecommendation]}</strong>
          <div style={{ whiteSpace: 'pre-wrap' }}>{p.managerFeedback}</div>
        </div>
      )}
      <FormField as="select" label={kind === 'recommend' ? 'Your recommendation' : 'Decision'} value={form.choice} onChange={set('choice')}>
        {Object.entries(REC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </FormField>
      {kind === 'decide' && form.choice === 'EXTEND' && <FormField type="date" label="New probation end" value={form.newEnd} onChange={set('newEnd')} min={p.probationEnd} />}
      {kind === 'decide' && form.choice === 'CONFIRM' && (
        <label className="form-check d-inline-flex align-items-center gap-2 mb-2" style={{ fontSize: 13 }}>
          <input type="checkbox" className="form-check-input m-0" checked={form.issueLetter} onChange={(e) => set('issueLetter')(e.target.checked)} /> Issue the confirmation letter (from your letter templates)
        </label>
      )}
      <FormField as="textarea" rows={4} label={kind === 'recommend' ? 'Feedback on their probation' : 'Note to the employee (optional)'} value={form.text} onChange={set('text')} maxLength={kind === 'recommend' ? 5000 : 1000} />
    </Dialog>
  );
}

function StartDialog({ onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: people = [] } = useQuery({ queryKey: ['perf-people'], queryFn: perfApi.people });
  const [form, setForm] = useState({ employeeId: '', probationEnd: '' });
  const save = useMutation({
    mutationFn: () => probationApi.start({ employeeId: Number(form.employeeId), probationEnd: form.probationEnd }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['probation'] }); toast.success('Probation set.'); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  return (
    <Dialog open onClose={onClose} title="Set probation" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.employeeId || !form.probationEnd} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <FormField as="select" label="Employee" value={form.employeeId} onChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
        <option value="">Choose…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </FormField>
      <FormField type="date" label="Probation ends" value={form.probationEnd} onChange={(v) => setForm((f) => ({ ...f, probationEnd: v }))} />
    </Dialog>
  );
}
