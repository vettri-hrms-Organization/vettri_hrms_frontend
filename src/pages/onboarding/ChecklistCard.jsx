import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Upload, RotateCcw, SkipForward, AlertTriangle, ExternalLink, Paperclip } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { onboardingApi, OWNER_TYPE_LABEL } from '../../api/endpoints/onboarding';
import { apiMessage } from '../../api/endpoints/letters';
import { formatDateIST } from '../../utils/formatDateTime';

const STATUS_VARIANT = { IN_PROGRESS: 'info', COMPLETED: 'success', CANCELLED: 'neutral' };
const STATUS_LABEL = { IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

/** Deep links for template link keys (see DefaultChecklistTemplates on the backend). */
export function taskLink(task, { selfView } = {}) {
  const profile = selfView ? '/my-profile' : `/employees/${task.employeeId}`;
  switch (task.linkKey) {
    case 'BANK_DETAILS': return { to: profile, label: 'Bank & PAN details' };
    case 'APPOINTMENT_LETTER':
    case 'RELIEVING_LETTER': return { to: `${profile}?tab=letters`, label: 'Letters' };
    case 'MY_LETTERS': return { to: `${profile}?tab=letters`, label: 'My letters' };
    case 'SALARY': return selfView ? null : { to: `/salary/employees/${task.employeeId}`, label: 'Salary' };
    default: return null;
  }
}

export function ProgressBar({ percent }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Checklist progress"
      style={{ height: 8 }}
    >
      <div className="progress-bar" style={{ width: `${percent}%`, background: 'var(--hz-primary-600, #2563eb)' }} />
    </div>
  );
}

/**
 * One checklist with progress and its tasks. Actions are shown only where
 * the server says the viewer can complete the task (task.canComplete).
 */
export default function ChecklistCard({ checklist, selfView = false, canManage = false, onCancel, queryKeys = [] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = () => queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  const onError = (error) => toast.error(apiMessage(error));

  const complete = useMutation({
    mutationFn: ({ id, skip }) => onboardingApi.complete(id, { skip }),
    onSuccess: () => { refresh(); toast.success('Task updated.'); },
    onError,
  });
  const reopen = useMutation({ mutationFn: onboardingApi.reopen, onSuccess: refresh, onError });
  const upload = useMutation({
    mutationFn: ({ id, file }) => onboardingApi.uploadDocument(id, file),
    onSuccess: () => { refresh(); toast.success('Document uploaded.'); },
    onError,
  });

  const isExit = checklist.checklistType === 'EXIT';
  const anchorLabel = isExit ? 'Last working day' : 'Joining date';

  return (
    <Card
      title={checklist.name}
      subtitle={`${isExit ? 'Offboarding' : 'Onboarding'} · ${anchorLabel} ${formatDateIST(checklist.anchorDate)}`}
      actions={(
        <div className="d-flex align-items-center gap-2">
          <Badge variant={STATUS_VARIANT[checklist.status] || 'neutral'}>{STATUS_LABEL[checklist.status] || checklist.status}</Badge>
          {canManage && checklist.status === 'IN_PROGRESS' && onCancel && (
            <Button size="sm" variant="ghost" onClick={() => onCancel(checklist)}>Cancel checklist</Button>
          )}
        </div>
      )}
    >
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="flex-grow-1"><ProgressBar percent={checklist.progressPercent} /></div>
        <span className="small fw-semibold">{checklist.progressPercent}%</span>
        <span className="small text-muted">{checklist.doneTasks}/{checklist.totalTasks} done</span>
        {checklist.overdueTasks > 0 && (
          <Badge variant="danger">{checklist.overdueTasks} overdue</Badge>
        )}
      </div>

      <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
        {checklist.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            selfView={selfView}
            busy={complete.isPending || reopen.isPending || upload.isPending}
            canSkip={canManage}
            onComplete={() => complete.mutate({ id: task.id, skip: false })}
            onSkip={() => complete.mutate({ id: task.id, skip: true })}
            onReopen={() => reopen.mutate(task.id)}
            onUpload={(file) => upload.mutate({ id: task.id, file })}
          />
        ))}
      </ul>
    </Card>
  );
}

export function TaskRow({ task, selfView, busy, canSkip, onComplete, onSkip, onReopen, onUpload, showEmployee = false }) {
  const fileInput = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const done = task.status === 'DONE' || task.status === 'SKIPPED';
  const link = taskLink(task, { selfView });
  const needsDocument = task.requiresDocument && !task.documentId;

  return (
    <li
      className="d-flex flex-column gap-1 p-2 rounded"
      style={{
        border: '1px solid var(--hz-border)',
        background: task.overdue ? 'var(--hz-danger-50, #fef2f2)' : undefined,
      }}
    >
      <div className="d-flex align-items-start gap-2">
        <span aria-hidden="true" style={{ marginTop: 2 }}>
          {done ? <CheckCircle2 size={18} color="var(--hz-success-600, #16a34a)" /> : <Circle size={18} color="var(--hz-text-secondary)" />}
        </span>
        <div className="flex-grow-1">
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-semibold text-body text-decoration-none"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{ textDecoration: done ? 'line-through' : undefined }}
          >
            {task.title}
          </button>
          <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
            {showEmployee && <span>{task.employeeName} ·</span>}
            <span>{OWNER_TYPE_LABEL[task.ownerType] || task.ownerType}: {task.ownerName}</span>
            {task.dueDate && (
              <span style={{ color: task.overdue ? 'var(--hz-danger-600)' : undefined }}>
                {task.overdue && <AlertTriangle size={12} aria-hidden="true" className="me-1" />}
                Due {formatDateIST(task.dueDate)}{task.overdue ? ' (overdue)' : ''}
              </span>
            )}
            {task.status === 'SKIPPED' && <Badge variant="neutral">Skipped</Badge>}
            {task.requiresDocument && (
              <span>
                <Paperclip size={12} aria-hidden="true" /> {task.documentId ? 'Document uploaded' : 'Document required'}
              </span>
            )}
          </div>
          {expanded && (
            <div className="small mt-1">
              {task.description && <p className="mb-1">{task.description}</p>}
              {done && task.completedBy && (
                <p className="mb-1 text-muted">
                  {task.status === 'SKIPPED' ? 'Skipped' : 'Completed'} by {task.completedBy}
                  {task.completedAt ? ` on ${formatDateIST(task.completedAt)}` : ''}
                </p>
              )}
              {task.remarks && <p className="mb-1 text-muted">Remarks: {task.remarks}</p>}
            </div>
          )}
        </div>
        <div className="d-flex flex-wrap gap-1 justify-content-end">
          {link && (
            <Link className="btn btn-sm btn-light d-inline-flex align-items-center gap-1" to={link.to}>
              <ExternalLink size={14} aria-hidden="true" /> {link.label}
            </Link>
          )}
          {task.canComplete && !done && task.requiresDocument && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="d-none"
                aria-label={`Upload document for ${task.title}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="secondary" icon={Upload} disabled={busy} onClick={() => fileInput.current?.click()}>
                {task.documentId ? 'Replace' : 'Upload'}
              </Button>
            </>
          )}
          {task.canComplete && !done && (
            <Button size="sm" icon={CheckCircle2} disabled={busy || needsDocument} onClick={onComplete}
              title={needsDocument ? 'Upload the required document first' : undefined}>
              Mark done
            </Button>
          )}
          {task.canComplete && !done && canSkip && (
            <Button size="sm" variant="ghost" icon={SkipForward} disabled={busy} onClick={onSkip}>Skip</Button>
          )}
          {task.canComplete && done && (
            <Button size="sm" variant="ghost" icon={RotateCcw} disabled={busy} onClick={onReopen}>Reopen</Button>
          )}
        </div>
      </div>
    </li>
  );
}
