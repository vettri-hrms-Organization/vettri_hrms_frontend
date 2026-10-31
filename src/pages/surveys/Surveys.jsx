import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ClipboardList, Lock, Plus, X } from 'lucide-react';
import { surveyApi, errorText } from '../../api/endpoints/workflows';
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
import { useConfirm } from '../../components/ui/ConfirmDialog';

const KIND = { SURVEY: 'Survey', POLL: 'Poll', ENPS: 'eNPS pulse' };
const STATUS = { DRAFT: ['Draft', 'neutral'], OPEN: ['Open', 'success'], CLOSED: ['Closed', 'neutral'] };
const QTYPES = { RATING: 'Rating 1–5', SCALE10: 'Scale 0–10', SINGLE: 'One choice', MULTI: 'Several choices', TEXT: 'Written answer' };

/** Surveys, polls and eNPS: answer the ones for you; HR builds, publishes and reads results. */
export default function Surveys() {
  const { hasPermission } = useAuth();
  const isHr = hasPermission('EMPLOYEE_MANAGE');
  const [tab, setTab] = useState('mine');
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Engage" title="Surveys & polls" description="Share what you think - anonymous surveys never record who answered" />
      {isHr && <Tabs items={[{ key: 'mine', label: 'For me' }, { key: 'manage', label: 'Manage' }]} value={tab} onChange={setTab} />}
      {tab === 'mine' ? <ForMe /> : <Manage />}
    </div>
  );
}

function ForMe() {
  const { data, isLoading } = useQuery({ queryKey: ['surveys-mine'], queryFn: surveyApi.mine });
  const [answering, setAnswering] = useState(null);
  const [results, setResults] = useState(null);
  if (isLoading) return <Card><SkeletonText lines={3} /></Card>;
  if (!(data || []).length) return <Card><EmptyState icon={ClipboardList} title="No surveys right now" description="When HR asks for your feedback, it shows up here." /></Card>;
  return (
    <div className="d-flex flex-column gap-3">
      {data.map((s) => (
        <Card key={s.id} title={s.title} subtitle={`${KIND[s.kind]}${s.closesOn ? ` · closes ${s.closesOn}` : ''}`}
          actions={s.answered ? <Badge variant="success">Answered</Badge> : <Button size="sm" onClick={() => setAnswering(s)}>Answer</Button>}>
          {s.description && <p style={{ fontSize: 14 }}>{s.description}</p>}
          <div className="d-flex gap-3 align-items-center" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
            {s.anonymous && <span><Lock size={12} /> Anonymous</span>}
            <span>{s.questions.length} question{s.questions.length === 1 ? '' : 's'}</span>
            {s.answered && s.resultsVisible && <Button size="sm" variant="secondary" icon={BarChart3} onClick={() => setResults(s)}>See results</Button>}
          </div>
        </Card>
      ))}
      {answering && <AnswerDialog survey={answering} onClose={() => setAnswering(null)} />}
      {results && <ResultsDialog survey={results} onClose={() => setResults(null)} />}
    </div>
  );
}

function AnswerDialog({ survey, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState({});
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const submit = useMutation({
    mutationFn: () => surveyApi.answer(survey.id, answers),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['surveys-mine'] }); toast.success('Thanks - your answers are in.'); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not submit.')),
  });
  const missing = survey.questions.some((q) => q.required && (answers[q.id] == null || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !answers[q.id].length)));
  return (
    <Dialog open onClose={onClose} title={survey.title} size="lg" hasUnsavedChanges={Object.keys(answers).length > 0}
      description={survey.anonymous ? 'Anonymous - your name is not stored with your answers.' : 'Your name is recorded with your answers.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={missing} loading={submit.isPending} onClick={() => submit.mutate()}>Submit</Button></>}>
      <div className="d-flex flex-column gap-4">
        {survey.questions.map((q, i) => (
          <fieldset key={q.id}>
            <legend style={{ fontSize: 14, fontWeight: 600 }}>{i + 1}. {q.text}{q.required && <span style={{ color: 'var(--hz-danger-600, #dc2626)' }}> *</span>}</legend>
            {(q.type === 'RATING' || q.type === 'SCALE10') && (
              <div className="d-flex flex-wrap gap-1" role="radiogroup" aria-label={q.text}>
                {(q.type === 'RATING' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={answers[q.id] === n} className={`btn btn-sm ${answers[q.id] === n ? 'btn-primary' : 'btn-outline-secondary'}`} style={{ minWidth: 38 }} onClick={() => set(q.id, n)}>{n}</button>
                ))}
                {q.type === 'SCALE10' && <div className="w-100 d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--hz-text-muted)', maxWidth: 470 }}><span>Not at all likely</span><span>Extremely likely</span></div>}
              </div>
            )}
            {q.type === 'SINGLE' && q.options.map((o) => (
              <label key={o} className="form-check d-flex gap-2 align-items-center" style={{ fontSize: 14 }}>
                <input type="radio" className="form-check-input m-0" name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} /> {o}
              </label>
            ))}
            {q.type === 'MULTI' && q.options.map((o) => (
              <label key={o} className="form-check d-flex gap-2 align-items-center" style={{ fontSize: 14 }}>
                <input type="checkbox" className="form-check-input m-0" checked={(answers[q.id] || []).includes(o)}
                  onChange={(e) => set(q.id, e.target.checked ? [...(answers[q.id] || []), o] : (answers[q.id] || []).filter((x) => x !== o))} /> {o}
              </label>
            ))}
            {q.type === 'TEXT' && <textarea className="form-control" rows={3} maxLength={2000} aria-label={q.text} value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />}
          </fieldset>
        ))}
      </div>
    </Dialog>
  );
}

function Manage() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['surveys'], queryFn: surveyApi.list });
  const [editing, setEditing] = useState(null);
  const [results, setResults] = useState(null);
  const act = useMutation({
    mutationFn: ({ fn, id }) => fn(id),
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ['surveys'] }); queryClient.invalidateQueries({ queryKey: ['surveys-mine'] }); toast.success(v.message); },
    onError: (e) => toast.error(errorText(e, 'Could not update.')),
  });
  return (
    <Card title="Surveys" actions={<div className="d-flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: 'ENPS', title: 'eNPS pulse', anonymous: true, questions: [] })}>New eNPS</Button>
      <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: 'POLL', title: '', anonymous: false, resultsVisible: true, questions: [{ id: 'q1', type: 'SINGLE', text: '', options: ['', ''], required: true }] })}>New poll</Button>
      <Button size="sm" icon={Plus} onClick={() => setEditing({ kind: 'SURVEY', title: '', anonymous: true, questions: [{ id: 'q1', type: 'RATING', text: '', options: [], required: true }] })}>New survey</Button>
    </div>}>
      {isLoading ? <SkeletonText lines={4} /> : !(data || []).length ? <EmptyState icon={ClipboardList} title="No surveys yet" description="Start with an eNPS pulse - two questions, fully anonymous." /> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Survey</th><th>Type</th><th>Status</th><th className="text-end">Responses</th><th aria-label="Actions" /></tr></thead>
            <tbody>{data.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.title}</strong>{s.anonymous && <Lock size={12} className="ms-1" aria-label="Anonymous" />}{s.closesOn && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>Closes {s.closesOn}</div>}</td>
                <td>{KIND[s.kind]}</td>
                <td><Badge variant={STATUS[s.status][1]}>{STATUS[s.status][0]}</Badge></td>
                <td className="text-end">{s.responses}</td>
                <td className="text-end"><div className="d-flex gap-2 justify-content-end">
                  {s.status === 'DRAFT' && <>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={async () => { if (await confirm({ title: 'Delete this draft?', confirmLabel: 'Delete' })) act.mutate({ fn: surveyApi.remove, id: s.id, message: 'Draft deleted.' }); }}>Delete</Button>
                    <Button size="sm" onClick={async () => { if (await confirm({ title: 'Publish now?', description: 'Everyone in the audience is notified, and questions can no longer be changed.', confirmLabel: 'Publish', variant: 'primary' })) act.mutate({ fn: surveyApi.publish, id: s.id, message: 'Published.' }); }}>Publish</Button>
                  </>}
                  {s.status !== 'DRAFT' && <Button size="sm" variant="secondary" icon={BarChart3} onClick={() => setResults(s)}>Results</Button>}
                  {s.status === 'OPEN' && <Button size="sm" variant="secondary" onClick={() => act.mutate({ fn: surveyApi.close, id: s.id, message: 'Closed.' })}>Close</Button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {editing && <BuilderDialog initial={editing} onClose={() => setEditing(null)} />}
      {results && <ResultsDialog survey={results} onClose={() => setResults(null)} />}
    </Card>
  );
}

function BuilderDialog({ initial, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [s, setS] = useState({ description: '', closesOn: '', resultsVisible: false, ...initial });
  const isEnps = s.kind === 'ENPS';
  const isPoll = s.kind === 'POLL';
  const extra = isEnps ? s.questions.filter((q) => !['enps', 'why'].includes(q.id)) : s.questions;
  const setQ = (i, patch) => setS((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const save = useMutation({
    mutationFn: () => surveyApi.save({ ...s, closesOn: s.closesOn || null, questions: s.questions.map((q) => ({ ...q, options: (q.options || []).filter((o) => o.trim()) })) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['surveys'] }); toast.success('Saved as draft. Publish it when ready.'); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  return (
    <Dialog open onClose={onClose} title={`${s.id ? 'Edit' : 'New'} ${KIND[s.kind].toLowerCase()}`} size="lg" hasUnsavedChanges
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!s.title.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save draft</Button></>}>
      <div className="row g-2">
        <FormField col={12} label="Title" value={s.title} onChange={(v) => setS((x) => ({ ...x, title: v }))} maxLength={200} />
        <FormField col={12} as="textarea" rows={2} label="Intro (optional)" value={s.description || ''} onChange={(v) => setS((x) => ({ ...x, description: v }))} maxLength={1000} />
        <FormField col={6} type="date" label="Closes on (optional)" value={s.closesOn || ''} onChange={(v) => setS((x) => ({ ...x, closesOn: v }))} />
        <div className="col-12 col-md-6 d-flex flex-column justify-content-end gap-1">
          <label className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 13 }}><input type="checkbox" className="form-check-input m-0" checked={s.anonymous} onChange={(e) => setS((x) => ({ ...x, anonymous: e.target.checked }))} /> Anonymous</label>
          <label className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 13 }}><input type="checkbox" className="form-check-input m-0" checked={s.resultsVisible} onChange={(e) => setS((x) => ({ ...x, resultsVisible: e.target.checked }))} /> Show results to people who answered</label>
        </div>
      </div>
      <hr />
      {isEnps && <p style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>Includes the standard eNPS question (0–10) and “What's the main reason for your score?”. Add more below if you like.</p>}
      {s.questions.map((q, i) => (isEnps && ['enps', 'why'].includes(q.id) ? null : (
        <div key={i} className="p-2 mb-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 8 }}>
          <div className="row g-2 align-items-end">
            <FormField col={7} label={`Question ${i + 1}`} value={q.text} onChange={(v) => setQ(i, { text: v })} maxLength={300} />
            {!isPoll ? (
              <FormField col={4} as="select" label="Answer type" value={q.type} onChange={(v) => setQ(i, { type: v, options: ['SINGLE', 'MULTI'].includes(v) ? (q.options?.length ? q.options : ['', '']) : [] })}>
                {Object.entries(QTYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </FormField>
            ) : (
              <FormField col={4} as="select" label="Answer type" value={q.type} onChange={(v) => setQ(i, { type: v })}>
                <option value="SINGLE">One choice</option><option value="MULTI">Several choices</option>
              </FormField>
            )}
            <div className="col-1">{!isPoll && extra.length > 1 && <button type="button" className="btn btn-sm btn-light border-0" aria-label="Remove question" onClick={() => setS((x) => ({ ...x, questions: x.questions.filter((_, j) => j !== i) }))}><X size={14} /></button>}</div>
          </div>
          {['SINGLE', 'MULTI'].includes(q.type) && (
            <div className="mt-2 d-flex flex-column gap-1">
              {(q.options || []).map((o, k) => (
                <div key={k} className="d-flex gap-2">
                  <input className="form-control form-control-sm" placeholder={`Option ${k + 1}`} value={o} maxLength={100} aria-label={`Option ${k + 1}`}
                    onChange={(e) => setQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                  {q.options.length > 2 && <button type="button" className="btn btn-sm btn-light border-0" aria-label="Remove option" onClick={() => setQ(i, { options: q.options.filter((_, m) => m !== k) })}><X size={14} /></button>}
                </div>
              ))}
              {q.options.length < 12 && <div><Button size="sm" variant="secondary" icon={Plus} onClick={() => setQ(i, { options: [...q.options, ''] })}>Option</Button></div>}
            </div>
          )}
          <label className="form-check d-inline-flex align-items-center gap-2 mt-2" style={{ fontSize: 12 }}><input type="checkbox" className="form-check-input m-0" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Required</label>
        </div>
      )))}
      {!isPoll && s.questions.length < 30 && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setS((x) => ({ ...x, questions: [...x.questions, { id: `q${Date.now()}`, type: 'RATING', text: '', options: [], required: false }] }))}>Question</Button>}
    </Dialog>
  );
}

function ResultsDialog({ survey, onClose }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['survey-results', survey.id], queryFn: () => surveyApi.results(survey.id) });
  return (
    <Dialog open onClose={onClose} title={`Results · ${survey.title}`} size="lg" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {isLoading ? <SkeletonText lines={5} /> : error ? <p>{errorText(error, 'Could not load results.')}</p> : (
        <>
          <p style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{data.responses} of {data.audience} people answered ({data.audience ? Math.round((data.responses / data.audience) * 100) : 0}%).</p>
          {data.hidden ? <EmptyState icon={Lock} title="Not enough answers yet" description={data.hiddenReason} /> : (
            <div className="d-flex flex-column gap-4">
              {data.questions.map((q, i) => <QuestionResult key={q.id} q={q} index={i} />)}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

function QuestionResult({ q, index }) {
  const total = q.counts ? Object.values(q.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{index + 1}. {q.text}</div>
      {q.enps != null && (
        <div className="my-2"><span style={{ fontSize: 28, fontWeight: 700, color: q.enps >= 0 ? 'var(--hz-success-600, #16a34a)' : 'var(--hz-danger-600, #dc2626)' }}>{q.enps > 0 ? '+' : ''}{q.enps}</span>
          <span className="ms-2" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>eNPS = % scoring 9–10 minus % scoring 0–6</span></div>
      )}
      {q.average != null && q.enps == null && <div style={{ fontSize: 13 }}>Average <strong>{q.average}</strong> from {q.answered} answers</div>}
      {q.counts && (
        <div className="d-flex flex-column gap-1 mt-2">
          {Object.entries(q.counts).map(([label, n]) => {
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={label} className="d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
                <span style={{ width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
                <div style={{ flex: 1, height: 10, background: 'var(--hz-gray-200)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--hz-primary-500, #4f46e5)' }} /></div>
                <span style={{ width: 70, textAlign: 'right' }}>{n} · {pct}%</span>
              </div>
            );
          })}
        </div>
      )}
      {q.comments && (q.comments.length ? (
        <ul className="mt-2 mb-0" style={{ fontSize: 13 }}>{q.comments.map((c, k) => <li key={k} style={{ whiteSpace: 'pre-wrap' }}>{c}</li>)}</ul>
      ) : <div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>No written answers.</div>)}
    </div>
  );
}
