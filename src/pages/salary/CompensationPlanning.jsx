import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Plus } from 'lucide-react';
import { perfApi, errorText } from '../../api/endpoints/performanceSuite';
import { rupees } from '../../api/endpoints/fbp';
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

const DEFAULT_GUIDE = { 1: 0, 2: 3, 3: 6, 4: 10, 5: 15 };

/** Appraisal rounds: merit guideline by rating, budget tracking, per-person edits, then apply as salary revisions. */
export default function CompensationPlanning() {
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['comp-rounds'], queryFn: perfApi.compRounds });
  if (open) return <Round id={open} onBack={() => setOpen(null)} />;
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Compensation planning" description="Plan appraisal raises against a budget and apply them as salary revisions"
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New round</Button>} />
      <Card>
        {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? (
          <EmptyState icon={Calculator} title="No rounds yet" description="Start a round, link it to a released review cycle, and raises are suggested from each person's rating." />
        ) : (
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Round</th><th>Effective</th><th className="text-end">Budget</th><th className="text-end">Planned</th><th>Status</th><th aria-label="Open" /></tr></thead>
            <tbody>{data.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.effectiveFrom}</td>
                <td className="text-end">{c.budgetPercent}% · {rupees(c.budgetAmount)}/mo</td>
                <td className="text-end">{c.plannedPercent}% · {rupees(c.plannedIncrease)}/mo</td>
                <td><Badge variant={c.status === 'APPLIED' ? 'success' : 'warning'}>{c.status === 'APPLIED' ? 'Applied' : 'Planning'}</Badge></td>
                <td className="text-end"><Button size="sm" variant="secondary" onClick={() => setOpen(c.id)}>Open</Button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setOpen(c.id); }} />}
    </div>
  );
}

function GuideFields({ guide, onChange }) {
  return (
    <div className="row g-2">
      {[5, 4, 3, 2, 1].map((r) => (
        <FormField key={r} col={2} type="number" label={`${r}★ raise %`} min={0} max={100} step={0.5} value={guide[r]} onChange={(v) => onChange({ ...guide, [r]: v })} />
      ))}
    </div>
  );
}

const toGuide = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Number(v || 0)]));

function CreateDialog({ onClose, onCreated }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: cycles = [] } = useQuery({ queryKey: ['perf-cycles'], queryFn: perfApi.cycles });
  const [form, setForm] = useState({ name: '', effectiveFrom: '', budgetPercent: '8', performanceCycleId: '' });
  const [guide, setGuide] = useState(DEFAULT_GUIDE);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const create = useMutation({
    mutationFn: () => perfApi.createCompRound({ ...form, budgetPercent: Number(form.budgetPercent), performanceCycleId: form.performanceCycleId ? Number(form.performanceCycleId) : null, guidelines: toGuide(guide) }),
    onSuccess: (c) => { queryClient.invalidateQueries({ queryKey: ['comp-rounds'] }); toast.success(`${c.recommendations.length} recommendations prepared.`); onCreated(c); },
    onError: (e) => toast.error(errorText(e, 'Could not create the round.')),
  });
  return (
    <Dialog open onClose={onClose} title="New compensation round" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.name || !form.effectiveFrom} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
      <div className="row g-2">
        <FormField col={12} label="Name" value={form.name} onChange={set('name')} placeholder="e.g. Appraisal 2026" maxLength={120} />
        <FormField col={6} type="date" label="Raises effective from" value={form.effectiveFrom} onChange={set('effectiveFrom')} hint="A past date pays arrears automatically" />
        <FormField col={6} type="number" label="Budget (% of monthly payroll)" min={0} max={100} step={0.5} value={form.budgetPercent} onChange={set('budgetPercent')} />
        <FormField col={12} as="select" label="Use ratings from" value={form.performanceCycleId} onChange={set('performanceCycleId')} hint="Without a cycle, everyone starts at 0% and you set raises by hand">
          <option value="">No review cycle</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== 'RELEASED' ? ' (not released yet)' : ''}</option>)}
        </FormField>
      </div>
      <div className="mt-3"><strong style={{ fontSize: 13 }}>Merit guideline</strong></div>
      <GuideFields guide={guide} onChange={setGuide} />
    </Dialog>
  );
}

function Round({ id, onBack }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: c, isLoading } = useQuery({ queryKey: ['comp-round', id], queryFn: () => perfApi.compRound(id) });
  const [edits, setEdits] = useState({});
  const [guide, setGuide] = useState(null);
  const [result, setResult] = useState(null);
  const setData = (v) => { queryClient.setQueryData(['comp-round', id], v); queryClient.invalidateQueries({ queryKey: ['comp-rounds'] }); };
  const update = useMutation({
    mutationFn: ({ recId, pct, note }) => perfApi.updateRecommendation(id, recId, { proposedPercent: Number(pct), note }),
    onSuccess: (v, vars) => { setData(v); setEdits((e) => { const n = { ...e }; delete n[vars.recId]; return n; }); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  const regenerate = useMutation({
    mutationFn: () => perfApi.regenerateComp(id, toGuide(guide)),
    onSuccess: (v) => { setData(v); setGuide(null); toast.success('Guideline re-applied to everyone.'); },
    onError: (e) => toast.error(errorText(e, 'Could not re-apply.')),
  });
  const apply = useMutation({
    mutationFn: () => perfApi.applyComp(id),
    onSuccess: (r) => { setData(r.cycle); setResult(r); queryClient.invalidateQueries({ queryKey: ['salary-revisions'] }); toast.success(`${r.applied} salary revision${r.applied === 1 ? '' : 's'} created.`); },
    onError: (e) => toast.error(errorText(e, 'Could not apply.')),
  });
  if (isLoading || !c) return <Card><SkeletonText lines={6} /></Card>;
  const draft = c.status === 'DRAFT';
  const over = Number(c.plannedIncrease) > Number(c.budgetAmount);
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Compensation planning" title={c.name} description={`Effective ${c.effectiveFrom}`}
        actions={<><Button variant="secondary" onClick={onBack}>All rounds</Button>
          {draft && <Button loading={apply.isPending} onClick={async () => {
            if (await confirm({ title: 'Apply raises?', description: `This creates an appraisal salary revision for everyone with a raise (${rupees(c.plannedIncrease)}/month in total). Back-dated raises pay arrears with the next payroll.`, confirmLabel: 'Apply', variant: 'primary' })) apply.mutate();
          }}>Apply raises</Button>}</>} />
      <div className="row g-3">
        {[['Monthly payroll', rupees(c.currentPayroll)], ['Budget', `${c.budgetPercent}% · ${rupees(c.budgetAmount)}`], ['Planned', `${c.plannedPercent}% · ${rupees(c.plannedIncrease)}`], ['Remaining', rupees(Number(c.budgetAmount) - Number(c.plannedIncrease))]].map(([l, v], i) => (
          <div key={l} className="col-6 col-md-3"><Card><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{l}</div><strong style={{ fontSize: 18, color: i === 3 && over ? 'var(--hz-danger-600, #dc2626)' : undefined }}>{v}</strong></Card></div>
        ))}
      </div>
      {result && result.errors.length > 0 && (
        <Card title="Not applied">
          <ul className="mb-0" style={{ fontSize: 13 }}>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          <p className="mb-0 mt-2" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Fix these and press Apply again - people already done are skipped.</p>
        </Card>
      )}
      {draft && (
        <Card title="Merit guideline" actions={guide ? <div className="d-flex gap-2"><Button size="sm" variant="secondary" onClick={() => setGuide(null)}>Cancel</Button><Button size="sm" loading={regenerate.isPending} onClick={async () => {
          if (await confirm({ title: 'Re-apply guideline?', description: 'Every recommendation is recalculated; manual changes are replaced.', confirmLabel: 'Re-apply' })) regenerate.mutate();
        }}>Re-apply to everyone</Button></div> : <Button size="sm" variant="secondary" onClick={() => setGuide(c.guidelines)}>Edit</Button>}>
          {guide ? <GuideFields guide={guide} onChange={setGuide} />
            : <div style={{ fontSize: 13 }}>{Object.entries(c.guidelines).sort((a, b) => b[0] - a[0]).map(([k, v]) => `${k}★ → ${v}%`).join(' · ')}</div>}
        </Card>
      )}
      <Card title="Recommendations" subtitle={draft ? 'Change any raise; press Enter or leave the field to save' : 'Applied as salary revisions'}>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Rating</th><th className="text-end">Current gross</th><th className="text-end" style={{ width: 110 }}>Raise %</th><th className="text-end">New gross</th><th className="text-end">+/month</th><th>Note</th></tr></thead>
            <tbody>{c.recommendations.map((r) => {
              const pending = edits[r.id];
              const commit = () => { if (pending && (pending.pct !== String(r.proposedPercent) || pending.note !== (r.note || ''))) update.mutate({ recId: r.id, pct: pending.pct, note: pending.note }); };
              return (
                <tr key={r.id}>
                  <td><strong>{r.employeeName}</strong> <span style={{ color: 'var(--hz-text-muted)' }}>{r.employeeCode}</span>{r.department && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{r.department}</div>}</td>
                  <td>{r.rating != null ? `${Number(r.rating).toFixed(1)}★` : '—'}</td>
                  <td className="text-end">{rupees(r.currentGross)}</td>
                  <td className="text-end">{draft && !r.revisionId ? (
                    <input type="number" className="form-control form-control-sm text-end" min={0} max={100} step={0.5} aria-label={`Raise for ${r.employeeName}`}
                      value={pending ? pending.pct : r.proposedPercent}
                      onChange={(e) => setEdits((x) => ({ ...x, [r.id]: { pct: e.target.value, note: pending?.note ?? (r.note || '') } }))}
                      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
                  ) : `${r.proposedPercent}%`}</td>
                  <td className="text-end">{rupees(r.newGross)}</td>
                  <td className="text-end">{rupees(r.increment)}</td>
                  <td>{r.revisionId ? <Badge variant="success">Revised</Badge> : draft ? (
                    <input className="form-control form-control-sm" placeholder="Why (optional)" maxLength={500} aria-label={`Note for ${r.employeeName}`}
                      value={pending ? pending.note : r.note || ''}
                      onChange={(e) => setEdits((x) => ({ ...x, [r.id]: { pct: pending?.pct ?? String(r.proposedPercent), note: e.target.value } }))}
                      onBlur={commit} />
                  ) : r.note}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {!c.recommendations.length && <EmptyState icon={Calculator} title="Nobody to plan for" description="Only employees with a salary structure are included." />}
      </Card>
    </div>
  );
}
