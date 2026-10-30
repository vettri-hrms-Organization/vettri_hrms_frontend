import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, BarChart3, ChevronLeft, ChevronRight, Download, FolderKanban, Pencil, Plus, RotateCcw, Settings2, Users } from 'lucide-react';
import {
  TIMESHEET_STATUS, addDaysIso, formatHours, isoDate, mondayOf, parseIso, timesheetsApi,
} from '../../api/endpoints/timesheets';
import { employeesApi } from '../../api/endpoints/employees';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';

const DATE = (iso) => (iso ? parseIso(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const errorText = (error, fallback) => error?.response?.data?.message || fallback;

/** Timesheets for approvers (their team) and HR (projects, reports, settings). */
export default function TimesheetsAdmin() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('TIMESHEET_MANAGE');
  const tabs = [
    { key: 'team', label: 'Team timesheets', icon: Users },
    ...(canManage ? [{ key: 'projects', label: 'Projects', icon: FolderKanban }] : []),
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    ...(canManage ? [{ key: 'settings', label: 'Settings', icon: Settings2 }] : []),
  ];
  const [tab, setTab] = useState('team');
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Time" title="Timesheets" description="Who logged what, project hours and approvals" />
      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Timesheet sections" />
      {tab === 'team' && <TeamTab />}
      {tab === 'projects' && canManage && <ProjectsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'settings' && canManage && <SettingsTab />}
    </div>
  );
}

// ---------------------------------------------------------------- team

function TeamTab() {
  const [weekStart, setWeekStart] = useState(() => addDaysIso(mondayOf(), -7));
  const [open, setOpen] = useState(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['timesheet-team', weekStart], queryFn: () => timesheetsApi.team(weekStart) });
  const rows = data || [];
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.weekStatus]: (acc[r.weekStatus] || 0) + 1 }), {});
  return (
    <Card
      title={`Week of ${DATE(weekStart)} – ${DATE(addDaysIso(weekStart, 6))}`}
      subtitle={rows.length ? `${counts.APPROVED || 0} approved · ${counts.SUBMITTED || 0} waiting · ${(counts.DRAFT || 0) + (counts.NOT_STARTED || 0) + (counts.REJECTED || 0)} not submitted` : 'Your team'}
      actions={(
        <div className="d-flex gap-2">
          <Button size="sm" variant="secondary" icon={ChevronLeft} aria-label="Previous week" onClick={() => setWeekStart(addDaysIso(weekStart, -7))} />
          <Button size="sm" variant="secondary" icon={ChevronRight} aria-label="Next week" disabled={weekStart >= mondayOf()} onClick={() => setWeekStart(addDaysIso(weekStart, 7))} />
        </div>
      )}
    >
      {isLoading ? <SkeletonText lines={5} /> : isError ? <ErrorBanner>Couldn&apos;t load team timesheets. <button type="button" className="btn btn-link p-0" onClick={() => refetch()}>Retry</button></ErrorBanner>
        : rows.length === 0 ? <EmptyState icon={Users} title="No one to show" description="Employees in your team or reporting to you appear here." /> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Employee</th><th>Department</th><th className="text-end">Logged</th><th className="text-end">Billable</th><th className="text-end">Attendance</th><th>Status</th><th aria-label="Open" /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const status = TIMESHEET_STATUS[r.weekStatus] || TIMESHEET_STATUS.DRAFT;
                  const short = r.targetMinutes && r.loggedMinutes < r.targetMinutes;
                  const gap = r.attendanceMinutes - r.loggedMinutes;
                  return (
                    <tr key={r.employeeId}>
                      <td><div style={{ fontWeight: 700 }}>{r.employeeName}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.employeeCode}</div></td>
                      <td>{r.departmentName || '–'}</td>
                      <td className="text-end" style={{ fontWeight: 700, color: short ? 'var(--hz-warning-700)' : undefined }} title={short ? `Target ${formatHours(r.targetMinutes)}` : undefined}>{formatHours(r.loggedMinutes)}</td>
                      <td className="text-end">{formatHours(r.billableMinutes)}</td>
                      <td className="text-end" title={gap > 120 ? `${formatHours(gap)} attended but not logged` : undefined} style={{ color: gap > 120 ? 'var(--hz-warning-700)' : undefined }}>{formatHours(r.attendanceMinutes)}</td>
                      <td><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td className="text-end"><Button size="sm" variant="secondary" onClick={() => setOpen(r)}>{r.weekStatus === 'SUBMITTED' ? 'Review' : 'View'}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {open && <WeekReviewDialog employeeId={open.employeeId} weekStart={weekStart} onClose={() => setOpen(null)} />}
    </Card>
  );
}

/** Read-only week for an approver, with approve / send back when it's waiting. */
export function WeekReviewDialog({ employeeId, weekStart, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const { data: week, isLoading } = useQuery({ queryKey: ['timesheet-employee', employeeId, weekStart], queryFn: () => timesheetsApi.employeeWeek(employeeId, weekStart) });
  const review = useMutation({
    mutationFn: ({ approve }) => (approve ? timesheetsApi.approve(week.weekId, note) : timesheetsApi.reject(week.weekId, note)),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? 'Timesheet approved.' : 'Timesheet sent back to the employee.');
      queryClient.invalidateQueries({ queryKey: ['timesheet-team'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-inbox'] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the review.')),
  });
  const rows = useMemo(() => {
    if (!week) return [];
    const map = new Map();
    for (const e of week.entries) {
      const key = `${e.projectId ?? 0}:${e.taskId ?? 0}`;
      if (!map.has(key)) map.set(key, { key, label: [e.projectName, e.taskName].filter(Boolean).join(' · '), billable: e.billable, byDay: {} });
      map.get(key).byDay[e.workDate] = e;
    }
    return [...map.values()];
  }, [week]);
  return (
    <Dialog open onClose={onClose} size="xl" title={week ? `${week.employeeName} · week of ${DATE(week.weekStart)}` : 'Timesheet'}
      description={week ? `${formatHours(week.totalMinutes)} logged · ${formatHours(week.billableMinutes)} billable · ${formatHours(week.attendanceMinutes)} attendance · target ${formatHours(week.targetMinutes)}` : undefined}
      footer={week?.canReview ? (
        <>
          <Button variant="secondary" loading={review.isPending} disabled={!note.trim()} onClick={() => review.mutate({ approve: false })}>Send back</Button>
          <Button loading={review.isPending} onClick={() => review.mutate({ approve: true })}>Approve</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {isLoading || !week ? <SkeletonText lines={5} /> : (
        <>
          <div className="mb-3"><Badge variant={(TIMESHEET_STATUS[week.status] || TIMESHEET_STATUS.DRAFT).variant}>{(TIMESHEET_STATUS[week.status] || TIMESHEET_STATUS.DRAFT).label}</Badge>
            {week.reviewNote && <span className="ms-2" style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>“{week.reviewNote}” – {week.reviewedByName}</span>}</div>
          {rows.length === 0 ? <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>No time logged this week.</p> : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead><tr><th>Project / task</th>{week.days.map((d) => <th key={d.date} className="text-center">{parseIso(d.date).toLocaleDateString('en-IN', { weekday: 'short' })}</th>)}<th className="text-end">Total</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td><strong>{r.label}</strong>{r.billable && <Badge variant="success" className="ms-2">Billable</Badge>}</td>
                      {week.days.map((d) => {
                        const e = r.byDay[d.date];
                        return <td key={d.date} className="text-center" title={e?.notes || undefined} style={{ cursor: e?.notes ? 'help' : undefined, textDecoration: e?.notes ? 'underline dotted' : undefined }}>{e ? formatHours(e.minutes) : '–'}</td>;
                      })}
                      <td className="text-end"><strong>{formatHours(Object.values(r.byDay).reduce((s, e) => s + e.minutes, 0))}</strong></td>
                    </tr>
                  ))}
                  <tr style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                    <td>Attendance</td>{week.days.map((d) => <td key={d.date} className="text-center">{d.attendanceMinutes ? formatHours(d.attendanceMinutes) : '–'}</td>)}<td className="text-end">{formatHours(week.attendanceMinutes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {week.entries.some((e) => e.notes) && (
            <div className="mt-2">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Notes</div>
              <ul className="mb-0 ps-3" style={{ fontSize: 13 }}>
                {week.entries.filter((e) => e.notes).map((e) => <li key={e.id}><strong>{DATE(e.workDate)} · {e.projectName}</strong>: {e.notes}</li>)}
              </ul>
            </div>
          )}
          {week.canReview && <FormField label="Note for the employee (required to send back)" value={note} onChange={setNote} placeholder="e.g. Wednesday is missing" maxLength={500} />}
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- projects

function ProjectsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['timesheet-projects'], queryFn: timesheetsApi.projects });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timesheet-projects'] });
  const toggle = useMutation({
    mutationFn: (p) => (p.status === 'ARCHIVED' ? timesheetsApi.restoreProject(p.id) : timesheetsApi.archiveProject(p.id)),
    onSuccess: (p) => { refresh(); toast.success(p.status === 'ARCHIVED' ? 'Project archived. No new time can be logged.' : 'Project restored.'); },
    onError: (err) => toast.error(errorText(err, 'Could not update the project.')),
  });
  const projects = (data || []).filter((p) => showArchived || p.status !== 'ARCHIVED');
  return (
    <Card title="Projects" subtitle="What employees log time against. Without projects, everyone can still log general work."
      actions={(
        <div className="d-flex gap-2 align-items-center">
          <label className="form-check d-inline-flex align-items-center gap-2 mb-0" style={{ fontSize: 13 }}>
            <input type="checkbox" className="form-check-input m-0" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
          <Button size="sm" icon={Plus} onClick={() => setEditing({})}>New project</Button>
        </div>
      )}>
      {isLoading ? <SkeletonText lines={4} /> : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project for each client or internal stream of work, then add the people working on it." />
      ) : (
        <div className="d-flex flex-column gap-2">
          {projects.map((p) => {
            const used = p.budgetMinutes ? Math.round((p.loggedMinutes / p.budgetMinutes) * 100) : null;
            return (
              <div key={p.id} className="d-flex align-items-center gap-3 flex-wrap p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 14, opacity: p.status === 'ARCHIVED' ? 0.75 : 1 }}>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <strong>{p.name}</strong>{p.code && <span style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{p.code}</span>}
                    {p.billable && <Badge variant="success">Billable</Badge>}
                    {p.status === 'ARCHIVED' && <Badge variant="neutral">Archived</Badge>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>
                    {[p.clientName, p.allEmployees ? 'Everyone' : `${p.members.length} member${p.members.length === 1 ? '' : 's'}`,
                      `${p.tasks.filter((t) => t.active).length} task${p.tasks.length === 1 ? '' : 's'}`,
                      `${formatHours(p.loggedMinutes)} logged${p.budgetMinutes ? ` of ${formatHours(p.budgetMinutes)} budget (${used}%)` : ''}`,
                      p.endDate && `ends ${DATE(p.endDate)}`].filter(Boolean).join(' · ')}
                  </div>
                  {used !== null && (
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--hz-gray-100)', overflow: 'hidden', marginTop: 6, maxWidth: 320 }}>
                      <div style={{ width: `${Math.min(100, used)}%`, height: '100%', background: used > 100 ? 'var(--hz-danger-500)' : used > 85 ? 'var(--hz-warning-500)' : 'var(--hz-success-500)' }} />
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" icon={p.status === 'ARCHIVED' ? RotateCcw : Archive} loading={toggle.isPending} onClick={() => toggle.mutate(p)}>
                    {p.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <ProjectDialog project={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </Card>
  );
}

function ProjectDialog({ project, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: project.name || '', code: project.code || '', clientName: project.clientName || '', description: project.description || '',
    billable: !!project.billable, startDate: project.startDate || '', endDate: project.endDate || '',
    budgetHours: project.budgetMinutes ? String(project.budgetMinutes / 60) : '', allEmployees: !!project.allEmployees,
    members: new Set((project.members || []).map((m) => m.employeeId)),
  });
  const [tasks, setTasks] = useState(project.tasks || []);
  const [newTask, setNewTask] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const { data: people } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list() });
  const list = (people || []).filter((e) => !search || `${e.fullName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase()));

  const save = useMutation({
    mutationFn: () => timesheetsApi.saveProject({
      id: project.id, name: form.name, code: form.code, clientName: form.clientName, description: form.description,
      billable: form.billable, startDate: form.startDate || null, endDate: form.endDate || null,
      budgetMinutes: form.budgetHours ? Math.round(Number(form.budgetHours) * 60) : null,
      allEmployees: form.allEmployees, memberEmployeeIds: [...form.members],
    }),
    onSuccess: async (saved) => {
      for (const name of tasks.filter((t) => !t.id).map((t) => t.name)) {
        // eslint-disable-next-line no-await-in-loop
        await timesheetsApi.saveTask(saved.id, { name });
      }
      onSaved();
      toast.success(project.id ? 'Project updated.' : 'Project created.');
      onClose();
    },
    onError: (err) => setError(errorText(err, 'Could not save the project.')),
  });
  const toggleTask = useMutation({
    mutationFn: (t) => timesheetsApi.saveTask(project.id, { id: t.id, name: t.name, billable: t.billable, active: !t.active }),
    onSuccess: (p) => { setTasks(p.tasks); onSaved(); },
  });
  const toggleMember = (id) => setForm((f) => {
    const members = new Set(f.members);
    if (members.has(id)) members.delete(id); else members.add(id);
    return { ...f, members };
  });

  return (
    <Dialog open onClose={onClose} size="lg" title={project.id ? `Edit ${project.name}` : 'New project'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>Save project</Button>
        </>
      )}>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="row g-3">
        <FormField col={8} label="Project name" value={form.name} onChange={(v) => set('name', v)} required maxLength={150} />
        <FormField col={4} label="Code" value={form.code} onChange={(v) => set('code', v)} placeholder="ACME-01" maxLength={30} />
        <FormField col={6} label="Client" value={form.clientName} onChange={(v) => set('clientName', v)} placeholder="Leave blank for internal work" maxLength={150} />
        <FormField col={6} type="number" label="Budget (hours)" value={form.budgetHours} onChange={(v) => set('budgetHours', v)} min={0} hint="Optional - shows progress against logged hours" />
        <FormField col={6} type="date" label="Start date" value={form.startDate} onChange={(v) => set('startDate', v)} />
        <FormField col={6} type="date" label="End date" value={form.endDate} onChange={(v) => set('endDate', v)} hint="No time can be logged after this date" />
        <FormField col={12} as="textarea" rows={2} label="Description" value={form.description} onChange={(v) => set('description', v)} maxLength={1000} />
        <div className="col-12 d-flex gap-4 flex-wrap">
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={form.billable} onChange={(e) => set('billable', e.target.checked)} /> Billable to the client</label>
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={form.allEmployees} onChange={(e) => set('allEmployees', e.target.checked)} /> Open to every employee</label>
        </div>

        <div className="col-12 col-lg-6">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Tasks</div>
          <div className="d-flex gap-2 mb-2">
            <input className="form-control form-control-sm" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="e.g. Design, Development, Testing" maxLength={150}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTask.trim()) { e.preventDefault(); setTasks((t) => [...t, { name: newTask.trim(), active: true }]); setNewTask(''); } }} aria-label="New task name" />
            <Button size="sm" variant="secondary" icon={Plus} disabled={!newTask.trim()} onClick={() => { setTasks((t) => [...t, { name: newTask.trim(), active: true }]); setNewTask(''); }}>Add</Button>
          </div>
          {tasks.length === 0 ? <div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>Optional. Without tasks, people log against the project as a whole.</div> : (
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
              {tasks.map((t, i) => (
                <li key={t.id || `new-${i}`} className="d-flex align-items-center justify-content-between px-2 py-1" style={{ border: '1px solid var(--hz-border)', borderRadius: 8, fontSize: 13, opacity: t.active ? 1 : 0.6 }}>
                  <span>{t.name}{!t.id && <Badge variant="info" className="ms-2">New</Badge>}</span>
                  {t.id ? <button type="button" className="btn btn-link btn-sm p-0" onClick={() => toggleTask.mutate(t)}>{t.active ? 'Turn off' : 'Turn on'}</button>
                    : <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setTasks((list) => list.filter((_, idx) => idx !== i))}>Remove</button>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-12 col-lg-6">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Members {form.allEmployees ? '(everyone)' : `(${form.members.size})`}</div>
          {form.allEmployees ? <div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>Every employee can log time on this project.</div> : (
            <>
              <input className="form-control form-control-sm mb-2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees" aria-label="Search employees" />
              <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--hz-border)', borderRadius: 8 }}>
                {list.map((e) => (
                  <label key={e.id} className="d-flex align-items-center gap-2 px-2 py-1" style={{ fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" className="form-check-input m-0" checked={form.members.has(e.id)} onChange={() => toggleMember(e.id)} />
                    {e.fullName} <span style={{ color: 'var(--hz-text-muted)' }}>{e.employeeCode}</span>
                  </label>
                ))}
                {list.length === 0 && <div className="p-2" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>No employees found.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- reports

function ReportsTab() {
  const now = new Date();
  const [from, setFrom] = useState(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(isoDate(now));
  const [groupBy, setGroupBy] = useState('project');
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['timesheet-report', from, to], queryFn: () => timesheetsApi.projectReport(from, to), enabled: !!from && !!to });

  const grouped = useMemo(() => {
    if (!data) return [];
    const key = groupBy === 'project' ? 'projectName' : 'employeeName';
    const sub = groupBy === 'project' ? 'employeeName' : 'projectName';
    const map = new Map();
    for (const r of data.rows) {
      if (!map.has(r[key])) map.set(r[key], { name: r[key], client: groupBy === 'project' ? r.clientName : null, minutes: 0, billable: 0, items: [] });
      const g = map.get(r[key]);
      g.minutes += r.minutes;
      g.billable += r.billableMinutes;
      g.items.push({ name: r[sub], minutes: r.minutes, billable: r.billableMinutes });
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [data, groupBy]);

  const exportCsv = () => {
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Project', 'Client', 'Employee', 'Hours', 'Billable hours'].join(',')];
    for (const r of data.rows) lines.push([quote(r.projectName), quote(r.clientName), quote(r.employeeName), (r.minutes / 60).toFixed(2), (r.billableMinutes / 60).toFixed(2)].join(','));
    const url = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card title="Time by project" subtitle="Logged hours in the period, for everyone you can see"
      actions={<Button size="sm" variant="secondary" icon={Download} disabled={!data?.rows.length} onClick={exportCsv}>Export (Excel)</Button>}>
      <div className="row g-3 align-items-end mb-2">
        <FormField col={3} type="date" label="From" value={from} onChange={setFrom} />
        <FormField col={3} type="date" label="To" value={to} onChange={setTo} />
        <FormField col={3} as="select" label="Group by" value={groupBy} onChange={setGroupBy}>
          <option value="project">Project</option>
          <option value="employee">Employee</option>
        </FormField>
      </div>
      {isError && <ErrorBanner>{errorText(error, 'Could not load the report.')}</ErrorBanner>}
      {isLoading ? <SkeletonText lines={4} /> : data && (
        <>
          <div className="d-flex gap-4 flex-wrap mb-3">
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Total logged</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatHours(data.totalMinutes)}</div></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Billable</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatHours(data.billableMinutes)}</div></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Billable share</div><div style={{ fontSize: 22, fontWeight: 800 }}>{data.totalMinutes ? Math.round((data.billableMinutes / data.totalMinutes) * 100) : 0}%</div></div>
          </div>
          {grouped.length === 0 ? <EmptyState icon={BarChart3} title="No time logged" description="Nothing was logged in this period." /> : (
            <div className="d-flex flex-column gap-2">
              {grouped.map((g) => (
                <details key={g.name} style={{ border: '1px solid var(--hz-border)', borderRadius: 12 }}>
                  <summary className="d-flex align-items-center gap-3 p-3" style={{ cursor: 'pointer', listStyle: 'none' }}>
                    <div className="flex-grow-1 min-w-0"><strong>{g.name}</strong>{g.client && <span style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}> · {g.client}</span>}
                      <div style={{ height: 6, borderRadius: 99, background: 'var(--hz-gray-100)', overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ width: `${Math.round((g.minutes / Math.max(1, grouped[0].minutes)) * 100)}%`, height: '100%', background: 'var(--hz-primary-500)' }} />
                      </div>
                    </div>
                    <div className="text-end"><div style={{ fontWeight: 800 }}>{formatHours(g.minutes)}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{formatHours(g.billable)} billable</div></div>
                  </summary>
                  <ul className="list-unstyled mb-0 px-3 pb-3" style={{ fontSize: 13 }}>
                    {g.items.sort((a, b) => b.minutes - a.minutes).map((i) => (
                      <li key={i.name} className="d-flex justify-content-between py-1" style={{ borderTop: '1px solid var(--hz-divider, var(--hz-border))' }}>
                        <span>{i.name}</span><span>{formatHours(i.minutes)}{i.billable ? ` · ${formatHours(i.billable)} billable` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- settings

function SettingsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['timesheet-settings'], queryFn: timesheetsApi.settings });
  const [form, setForm] = useState(null);
  const current = form || (data && { ...data, weeklyTargetHours: String(data.weeklyTargetMinutes / 60) });
  const save = useMutation({
    mutationFn: () => timesheetsApi.updateSettings({ ...current, weeklyTargetMinutes: Math.round(Number(current.weeklyTargetHours || 0) * 60) }),
    onSuccess: (saved) => { queryClient.setQueryData(['timesheet-settings'], saved); setForm(null); toast.success('Timesheet settings saved.'); },
    onError: (err) => toast.error(errorText(err, 'Could not save the settings.')),
  });
  if (isLoading || !current) return <Card><SkeletonText lines={4} /></Card>;
  const set = (k, v) => setForm({ ...current, [k]: v });
  const Toggle = ({ field, title, detail }) => (
    <label className="d-flex align-items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--hz-divider, var(--hz-border))' }}>
      <input type="checkbox" className="form-check-input mt-1" checked={!!current[field]} onChange={(e) => set(field, e.target.checked)} />
      <span><strong style={{ fontSize: 14 }}>{title}</strong><span className="d-block" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{detail}</span></span>
    </label>
  );
  return (
    <Card title="Timesheet settings" actions={<Button size="sm" loading={save.isPending} disabled={!form} onClick={() => save.mutate()}>Save</Button>}>
      <Toggle field="enabled" title="Timesheets are on" detail="Employees see My Timesheet and can log time." />
      <div className="py-3" style={{ maxWidth: 260 }}>
        <FormField type="number" label="Weekly target (hours)" value={current.weeklyTargetHours} onChange={(v) => set('weeklyTargetHours', v)} min={0} max={168}
          hint="Employees can still submit less; approvers see the shortfall." />
      </div>
      <Toggle field="requireNotes" title="Require a note for every entry" detail="Ask people to describe what they did, not just the hours." />
      <Toggle field="promptOnCheckout" title="Ask to log work at check-out" detail="After checking out, employees get a quick “Log today's work” form." />
      <Toggle field="dailyReminder" title="Daily reminder (7 PM)" detail="Notify people who worked today but haven't logged any time." />
      <Toggle field="weeklyReminder" title="Monday reminder" detail="Notify people whose last week isn't submitted yet." />
    </Card>
  );
}
