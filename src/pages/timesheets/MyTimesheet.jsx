import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, ChevronRight, Copy, MessageSquare, Plus, Send, Undo2, X } from 'lucide-react';
import {
  TIMESHEET_STATUS, addDaysIso, formatHours, mondayOf, parseHours, parseIso, timesheetsApi, toHhMm,
} from '../../api/endpoints/timesheets';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import LogWorkDialog, { NoteDialog, ProjectTaskPicker, rowKey, rowLabel } from './LogWorkDialog';

const DAY = (iso) => parseIso(iso).toLocaleDateString('en-IN', { weekday: 'short' });
const DATE = (iso) => parseIso(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const errorText = (error, fallback) => error?.response?.data?.message || fallback;

/** Employee weekly timesheet: rows are project/task, columns are days; each cell is one entry. */
export default function MyTimesheet() {
  const [weekStart, setWeekStart] = useState(() => mondayOf());
  const [extraRows, setExtraRows] = useState([]);
  const [noteCell, setNoteCell] = useState(null);
  const [adding, setAdding] = useState(false);
  const [logToday, setLogToday] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const thisWeek = mondayOf();

  const { data: week, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['timesheet-me', weekStart],
    queryFn: () => timesheetsApi.myWeek(weekStart),
  });
  useEffect(() => { setExtraRows([]); }, [weekStart]);

  const store = (result) => queryClient.setQueryData(['timesheet-me', weekStart], result);
  const save = useMutation({ mutationFn: timesheetsApi.saveEntry, onSuccess: store });
  const submit = useMutation({
    mutationFn: () => timesheetsApi.submit(weekStart),
    onSuccess: (result) => { store(result); toast.success('Timesheet submitted for approval.'); },
    onError: (err) => toast.error(errorText(err, 'Could not submit the timesheet.')),
  });
  const recall = useMutation({
    mutationFn: () => timesheetsApi.recall(weekStart),
    onSuccess: (result) => { store(result); toast.success('Timesheet recalled. You can edit it again.'); },
    onError: (err) => toast.error(errorText(err, 'Could not recall the timesheet.')),
  });
  const copyRows = useMutation({
    mutationFn: () => timesheetsApi.myWeek(addDaysIso(weekStart, -7)),
    onSuccess: (previous) => {
      const rows = uniqueRows(previous.entries);
      if (!rows.length) { toast.info('Last week has no time logged to copy.'); return; }
      setExtraRows((current) => [...current, ...rows]);
      toast.success(`Added ${rows.length} row${rows.length === 1 ? '' : 's'} from last week. Fill in this week's hours.`);
    },
  });

  const rows = useMemo(() => {
    if (!week) return [];
    const byKey = new Map();
    for (const row of [...uniqueRows(week.entries), ...extraRows]) if (!byKey.has(rowKey(row))) byKey.set(rowKey(row), row);
    return [...byKey.values()];
  }, [week, extraRows]);

  if (isError) return <ErrorState description={errorText(error, "Couldn't load your timesheet.")} onRetry={refetch} />;

  const status = TIMESHEET_STATUS[week?.status] || TIMESHEET_STATUS.DRAFT;
  const editable = !!week?.editable;
  const cell = (row, date) => week.entries.find((e) => e.workDate === date && rowKey(e) === rowKey(row));
  const dayTotal = (date) => week.entries.filter((e) => e.workDate === date).reduce((sum, e) => sum + e.minutes, 0);
  const rowTotal = (row) => week.entries.filter((e) => rowKey(e) === rowKey(row)).reduce((sum, e) => sum + e.minutes, 0);
  const projectFor = (row) => week.projects.find((p) => p.id === row.projectId);

  const saveCell = (row, date, minutes, notes) => {
    const existing = cell(row, date);
    if (existing && existing.minutes === minutes && (notes === undefined || notes === (existing.notes || ''))) return;
    if (!existing && !minutes) return;
    if (minutes && week.requireNotes && !(notes ?? existing?.notes)) {
      setNoteCell({ row, date, minutes, notes: '' });
      return;
    }
    save.mutate(
      { id: existing?.id, workDate: date, projectId: row.projectId ?? null, taskId: row.taskId ?? null, minutes, notes: notes ?? existing?.notes ?? null },
      { onError: (err) => toast.error(errorText(err, 'Could not save that time.')) },
    );
  };

  const removeRow = async (row) => {
    const entries = week.entries.filter((e) => rowKey(e) === rowKey(row));
    if (entries.length && !(await confirm({ title: 'Remove this row?', description: `${formatHours(rowTotal(row))} logged on ${rowLabel(row)} this week will be deleted.`, confirmLabel: 'Remove' }))) return;
    setExtraRows((current) => current.filter((r) => rowKey(r) !== rowKey(row)));
    for (const entry of entries) {
      // eslint-disable-next-line no-await-in-loop
      store(await timesheetsApi.deleteEntry(entry.id));
    }
  };

  const target = week?.targetMinutes || 0;
  const progress = target ? Math.min(100, Math.round(((week?.totalMinutes || 0) / target) * 100)) : 0;

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="My workspace"
        title="Timesheet"
        description="Log what you worked on each day and submit the week for approval"
        actions={(
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" icon={ChevronLeft} aria-label="Previous week" onClick={() => setWeekStart(addDaysIso(weekStart, -7))} />
            <div style={{ fontWeight: 700, minWidth: 150, textAlign: 'center' }}>
              {DATE(weekStart)} – {DATE(addDaysIso(weekStart, 6))}
            </div>
            <Button variant="secondary" size="sm" icon={ChevronRight} aria-label="Next week" disabled={weekStart >= thisWeek} onClick={() => setWeekStart(addDaysIso(weekStart, 7))} />
            {weekStart !== thisWeek && <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeek)}>This week</Button>}
          </div>
        )}
      />

      {isLoading || !week ? <Card><SkeletonText lines={6} /></Card> : (
        <>
          {week.status === 'REJECTED' && (
            <div className="d-flex align-items-start gap-3 p-3" style={{ borderRadius: 14, border: '1px solid var(--hz-border)', background: 'var(--hz-danger-50)' }}>
              <Undo2 size={18} aria-hidden="true" style={{ color: 'var(--hz-danger-700)', marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700 }}>Sent back by {week.reviewedByName || 'your approver'}</div>
                <div style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>{week.reviewNote}. Update the hours and submit again.</div>
              </div>
            </div>
          )}

          <div className="row g-3">
            <Summary label="Logged this week" value={formatHours(week.totalMinutes)} detail={target ? `of ${formatHours(target)} target` : 'No weekly target'}>
              {target > 0 && (
                <div role="progressbar" aria-label="Weekly target" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 99, background: 'var(--hz-gray-100)', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? 'var(--hz-success-500)' : 'var(--hz-primary-500)' }} />
                </div>
              )}
            </Summary>
            <Summary label="Billable" value={formatHours(week.billableMinutes)} detail={week.totalMinutes ? `${Math.round((week.billableMinutes / week.totalMinutes) * 100)}% of logged time` : 'Client-billable hours'} />
            <Summary label="Attendance" value={formatHours(week.attendanceMinutes)} detail="Worked time from check-in/out" />
            <Summary label="Status" value={<Badge variant={status.variant}>{status.label}</Badge>} detail={week.submittedAt ? `Submitted ${new Date(week.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Not submitted yet'} />
          </div>

          <Card
            title="This week"
            subtitle={editable ? 'Type hours like 2, 1.5 or 7:30. Changes save automatically.' : week.status === 'APPROVED' ? 'Approved and locked.' : 'Waiting for approval. Recall it to make changes.'}
            actions={(
              <div className="d-flex gap-2 flex-wrap">
                {editable && <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => setLogToday(true)} disabled={weekStart !== thisWeek}>Log today</Button>}
                {editable && <Button size="sm" variant="secondary" icon={Copy} loading={copyRows.isPending} onClick={() => copyRows.mutate()}>Copy last week&apos;s rows</Button>}
                {editable && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>Add row</Button>}
                {week.status === 'SUBMITTED' && <Button size="sm" variant="secondary" icon={Undo2} loading={recall.isPending} onClick={() => recall.mutate()}>Recall</Button>}
                {editable && (
                  <Button size="sm" icon={Send} loading={submit.isPending} disabled={!week.totalMinutes}
                    onClick={async () => {
                      const short = target && week.totalMinutes < target;
                      if (short && !(await confirm({ title: 'Submit with fewer hours?', description: `You've logged ${formatHours(week.totalMinutes)} against a ${formatHours(target)} weekly target. Your approver will see the difference.`, confirmLabel: 'Submit anyway', variant: 'primary' }))) return;
                      submit.mutate();
                    }}>
                    Submit week
                  </Button>
                )}
              </div>
            )}
          >
            <div className="table-responsive">
              <table className="table align-middle mb-0 hz-timesheet-grid" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Project / task</th>
                    {week.days.map((d) => (
                      <th key={d.date} className="text-center" style={{ minWidth: 78 }}>
                        <div>{DAY(d.date)}</div>
                        <div style={{ fontWeight: 500, fontSize: 11, opacity: 0.8 }}>{DATE(d.date)}</div>
                        {(d.holiday || d.onLeave || d.weekOff) && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--hz-text-muted)' }}>{d.holiday ? 'Holiday' : d.onLeave ? 'Leave' : 'Week off'}</div>
                        )}
                      </th>
                    ))}
                    <th className="text-end">Total</th>
                    <th aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-4" style={{ color: 'var(--hz-text-muted)' }}>
                      No time logged this week. {editable && 'Use “Add row” to pick a project, or “Log today”.'}
                    </td></tr>
                  )}
                  {rows.map((row) => (
                    <tr key={rowKey(row)}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 'var(--hz-text-sm)' }}>{row.projectName || 'General work'}</div>
                        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                          {row.taskName || (row.projectId ? 'No task' : 'Meetings, admin and other non-project work')}
                          {(projectFor(row)?.billable || row.billable) && <Badge variant="success" className="ms-2">Billable</Badge>}
                        </div>
                      </td>
                      {week.days.map((d) => {
                        const entry = cell(row, d.date);
                        return (
                          <td key={d.date} className="text-center">
                            <HoursCell
                              key={`${entry?.id || 'new'}-${entry?.minutes || 0}`}
                              value={entry?.minutes || 0}
                              disabled={!editable || d.future}
                              hasNote={!!entry?.notes}
                              label={`${rowLabel(row)}, ${DAY(d.date)} ${DATE(d.date)}`}
                              onCommit={(minutes) => saveCell(row, d.date, minutes)}
                              onNote={() => setNoteCell({ row, date: d.date, minutes: entry?.minutes || 0, notes: entry?.notes || '' })}
                            />
                          </td>
                        );
                      })}
                      <td className="text-end" style={{ fontWeight: 700 }}>{formatHours(rowTotal(row))}</td>
                      <td className="text-end">
                        {editable && <button type="button" className="btn btn-sm btn-light border-0" aria-label={`Remove ${rowLabel(row)}`} onClick={() => removeRow(row)}><X size={14} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Logged</td>
                    {week.days.map((d) => <td key={d.date} className="text-center">{dayTotal(d.date) ? formatHours(dayTotal(d.date)) : '–'}</td>)}
                    <td className="text-end">{formatHours(week.totalMinutes)}</td>
                    <td />
                  </tr>
                  <tr style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                    <td>Attendance</td>
                    {week.days.map((d) => {
                      const gap = d.attendanceMinutes - dayTotal(d.date);
                      return (
                        <td key={d.date} className="text-center" title={gap > 60 ? `${formatHours(gap)} of attended time not logged` : undefined}
                          style={{ color: gap > 60 && !d.future ? 'var(--hz-warning-700)' : undefined }}>
                          {d.future ? '' : d.attendanceMinutes ? formatHours(d.attendanceMinutes) : '–'}
                        </td>
                      );
                    })}
                    <td className="text-end">{formatHours(week.attendanceMinutes)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {adding && (
            <AddRowDialog projects={week.projects} existing={rows} onClose={() => setAdding(false)}
              onAdd={(row) => { setExtraRows((current) => [...current, row]); setAdding(false); }} />
          )}
          {noteCell && (
            <NoteDialog
              title={rowLabel(noteCell.row)}
              description={`${DAY(noteCell.date)} ${DATE(noteCell.date)}`}
              minutes={noteCell.minutes}
              notes={noteCell.notes}
              required={week.requireNotes}
              saving={save.isPending}
              onClose={() => setNoteCell(null)}
              onSave={(minutes, notes) => {
                const existing = cell(noteCell.row, noteCell.date);
                save.mutate(
                  { id: existing?.id, workDate: noteCell.date, projectId: noteCell.row.projectId ?? null, taskId: noteCell.row.taskId ?? null, minutes, notes },
                  { onSuccess: () => setNoteCell(null), onError: (err) => toast.error(errorText(err, 'Could not save.')) },
                );
              }}
            />
          )}
          {logToday && <LogWorkDialog onClose={() => setLogToday(false)} />}
        </>
      )}
    </div>
  );
}

function uniqueRows(entries) {
  const seen = new Map();
  for (const e of entries) {
    const row = { projectId: e.projectId, projectName: e.projectName, taskId: e.taskId, taskName: e.taskName, billable: e.billable };
    if (!seen.has(rowKey(row))) seen.set(rowKey(row), row);
  }
  return [...seen.values()];
}

function Summary({ label, value, detail, children }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="h-100 d-flex flex-column gap-2 p-3" style={{ background: 'var(--hz-bg-surface)', border: '1px solid var(--hz-border)', borderRadius: 16, boxShadow: 'var(--hz-shadow-sm)' }}>
        <div style={{ color: 'var(--hz-text-muted)', fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: 'var(--hz-text-primary)' }}>{value}</div>
        {detail && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{detail}</div>}
        {children}
      </div>
    </div>
  );
}

/** One editable grid cell. Saves on blur/Enter; reverts and warns on unreadable input. */
function HoursCell({ value, disabled, hasNote, label, onCommit, onNote }) {
  const [text, setText] = useState(toHhMm(value));
  const toast = useToast();
  const commit = () => {
    const minutes = parseHours(text);
    if (minutes === null || minutes > 24 * 60) {
      toast.warning('Enter hours like 2, 1.5 or 7:30 (up to 24 hours).');
      setText(toHhMm(value));
      return;
    }
    setText(toHhMm(minutes));
    if (minutes !== value) onCommit(minutes);
  };
  return (
    <div className="d-inline-flex align-items-center gap-1">
      <input
        className="form-control form-control-sm text-center"
        style={{ width: 62, fontWeight: value ? 700 : 400 }}
        value={text}
        placeholder={disabled ? '' : '–'}
        disabled={disabled}
        aria-label={`Hours for ${label}`}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      {!disabled && (
        <button type="button" className="btn btn-sm p-0 border-0" aria-label={`Note for ${label}`} onClick={onNote}
          style={{ color: hasNote ? 'var(--hz-primary-600)' : 'var(--hz-text-muted)', opacity: hasNote ? 1 : 0.55 }}>
          <MessageSquare size={13} fill={hasNote ? 'currentColor' : 'none'} />
        </button>
      )}
      {disabled && hasNote && <MessageSquare size={13} aria-label="Has a note" style={{ color: 'var(--hz-primary-600)' }} />}
    </div>
  );
}

function AddRowDialog({ projects, existing, onClose, onAdd }) {
  return (
    <ProjectTaskPicker
      projects={projects}
      exclude={existing.map(rowKey)}
      onClose={onClose}
      onPick={onAdd}
    />
  );
}
