import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, ClipboardCheck, DoorOpen, Star } from 'lucide-react';
import { RATING_QUESTIONS, RESIGNATION_STATUS, fmtDate, resignationsApi } from '../../api/endpoints/resignations';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const errorText = (error, fallback) => error?.response?.data?.message || fallback;

/** Employee self-service resignation: resign, track it, withdraw, and complete the exit interview. */
export default function MyResignation({ embedded = false } = {}) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['my-resignation'], queryFn: resignationsApi.mine });
  const store = (view) => queryClient.setQueryData(['my-resignation'], view);

  if (isError) return <ErrorState description="Couldn't load your resignation details." onRetry={refetch} />;
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      {!embedded && <PageHeader eyebrow="My workspace" title="Resignation" description="Resign, follow its approval, and complete your exit interview" />}
      {isLoading || !data ? <Card><SkeletonText lines={5} /></Card> : (
        <>
          {data.current ? <CurrentResignation resignation={data.current} onChange={store} /> : <ResignForm view={data} onDone={store} />}
          {data.history.length > 0 && (
            <Card title="Earlier requests">
              <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                {data.history.map((r) => (
                  <li key={r.id} className="d-flex justify-content-between align-items-center gap-3 p-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 10, fontSize: 14 }}>
                    <span>{fmtDate(r.resignationDate)} · {r.reasonCategory}{(r.managerNote || r.hrNote) ? ` · “${r.hrNote || r.managerNote}”` : ''}</span>
                    <Badge variant={(RESIGNATION_STATUS[r.status] || {}).variant || 'neutral'}>{(RESIGNATION_STATUS[r.status] || {}).label || r.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ResignForm({ view, onDone }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ reasonCategory: '', reason: '', requestedLastWorkingDate: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = useMutation({
    mutationFn: () => resignationsApi.submit({ ...form, requestedLastWorkingDate: form.requestedLastWorkingDate || null }),
    onSuccess: (result) => { onDone(result); toast.success(view.settings.managerApproval ? 'Resignation sent to your manager.' : 'Resignation sent to HR.'); },
  });
  if (!view.canResign) {
    return <Card><p className="mb-0">{view.blockedReason}</p></Card>;
  }
  const notice = view.settings.noticePeriodDays;
  const early = form.requestedLastWorkingDate && form.requestedLastWorkingDate < view.policyLastWorkingDateIfToday;
  return (
    <Card title="Submit your resignation" subtitle={`Your notice period is ${notice} day${notice === 1 ? '' : 's'}. If you resign today, your last working day would be ${fmtDate(view.policyLastWorkingDateIfToday)}.`}>
      {submit.isError && <ErrorBanner>{errorText(submit.error, 'Could not submit your resignation.')}</ErrorBanner>}
      <form className="row g-3" onSubmit={async (e) => {
        e.preventDefault();
        if (await confirm({ title: 'Submit your resignation?', description: view.settings.managerApproval ? 'Your reporting manager and HR will be notified. You can withdraw it until it is accepted.' : 'HR will be notified. You can withdraw it until it is accepted.', confirmLabel: 'Submit resignation' })) submit.mutate();
      }}>
        <FormField col={6} as="select" label="Main reason" value={form.reasonCategory} onChange={(v) => set('reasonCategory', v)} required>
          <option value="">Choose…</option>
          {view.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </FormField>
        <FormField col={6} type="date" label="Preferred last working day (optional)" value={form.requestedLastWorkingDate} onChange={(v) => set('requestedLastWorkingDate', v)}
          hint={early ? 'Earlier than your notice period - HR decides whether to release you early.' : `Leave blank to serve the full notice (${fmtDate(view.policyLastWorkingDateIfToday)}).`} />
        <FormField col={12} as="textarea" rows={4} label="Anything you'd like to share (optional)" value={form.reason} onChange={(v) => set('reason', v)} maxLength={2000} />
        <div className="col-12 d-flex justify-content-end"><Button type="submit" variant="danger" icon={DoorOpen} loading={submit.isPending} disabled={!form.reasonCategory}>Submit resignation</Button></div>
      </form>
    </Card>
  );
}

function CurrentResignation({ resignation: r, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const withdraw = useMutation({
    mutationFn: () => resignationsApi.withdraw(r.id),
    onSuccess: (view) => { onChange(view); toast.success('Resignation withdrawn.'); },
    onError: (err) => toast.error(errorText(err, 'Could not withdraw it.')),
  });
  const status = RESIGNATION_STATUS[r.status] || {};
  const steps = [
    { label: 'Submitted', detail: fmtDate(r.resignationDate), done: true },
    ...(r.managerEmployeeId ? [{ label: `Manager${r.managerName ? ` (${r.managerName})` : ''}`, detail: r.managerDecisionAt ? `Approved ${fmtDate(r.managerDecisionAt)}` : 'Reviewing', done: !!r.managerDecisionAt }] : []),
    { label: 'HR', detail: r.hrDecisionAt ? `Accepted ${fmtDate(r.hrDecisionAt)}` : 'Waiting', done: r.status === 'ACCEPTED' },
    { label: 'Last working day', detail: fmtDate(r.approvedLastWorkingDate || r.requestedLastWorkingDate || r.policyLastWorkingDate), done: false },
  ];
  return (
    <>
      <Card title="Your resignation" actions={<Badge variant={status.variant}>{status.label}</Badge>}>
        <ol className="list-unstyled d-flex flex-column flex-md-row gap-3 mb-3">
          {steps.map((s) => (
            <li key={s.label} className="d-flex align-items-start gap-2 flex-fill">
              {s.done ? <CheckCircle2 size={20} style={{ color: 'var(--hz-success-500)', flexShrink: 0 }} aria-hidden="true" /> : <Circle size={20} style={{ color: 'var(--hz-text-muted)', flexShrink: 0 }} aria-hidden="true" />}
              <div><div style={{ fontWeight: 700 }}>{s.label}</div><div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{s.detail}</div></div>
            </li>
          ))}
        </ol>
        <div className="row g-2" style={{ fontSize: 14 }}>
          <div className="col-md-4"><span style={{ color: 'var(--hz-text-muted)' }}>Reason:</span> {r.reasonCategory}</div>
          <div className="col-md-4"><span style={{ color: 'var(--hz-text-muted)' }}>Notice period:</span> {r.noticePeriodDays} days (ends {fmtDate(r.policyLastWorkingDate)})</div>
          {r.status === 'ACCEPTED' && <div className="col-md-4"><span style={{ color: 'var(--hz-text-muted)' }}>Last working day:</span> <strong>{fmtDate(r.approvedLastWorkingDate)}</strong></div>}
        </div>
        {r.managerNote && <p className="mt-3 mb-0" style={{ fontSize: 14 }}><strong>Manager:</strong> {r.managerNote}</p>}
        {r.hrNote && <p className="mt-2 mb-0" style={{ fontSize: 14 }}><strong>HR:</strong> {r.hrNote}</p>}
        {r.canWithdraw && (
          <div className="mt-3 d-flex justify-content-end">
            <Button variant="secondary" loading={withdraw.isPending}
              onClick={async () => { if (await confirm({ title: 'Withdraw your resignation?', description: 'You will continue in your role as usual.', confirmLabel: 'Withdraw', variant: 'primary' })) withdraw.mutate(); }}>
              Withdraw resignation
            </Button>
          </div>
        )}
      </Card>
      {r.status === 'ACCEPTED' && (r.canTakeInterview ? <ExitInterview resignation={r} onDone={onChange} /> : r.interviewDone && (
        <Card><div className="d-flex align-items-center gap-2"><ClipboardCheck size={18} style={{ color: 'var(--hz-success-500)' }} aria-hidden="true" /> Thanks - your exit interview has been shared with HR.</div></Card>
      ))}
    </>
  );
}

function ExitInterview({ resignation, onDone }) {
  const toast = useToast();
  const [answers, setAnswers] = useState({});
  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));
  const save = useMutation({
    mutationFn: () => resignationsApi.exitInterview(resignation.id, answers),
    onSuccess: (view) => { onDone(view); toast.success('Thank you for your feedback.'); },
  });
  return (
    <Card title="Exit interview" subtitle="Your honest answers help us improve. HR reads these; your manager doesn't see them.">
      {save.isError && <ErrorBanner>{errorText(save.error, 'Could not save your answers.')}</ErrorBanner>}
      <div className="d-flex flex-column gap-3">
        {RATING_QUESTIONS.map(([key, label]) => (
          <div key={key} className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span style={{ fontWeight: 600 }}>{label}</span>
            <div role="radiogroup" aria-label={label} className="d-flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={answers[key] === n} aria-label={`${n} of 5`}
                  className="btn btn-sm p-1 border-0" onClick={() => set(key, n)}
                  style={{ color: answers[key] >= n ? 'var(--hz-warning-500)' : 'var(--hz-text-muted)' }}>
                  <Star size={22} fill={answers[key] >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {[['wouldRecommend', 'Would you recommend us as a place to work?'], ['wouldRejoin', 'Would you consider coming back in future?']].map(([key, label]) => (
          <div key={key} className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span style={{ fontWeight: 600 }}>{label}</span>
            <div className="btn-group" role="group" aria-label={label}>
              <button type="button" className={`btn btn-sm ${answers[key] === true ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => set(key, true)}>Yes</button>
              <button type="button" className={`btn btn-sm ${answers[key] === false ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => set(key, false)}>No</button>
            </div>
          </div>
        ))}
        <FormField as="textarea" rows={2} label="What did you like most here?" value={answers.likedMost || ''} onChange={(v) => set('likedMost', v)} maxLength={2000} />
        <FormField as="textarea" rows={2} label="What should we improve?" value={answers.improve || ''} onChange={(v) => set('improve', v)} maxLength={2000} />
        <FormField as="textarea" rows={2} label="Anything else?" value={answers.comments || ''} onChange={(v) => set('comments', v)} maxLength={2000} />
        <div className="d-flex justify-content-end"><Button loading={save.isPending} disabled={!Object.keys(answers).length} onClick={() => save.mutate()}>Submit exit interview</Button></div>
      </div>
    </Card>
  );
}
