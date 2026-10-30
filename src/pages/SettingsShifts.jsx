import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { shiftsApi } from '../api/endpoints/shifts';
import { departmentsApi } from '../api/endpoints/organization';
import { employeesApi } from '../api/endpoints/employees';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import FormField from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { SkeletonText } from '../components/ui/Skeleton';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { apiError, formatDay, formatMinutes, istToday } from './attendance/shiftUtils';

const TABS = [
  { key: 'shifts', label: 'Shifts' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'policy', label: 'Overtime & late policy' },
];

const EMPTY_SHIFT = {
  name: '', code: '', startTime: '09:30', endTime: '18:30', breakMinutes: 60, graceInMinutes: 10,
  graceOutMinutes: 0, halfDayHours: 4, fullDayHours: 8, overtimeEnabled: false, minOvertimeMinutes: 30,
  color: '#2563eb', active: true,
};

export default function SettingsShifts() {
  const [tab, setTab] = useState('shifts');
  return (
    <div className="hz-admin-page hz-settings-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Settings"
        title="Shifts"
        description="Shift timings, grace periods and half-day rules drive late marks, half days and overtime. Rosters override these defaults day by day."
      />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'shifts' && <ShiftsPanel />}
      {tab === 'assignments' && <AssignmentsPanel />}
      {tab === 'policy' && <PolicyPanel />}
    </div>
  );
}

function ShiftsPanel() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | { id?, ...form }
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: shiftsApi.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shifts'] });

  const save = useMutation({
    mutationFn: ({ id, ...payload }) => (id ? shiftsApi.update(id, payload) : shiftsApi.create(payload)),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Shift saved.'); },
    onError: (error) => toast.error(apiError(error, 'Shift could not be saved.')),
  });
  const makeDefault = useMutation({
    mutationFn: shiftsApi.makeDefault,
    onSuccess: () => { invalidate(); toast.success('Default shift updated.'); },
    onError: (error) => toast.error(apiError(error, 'Default shift could not be changed.')),
  });
  const remove = useMutation({
    mutationFn: shiftsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Shift deleted.'); },
    onError: (error) => toast.error(apiError(error, 'Shift could not be deleted.')),
  });

  const set = (key, value) => setEditing((current) => ({ ...current, [key]: value }));

  return (
    <Card
      title="Shift master"
      subtitle="A shift whose end time is earlier than its start time runs overnight."
      actions={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing({ ...EMPTY_SHIFT })}>Add shift</Button>}
    >
      {shifts.isLoading && <SkeletonText lines={3} />}
      {shifts.isError && <ErrorState description="Couldn’t load shifts." onRetry={() => shifts.refetch()} />}
      {shifts.data?.length === 0 && <EmptyState title="No shifts yet" />}
      {shifts.data?.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Shift</th><th>Timing</th><th>Break</th><th>Grace in / out</th><th>Half / full day</th><th>Overtime</th><th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shifts.data.map((shift) => (
                <tr key={shift.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: shift.color || 'var(--hz-gray-300)', display: 'inline-block' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{shift.name}</div>
                        <div className="text-muted-hz" style={{ fontSize: 12 }}>{shift.code}</div>
                      </div>
                      {shift.companyDefault && <Badge variant="info">Company default</Badge>}
                      {!shift.active && <Badge variant="warning">Inactive</Badge>}
                    </div>
                  </td>
                  <td>
                    {shift.startTime} – {shift.endTime}
                    {shift.overnight && <span className="ms-1 text-muted-hz" title="Overnight shift"><Moon size={13} /></span>}
                    <div className="text-muted-hz" style={{ fontSize: 12 }}>{formatMinutes(shift.scheduledMinutes)} scheduled</div>
                  </td>
                  <td>{shift.breakMinutes} min</td>
                  <td>{shift.graceInMinutes} / {shift.graceOutMinutes} min</td>
                  <td>{shift.halfDayHours}h / {shift.fullDayHours}h</td>
                  <td>{shift.overtimeEnabled ? `After ${shift.minOvertimeMinutes} min` : 'Off'}</td>
                  <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-sm btn-light border-0" onClick={() => setEditing({ ...shift })} aria-label={`Edit ${shift.name}`}><Pencil size={14} /></button>
                    {!shift.companyDefault && shift.active && (
                      <button type="button" className="btn btn-sm btn-light border-0" onClick={() => makeDefault.mutate(shift.id)} title="Make company default" aria-label={`Make ${shift.name} the company default`}><Star size={14} /></button>
                    )}
                    {!shift.companyDefault && (
                      <button
                        type="button"
                        className="btn btn-sm btn-light border-0"
                        style={{ color: 'var(--hz-danger-600)' }}
                        onClick={async () => { if (await confirm({ title: `Delete shift "${shift.name}"?`, description: 'Employees and rosters using this shift will need a different shift assigned.', confirmLabel: 'Delete shift', irreversible: true })) remove.mutate(shift.id); }}
                        aria-label={`Delete ${shift.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit shift' : 'Add shift'}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={save.isPending}
              onClick={() => save.mutate({
                ...editing,
                breakMinutes: Number(editing.breakMinutes) || 0,
                graceInMinutes: Number(editing.graceInMinutes) || 0,
                graceOutMinutes: Number(editing.graceOutMinutes) || 0,
                minOvertimeMinutes: Number(editing.minOvertimeMinutes) || 0,
                halfDayHours: Number(editing.halfDayHours),
                fullDayHours: Number(editing.fullDayHours),
              })}
              disabled={!editing?.name?.trim() || !editing?.code?.trim()}
            >
              Save shift
            </Button>
          </>
        )}
      >
        {editing && (
          <div className="row g-3">
            <div className="col-12 col-md-8"><FormField label="Name" value={editing.name} onChange={(v) => set('name', v)} required /></div>
            <div className="col-12 col-md-4"><FormField label="Code" value={editing.code} onChange={(v) => set('code', v)} required maxLength={30} /></div>
            <div className="col-6 col-md-3"><FormField label="Start time" type="time" value={editing.startTime} onChange={(v) => set('startTime', v)} required /></div>
            <div className="col-6 col-md-3"><FormField label="End time" type="time" value={editing.endTime} onChange={(v) => set('endTime', v)} required hint={editing.endTime <= editing.startTime ? 'Ends next day (overnight)' : undefined} /></div>
            <div className="col-6 col-md-3"><FormField label="Break (min)" type="number" min={0} value={editing.breakMinutes} onChange={(v) => set('breakMinutes', v)} /></div>
            <div className="col-6 col-md-3"><FormField label="Colour" type="color" value={editing.color || '#2563eb'} onChange={(v) => set('color', v)} /></div>
            <div className="col-6 col-md-3"><FormField label="Grace in (min)" type="number" min={0} value={editing.graceInMinutes} onChange={(v) => set('graceInMinutes', v)} hint="Late after start + grace" /></div>
            <div className="col-6 col-md-3"><FormField label="Grace out (min)" type="number" min={0} value={editing.graceOutMinutes} onChange={(v) => set('graceOutMinutes', v)} hint="Early leave tolerance" /></div>
            <div className="col-6 col-md-3"><FormField label="Half-day hours" type="number" min={0} step="0.25" value={editing.halfDayHours} onChange={(v) => set('halfDayHours', v)} /></div>
            <div className="col-6 col-md-3"><FormField label="Full-day hours" type="number" min={0} step="0.25" value={editing.fullDayHours} onChange={(v) => set('fullDayHours', v)} hint="Worked = out − in − break" /></div>
            <div className="col-6 col-md-4 d-flex align-items-center gap-2">
              <input id="shift-ot" type="checkbox" className="form-check-input" checked={!!editing.overtimeEnabled} onChange={(e) => set('overtimeEnabled', e.target.checked)} />
              <label htmlFor="shift-ot">Overtime enabled</label>
            </div>
            <div className="col-6 col-md-4"><FormField label="Minimum OT (min)" type="number" min={0} value={editing.minOvertimeMinutes} onChange={(v) => set('minOvertimeMinutes', v)} disabled={!editing.overtimeEnabled} /></div>
            <div className="col-6 col-md-4 d-flex align-items-center gap-2">
              <input id="shift-active" type="checkbox" className="form-check-input" checked={editing.active !== false} onChange={(e) => set('active', e.target.checked)} />
              <label htmlFor="shift-active">Active</label>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function AssignmentsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ shiftId: '', targetType: 'DEPARTMENT', departmentId: '', employeeId: '', effectiveFrom: istToday() });
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: shiftsApi.list });
  const assignments = useQuery({ queryKey: ['shift-assignments'], queryFn: shiftsApi.assignments });
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const employees = useQuery({ queryKey: ['employees', 'shift-assignment'], queryFn: () => employeesApi.list(), enabled: form.targetType === 'EMPLOYEE' });

  const save = useMutation({
    mutationFn: () => shiftsApi.saveAssignment({
      shiftId: Number(form.shiftId),
      departmentId: form.targetType === 'DEPARTMENT' ? Number(form.departmentId) : null,
      employeeId: form.targetType === 'EMPLOYEE' ? Number(form.employeeId) : null,
      effectiveFrom: form.effectiveFrom,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shift-assignments'] }); toast.success('Assignment saved.'); },
    onError: (error) => toast.error(apiError(error, 'Assignment could not be saved.')),
  });
  const remove = useMutation({
    mutationFn: shiftsApi.removeAssignment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shift-assignments'] }),
    onError: (error) => toast.error(apiError(error, 'Assignment could not be removed.')),
  });

  const employeeList = Array.isArray(employees.data) ? employees.data : employees.data?.content || [];
  const targetChosen = form.targetType === 'DEPARTMENT' ? form.departmentId : form.employeeId;

  return (
    <div className="d-flex flex-column gap-4">
      <Card title="Assign a default shift" subtitle="Resolution order: roster day › employee › department › company default. An assignment applies from its effective date until a newer one.">
        <form className="row g-3 align-items-end" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="col-12 col-md-3">
            <FormField as="select" label="Shift" value={form.shiftId} onChange={(v) => setForm({ ...form, shiftId: v })} required>
              <option value="">Choose…</option>
              {shifts.data?.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
            </FormField>
          </div>
          <div className="col-6 col-md-2">
            <FormField as="select" label="Applies to" value={form.targetType} onChange={(v) => setForm({ ...form, targetType: v })}>
              <option value="DEPARTMENT">Department</option>
              <option value="EMPLOYEE">Employee</option>
            </FormField>
          </div>
          <div className="col-6 col-md-3">
            {form.targetType === 'DEPARTMENT' ? (
              <FormField as="select" label="Department" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} required>
                <option value="">Choose…</option>
                {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </FormField>
            ) : (
              <FormField as="select" label="Employee" value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })} required>
                <option value="">{employees.isLoading ? 'Loading…' : 'Choose…'}</option>
                {employeeList.map((e) => <option key={e.id} value={e.id}>{e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim()} {e.employeeCode ? `(${e.employeeCode})` : ''}</option>)}
              </FormField>
            )}
          </div>
          <div className="col-6 col-md-2"><FormField label="Effective from" type="date" value={form.effectiveFrom} onChange={(v) => setForm({ ...form, effectiveFrom: v })} required /></div>
          <div className="col-6 col-md-2"><Button type="submit" className="w-100 justify-content-center" loading={save.isPending} disabled={!form.shiftId || !targetChosen || !form.effectiveFrom}>Assign</Button></div>
        </form>
      </Card>

      <Card title="Current assignments">
        {assignments.isLoading && <SkeletonText lines={3} />}
        {assignments.isError && <ErrorState description="Couldn’t load assignments." onRetry={() => assignments.refetch()} />}
        {assignments.data?.length === 0 && <EmptyState title="No assignments" description="Everyone follows the company default shift." />}
        {assignments.data?.length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Applies to</th><th>Shift</th><th>Effective from</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {assignments.data.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Badge variant={a.targetType === 'EMPLOYEE' ? 'info' : 'neutral'}>{a.targetType === 'EMPLOYEE' ? 'Employee' : 'Department'}</Badge>{' '}
                      {a.targetType === 'EMPLOYEE' ? `${a.employeeName}${a.employeeCode ? ` (${a.employeeCode})` : ''}` : a.departmentName}
                    </td>
                    <td>{a.shiftName} <span className="text-muted-hz">({a.shiftCode})</span></td>
                    <td>{formatDay(a.effectiveFrom)}</td>
                    <td className="text-end">
                      <button type="button" className="btn btn-sm btn-light border-0" style={{ color: 'var(--hz-danger-600)' }} onClick={() => remove.mutate(a.id)} aria-label="Remove assignment"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function PolicyPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const settings = useQuery({ queryKey: ['shift-settings'], queryFn: shiftsApi.settings });
  const [form, setForm] = useState(null);
  const current = form || settings.data;

  const save = useMutation({
    mutationFn: () => shiftsApi.updateSettings({
      ...current,
      overtimeMultiplier: Number(current.overtimeMultiplier),
      overtimeFlatHourlyRate: current.overtimeFlatHourlyRate === '' || current.overtimeFlatHourlyRate == null ? null : Number(current.overtimeFlatHourlyRate),
      lateMarksPerPenalty: Number(current.lateMarksPerPenalty),
      latePenaltyDays: Number(current.latePenaltyDays),
    }),
    onSuccess: (data) => { queryClient.setQueryData(['shift-settings'], data); setForm(null); toast.success('Policy saved.'); },
    onError: (error) => toast.error(apiError(error, 'Policy could not be saved.')),
  });

  if (settings.isLoading) return <Card><SkeletonText lines={4} /></Card>;
  if (settings.isError) return <Card><ErrorState description="Couldn’t load the policy." onRetry={() => settings.refetch()} /></Card>;
  const set = (key, value) => setForm({ ...current, [key]: value });

  return (
    <Card title="Overtime & late policy" subtitle="Approved overtime is paid in the next payroll run; late-mark penalties are deducted as loss of pay.">
      <form className="row g-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="col-12"><h3 style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, margin: 0 }}>Overtime rate</h3></div>
        <div className="col-12 col-md-4">
          <FormField as="select" label="Rate type" value={current.overtimeRateType} onChange={(v) => set('overtimeRateType', v)}>
            <option value="MULTIPLIER">Multiple of hourly rate</option>
            <option value="FLAT">Flat amount per hour</option>
          </FormField>
        </div>
        {current.overtimeRateType === 'FLAT' ? (
          <div className="col-12 col-md-4"><FormField label="Amount per hour (₹)" type="number" min={0} step="0.01" value={current.overtimeFlatHourlyRate ?? ''} onChange={(v) => set('overtimeFlatHourlyRate', v)} required /></div>
        ) : (
          <div className="col-12 col-md-4">
            <FormField as="select" label="Multiplier" value={String(Number(current.overtimeMultiplier))} onChange={(v) => set('overtimeMultiplier', v)} hint="Hourly rate = monthly gross ÷ (working days × shift hours)">
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
              <option value="2.5">2.5x</option>
              <option value="3">3x</option>
            </FormField>
          </div>
        )}
        <div className="col-12 mt-4"><h3 style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, margin: 0 }}>Late-mark penalty</h3></div>
        <div className="col-12 col-md-4 d-flex align-items-center gap-2">
          <input id="late-penalty" type="checkbox" className="form-check-input" checked={!!current.latePenaltyEnabled} onChange={(e) => set('latePenaltyEnabled', e.target.checked)} />
          <label htmlFor="late-penalty">Deduct pay for repeated late marks</label>
        </div>
        <div className="col-6 col-md-4"><FormField label="Every N late marks in a month" type="number" min={1} max={31} value={current.lateMarksPerPenalty} onChange={(v) => set('lateMarksPerPenalty', v)} disabled={!current.latePenaltyEnabled} /></div>
        <div className="col-6 col-md-4"><FormField label="Loss of pay (days)" type="number" min={0.25} step="0.25" value={current.latePenaltyDays} onChange={(v) => set('latePenaltyDays', v)} disabled={!current.latePenaltyEnabled} /></div>
        <div className="col-12"><Button type="submit" loading={save.isPending} disabled={!form}>Save policy</Button></div>
      </form>
    </Card>
  );
}
