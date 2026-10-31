import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Settings2 } from 'lucide-react';
import { RATING_QUESTIONS, RESIGNATION_STATUS, fmtDate, resignationsApi } from '../../api/endpoints/resignations';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import DataTable from '../../components/ui/DataTable';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';

const errorText = (error, fallback) => error?.response?.data?.message || fallback;
const QUESTION_LABEL = Object.fromEntries(RATING_QUESTIONS);
const lastDay = (r) => r.approvedLastWorkingDate || r.requestedLastWorkingDate || r.policyLastWorkingDate;

function resignationColumns(onOpen) {
  return [
    {
      key: 'employee', label: 'Employee', hideable: false,
      value: (r) => [r.employeeName, r.employeeCode, r.designation, r.departmentName].filter(Boolean).join(' '),
      exportValue: (r) => r.employeeName,
      render: (r) => <><div style={{ fontWeight: 700 }}>{r.employeeName}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{[r.employeeCode, r.designation, r.departmentName].filter(Boolean).join(' · ')}</div></>,
    },
    { key: 'departmentName', label: 'Department', defaultHidden: true },
    { key: 'resignationDate', label: 'Resigned on', searchable: false, render: (r) => fmtDate(r.resignationDate) },
    { key: 'reasonCategory', label: 'Reason' },
    {
      key: 'lastDay', label: 'Last working day', value: lastDay, searchable: false,
      render: (r) => <>{fmtDate(lastDay(r))}{!r.approvedLastWorkingDate && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{r.requestedLastWorkingDate ? 'requested' : 'per notice period'}</div>}</>,
    },
    {
      key: 'status', label: 'Status', value: (r) => RESIGNATION_STATUS[r.status]?.label || r.status,
      render: (r) => { const status = RESIGNATION_STATUS[r.status] || {}; return <Badge variant={status.variant}>{status.label}</Badge>; },
    },
    {
      key: 'actions', label: '', className: 'text-end', hideable: false, sortable: false, searchable: false, export: false,
      render: (r) => <Button size="sm" variant={r.canManagerReview || r.canHrReview ? 'primary' : 'secondary'} onClick={() => onOpen(r)}>{r.canManagerReview || r.canHrReview ? 'Review' : 'View'}</Button>,
    },
  ];
}

/** Resignations for HR (whole company, analytics, settings) and managers (their direct reports). */
export default function ExitsAdmin() {
  const { hasPermission } = useAuth();
  const isHr = hasPermission('EMPLOYEE_MANAGE');
  const [filter, setFilter] = useState('OPEN');
  const [open, setOpen] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['resignations', filter], queryFn: () => resignationsApi.list(filter === 'ALL' ? null : filter) });
  const summary = useQuery({ queryKey: ['resignation-summary'], queryFn: resignationsApi.summary, enabled: isHr });
  const rows = data || [];
  const s = summary.data;
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="People" title="Exits" description="Resignations, notice periods and exit interviews"
        actions={isHr && <Button variant="secondary" icon={Settings2} onClick={() => setShowSettings(true)}>Exit settings</Button>} />

      {isHr && s && (
        <div className="row g-3">
          {[['Waiting for manager', s.pendingManager], ['Waiting for HR', s.pendingHr], ['Serving notice', s.servingNotice], ['Exits in last 12 months', s.exitedLast12Months]].map(([label, value]) => (
            <div key={label} className="col-6 col-lg-3">
              <div className="h-100 p-3" style={{ background: 'var(--hz-bg-surface)', border: '1px solid var(--hz-border)', borderRadius: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--hz-text-muted)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--hz-text-primary)' }}>{value}</div>
              </div>
            </div>
          ))}
          <div className="col-12 col-lg-6">
            <Card title="Why people leave" subtitle="Accepted resignations, last 12 months">
              {Object.keys(s.reasonsLast12Months).length === 0 ? <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>No exits yet.</p> : (
                Object.entries(s.reasonsLast12Months).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                  <div key={reason} className="mb-2">
                    <div className="d-flex justify-content-between" style={{ fontSize: 13 }}><span>{reason}</span><strong>{count}</strong></div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--hz-gray-100)' }}>
                      <div style={{ width: `${(count / s.exitedLast12Months) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--hz-primary-500)' }} />
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
          <div className="col-12 col-lg-6">
            <Card title="Exit interview scores" subtitle={`${s.interviewsCompleted} completed · ${s.wouldRecommendPercent}% would recommend us`}>
              {Object.keys(s.averageRatings).length === 0 ? <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>No interviews yet.</p> : (
                Object.entries(s.averageRatings).map(([key, avg]) => (
                  <div key={key} className="d-flex justify-content-between py-1" style={{ fontSize: 14, borderBottom: '1px solid var(--hz-divider, var(--hz-border))' }}>
                    <span>{QUESTION_LABEL[key] || key}</span>
                    <strong style={{ color: avg < 3 ? 'var(--hz-danger-600)' : avg >= 4 ? 'var(--hz-success-600)' : undefined }}>{avg} / 5</strong>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}

      <Card title={isHr ? 'Resignations' : 'Resignations from your team'}
        actions={(
          <div className="btn-group" role="group" aria-label="Filter">
            {[['OPEN', 'In progress'], ['ALL', 'All']].map(([key, label]) => (
              <button key={key} type="button" className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
        )}>
        <DataTable
          columns={resignationColumns(setOpen)}
          rows={rows}
          isLoading={isLoading}
          ariaLabel="Resignations"
          storageKey="exits"
          searchPlaceholder="Search employee, code or reason"
          exportFileName={`resignations-${filter.toLowerCase()}`}
          initialSort={{ key: 'resignationDate', dir: 'desc' }}
          emptyIcon={DoorOpen}
          emptyTitle="No resignations"
          emptyDescription={filter === 'OPEN' ? 'Nobody is resigning right now.' : 'No resignations yet.'}
        />
      </Card>
      {open && <ResignationDialog resignation={open} onClose={() => setOpen(null)} />}
      {showSettings && <ExitSettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export function ResignationDialog({ resignation: r, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const defaultLwd = r.managerRecommendedLastWorkingDate || r.requestedLastWorkingDate || r.policyLastWorkingDate;
  const [note, setNote] = useState('');
  const [lwd, setLwd] = useState(defaultLwd);
  const done = (message) => () => {
    toast.success(message);
    ['resignations', 'resignation-summary', 'approvals-inbox', 'employee'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    onClose();
  };
  const onError = (err) => toast.error(errorText(err, 'Could not save.'));
  const approve = useMutation({ mutationFn: () => resignationsApi.approve(r.id, note, lwd), onSuccess: done(r.canHrReview ? 'Resignation accepted. The exit checklist has started.' : 'Approved and sent to HR.'), onError });
  const retain = useMutation({ mutationFn: () => resignationsApi.retain(r.id, note), onSuccess: done('Marked as retained. The employee has been told.'), onError });
  const cancel = useMutation({ mutationFn: () => resignationsApi.cancel(r.id, note), onSuccess: done('Resignation cancelled. The employee is active again.'), onError });
  const acting = r.canManagerReview || r.canHrReview;
  const busy = approve.isPending || retain.isPending || cancel.isPending;
  return (
    <Dialog open onClose={onClose} size="lg" title={`${r.employeeName}'s resignation`} description={[r.designation, r.departmentName, r.dateOfJoining && `joined ${fmtDate(r.dateOfJoining)}`].filter(Boolean).join(' · ')}
      footer={acting ? (
        <>
          <Button variant="secondary" disabled={busy || !note.trim()} loading={retain.isPending} onClick={() => retain.mutate()}>Retain employee</Button>
          <Button loading={approve.isPending} disabled={busy} onClick={() => approve.mutate()}>{r.canHrReview ? 'Accept resignation' : 'Approve & send to HR'}</Button>
        </>
      ) : r.canCancel ? (
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel resignation</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="row g-3" style={{ fontSize: 14 }}>
        <div className="col-md-6"><span style={{ color: 'var(--hz-text-muted)' }}>Resigned on</span><div style={{ fontWeight: 700 }}>{fmtDate(r.resignationDate)}</div></div>
        <div className="col-md-6"><span style={{ color: 'var(--hz-text-muted)' }}>Status</span><div><Badge variant={(RESIGNATION_STATUS[r.status] || {}).variant}>{(RESIGNATION_STATUS[r.status] || {}).label}</Badge></div></div>
        <div className="col-md-6"><span style={{ color: 'var(--hz-text-muted)' }}>Notice period</span><div style={{ fontWeight: 700 }}>{r.noticePeriodDays} days · ends {fmtDate(r.policyLastWorkingDate)}</div></div>
        <div className="col-md-6"><span style={{ color: 'var(--hz-text-muted)' }}>Asked to leave on</span><div style={{ fontWeight: 700 }}>{r.requestedLastWorkingDate ? fmtDate(r.requestedLastWorkingDate) : 'Full notice'}{r.noticeShortfallDays > 0 && <Badge variant="warning" className="ms-2">{r.noticeShortfallDays} days short</Badge>}</div></div>
        <div className="col-12"><span style={{ color: 'var(--hz-text-muted)' }}>Reason</span><div style={{ fontWeight: 700 }}>{r.reasonCategory}</div>{r.reason && <p className="mb-0 mt-1" style={{ whiteSpace: 'pre-line' }}>{r.reason}</p>}</div>
        {r.managerDecisionBy && <div className="col-12"><span style={{ color: 'var(--hz-text-muted)' }}>Manager ({r.managerDecisionBy})</span><div>{r.managerNote || 'Approved'}{r.managerRecommendedLastWorkingDate && ` · suggested last day ${fmtDate(r.managerRecommendedLastWorkingDate)}`}</div></div>}
        {r.hrDecisionBy && <div className="col-12"><span style={{ color: 'var(--hz-text-muted)' }}>HR ({r.hrDecisionBy})</span><div>{r.hrNote || 'Accepted'}</div></div>}
        {r.status === 'ACCEPTED' && (
          <div className="col-12 p-3" style={{ background: 'var(--hz-info-50)', borderRadius: 12 }}>
            Last working day <strong>{fmtDate(r.approvedLastWorkingDate)}</strong>. Their login works until then; the exit checklist is running.{' '}
            <Link to="/salary/settlements">Start full &amp; final settlement</Link>
          </div>
        )}
        {r.interviewAnswers && (
          <div className="col-12">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Exit interview</div>
            <div className="d-flex flex-wrap gap-2 mb-2">
              {RATING_QUESTIONS.filter(([k]) => r.interviewAnswers[k]).map(([k, label]) => <Badge key={k} variant={r.interviewAnswers[k] < 3 ? 'danger' : 'neutral'}>{label}: {r.interviewAnswers[k]}/5</Badge>)}
              {r.interviewAnswers.wouldRecommend !== undefined && <Badge variant={r.interviewAnswers.wouldRecommend ? 'success' : 'warning'}>{r.interviewAnswers.wouldRecommend ? 'Would recommend' : "Wouldn't recommend"}</Badge>}
              {r.interviewAnswers.wouldRejoin !== undefined && <Badge variant="neutral">{r.interviewAnswers.wouldRejoin ? 'Open to returning' : 'Not returning'}</Badge>}
            </div>
            {['likedMost', 'improve', 'comments'].filter((k) => r.interviewAnswers[k]).map((k) => (
              <p key={k} className="mb-1"><strong>{{ likedMost: 'Liked most', improve: 'Improve', comments: 'Other' }[k]}:</strong> {r.interviewAnswers[k]}</p>
            ))}
          </div>
        )}
        {(acting || r.canCancel) && (
          <>
            {acting && <FormField col={6} type="date" label={r.canHrReview ? 'Final last working day' : 'Suggested last working day'} value={lwd} onChange={setLwd} hint={`Notice period ends ${fmtDate(r.policyLastWorkingDate)}`} />}
            <FormField col={acting ? 6 : 12} label={acting ? 'Note (required to retain)' : 'Note (optional)'} value={note} onChange={setNote} maxLength={1000} placeholder={acting ? 'e.g. Discussed a role change' : ''} />
          </>
        )}
      </div>
    </Dialog>
  );
}

function ExitSettingsDialog({ onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['resignation-settings'], queryFn: resignationsApi.settings });
  const [form, setForm] = useState(null);
  const current = form || data;
  const save = useMutation({
    mutationFn: () => resignationsApi.updateSettings({ ...current, noticePeriodDays: Number(current.noticePeriodDays) }),
    onSuccess: (saved) => { queryClient.setQueryData(['resignation-settings'], saved); toast.success('Exit settings saved.'); onClose(); },
    onError: (err) => toast.error(errorText(err, 'Could not save.')),
  });
  return (
    <Dialog open onClose={onClose} size="sm" title="Exit settings"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!current} onClick={() => save.mutate()}>Save</Button></>}>
      {!current ? <SkeletonText lines={3} /> : (
        <>
          <FormField type="number" label="Notice period (days)" value={current.noticePeriodDays} onChange={(v) => setForm({ ...current, noticePeriodDays: v })} min={0} max={365} />
          {[['managerApproval', 'Reporting manager reviews first'], ['exitInterview', 'Ask leavers to complete an exit interview']].map(([key, label]) => (
            <label key={key} className="form-check d-flex align-items-center gap-2 mb-2">
              <input type="checkbox" className="form-check-input m-0" checked={!!current[key]} onChange={(e) => setForm({ ...current, [key]: e.target.checked })} /> {label}
            </label>
          ))}
        </>
      )}
    </Dialog>
  );
}
