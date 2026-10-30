import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { formatHours, isoDate, parseHours, timesheetsApi, toHhMm } from '../../api/endpoints/timesheets';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

export const rowKey = (row) => `${row.projectId ?? 0}:${row.taskId ?? 0}`;
export const rowLabel = (row) => [row.projectName || 'General work', row.taskName].filter(Boolean).join(' · ');

/** Every project/task combination the employee can log against, plus general work. */
function optionsFor(projects) {
  const options = [{ key: '0:0', projectId: null, taskId: null, projectName: 'General work', taskName: null }];
  for (const p of projects) {
    options.push({ key: `${p.id}:0`, projectId: p.id, taskId: null, projectName: p.name, taskName: null, billable: p.billable, clientName: p.clientName });
    for (const t of p.tasks) options.push({ key: `${p.id}:${t.id}`, projectId: p.id, taskId: t.id, projectName: p.name, taskName: t.name, billable: t.billable, clientName: p.clientName });
  }
  return options;
}

function ProjectSelect({ projects, value, onChange, exclude = [], label = 'Project / task' }) {
  const options = optionsFor(projects).filter((o) => o.key === value || !exclude.includes(o.key));
  return (
    <FormField as="select" label={label} value={value} onChange={onChange} required>
      <option value="">Choose…</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.taskName ? `   ${o.projectName} › ${o.taskName}` : o.projectId ? `${o.projectName}${o.clientName ? ` (${o.clientName})` : ''}` : 'General work (meetings, admin…)'}
        </option>
      ))}
    </FormField>
  );
}

/** Adds a project/task row to the weekly grid. */
export function ProjectTaskPicker({ projects, exclude, onClose, onPick }) {
  const [value, setValue] = useState('');
  const options = optionsFor(projects);
  return (
    <Dialog open onClose={onClose} title="Add a row" description="Pick what you worked on. You can then fill hours for each day." size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!value} onClick={() => onPick(options.find((o) => o.key === value))}>Add row</Button>
        </>
      )}>
      <ProjectSelect projects={projects} value={value} onChange={setValue} exclude={exclude} />
      {projects.length === 0 && (
        <p className="mt-3 mb-0" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>
          You aren&apos;t on any projects yet, so you can log general work. Ask HR to add you to a project.
        </p>
      )}
    </Dialog>
  );
}

/** Hours + note for one cell. */
export function NoteDialog({ title, description, minutes, notes, required, saving, onClose, onSave }) {
  const [hours, setHours] = useState(toHhMm(minutes));
  const [text, setText] = useState(notes || '');
  const parsed = parseHours(hours);
  const invalid = parsed === null || parsed > 24 * 60;
  return (
    <Dialog open onClose={onClose} title={title} description={description} size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button loading={saving} disabled={invalid || (required && parsed > 0 && !text.trim())} onClick={() => onSave(parsed, text.trim() || null)}>Save</Button>
        </>
      )}>
      <div className="row g-3">
        <FormField col={5} label="Hours" value={hours} onChange={setHours} placeholder="e.g. 2:30" error={invalid ? 'Like 2, 1.5 or 7:30' : null} />
        <FormField col={12} as="textarea" rows={3} label={required ? 'What did you work on?' : 'Note (optional)'} value={text} onChange={setText} maxLength={1000} required={required} />
      </div>
    </Dialog>
  );
}

/**
 * Quick "log today's work" form - opened from the timesheet page and right after check-out.
 * Each line updates today's cell for that project/task.
 */
export default function LogWorkDialog({ onClose, workedMinutes }) {
  const today = isoDate(new Date());
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: week, isLoading } = useQuery({ queryKey: ['timesheet-me', 'today', today], queryFn: () => timesheetsApi.myWeek(today) });
  const [lines, setLines] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!week || lines) return;
    const todays = week.entries.filter((e) => e.workDate === today);
    setLines(todays.length
      ? todays.map((e) => ({ key: `${e.projectId ?? 0}:${e.taskId ?? 0}`, hours: toHhMm(e.minutes), notes: e.notes || '', id: e.id }))
      : [{ key: week.projects.length === 1 ? `${week.projects[0].id}:0` : '', hours: '', notes: '' }]);
  }, [week, lines, today]);

  const set = (index, field, value) => setLines((current) => current.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  const logged = (lines || []).reduce((sum, l) => sum + (parseHours(l.hours) || 0), 0);
  const attended = workedMinutes ?? week?.days.find((d) => d.date === today)?.attendanceMinutes ?? 0;

  const save = async () => {
    setError(null);
    const valid = lines.filter((l) => l.key && l.hours.trim());
    for (const l of valid) {
      const minutes = parseHours(l.hours);
      if (minutes === null || minutes > 24 * 60) { setError(`"${l.hours}" isn't a valid number of hours. Use 2, 1.5 or 7:30.`); return; }
      if (week.requireNotes && !l.notes.trim()) { setError('Add a short note for each line - your company asks for one.'); return; }
    }
    if (!valid.length) { setError('Add at least one line with hours.'); return; }
    setSaving(true);
    try {
      let result;
      for (const l of valid) {
        const [projectId, taskId] = l.key.split(':').map(Number);
        // eslint-disable-next-line no-await-in-loop
        result = await timesheetsApi.saveEntry({ id: l.id, workDate: today, projectId: projectId || null, taskId: taskId || null, minutes: parseHours(l.hours), notes: l.notes.trim() || null });
      }
      queryClient.setQueryData(['timesheet-me', result.weekStart], result);
      queryClient.invalidateQueries({ queryKey: ['timesheet-me'] });
      toast.success(`Logged ${formatHours(logged)} for today.`);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save your time.');
    } finally {
      setSaving(false);
    }
  };

  const locked = week && !week.editable;
  return (
    <Dialog open onClose={onClose} title="Log today's work"
      description={attended ? `You've worked ${formatHours(attended)} today. What did you spend it on?` : 'What did you work on today?'}
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Later</Button>
          <Button onClick={save} loading={saving} disabled={!lines || locked}>Save {logged ? formatHours(logged) : ''}</Button>
        </>
      )}>
      {isLoading || !lines ? <SkeletonText lines={3} /> : locked ? (
        <p className="mb-0">This week&apos;s timesheet is {week.status === 'APPROVED' ? 'approved and locked' : 'waiting for approval'}. Recall it from the Timesheet page to add time.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {lines.map((line, index) => (
            <div key={index} className="row g-2 align-items-end p-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 12 }}>
              <div className="col-12 col-md-7">
                <ProjectSelect projects={week.projects} value={line.key} onChange={(v) => set(index, 'key', v)}
                  exclude={lines.filter((_, i) => i !== index).map((l) => l.key)} label={index === 0 ? 'Project / task' : ' '} />
              </div>
              <FormField col={3} label="Hours" value={line.hours} onChange={(v) => set(index, 'hours', v)} placeholder="2:30" />
              <div className="col-12 col-md-2 d-flex justify-content-end mb-3">
                {lines.length > 1 && (
                  <button type="button" className="btn btn-light btn-sm border-0" aria-label="Remove line" onClick={() => setLines((c) => c.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
                )}
              </div>
              <FormField col={12} label={week.requireNotes ? 'What you did' : 'What you did (optional)'} value={line.notes} onChange={(v) => set(index, 'notes', v)} placeholder="e.g. Built the login page, fixed payslip bug" maxLength={1000} />
            </div>
          ))}
          <div>
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setLines((c) => [...c, { key: '', hours: '', notes: '' }])}>Add another</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
