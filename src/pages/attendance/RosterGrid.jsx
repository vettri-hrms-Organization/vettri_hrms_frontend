import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, Save, Undo2 } from 'lucide-react';
import { rosterApi } from '../../api/endpoints/shifts';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { addDays, apiError, formatDay, istToday, shortDayLabel, weekStart } from './shiftUtils';

const WEEK_OFF = 'WO';
const INHERIT = '';

/** Cell value in the select: '' = follow assignment/default, 'WO' = week off, otherwise a shift id. */
function cellValue(cell) {
  if (!cell.rostered) return INHERIT;
  if (cell.weekOff) return WEEK_OFF;
  return String(cell.shiftId ?? '');
}

export default function RosterGrid() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('ATTENDANCE_MANAGE');
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(() => weekStart(istToday()));
  const [days, setDays] = useState(7);
  const [changes, setChanges] = useState({}); // "employeeId|date" -> value
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyRepeat, setCopyRepeat] = useState(1);
  const to = addDays(from, days - 1);

  const roster = useQuery({ queryKey: ['roster', from, to], queryFn: () => rosterApi.get(from, to) });
  const shiftsById = useMemo(() => Object.fromEntries((roster.data?.shifts || []).map((s) => [String(s.id), s])), [roster.data]);
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(from, i)), [from, days]);
  const pending = Object.keys(changes).length;

  const save = useMutation({
    mutationFn: () => rosterApi.update(Object.entries(changes).map(([key, value]) => {
      const [employeeId, date] = key.split('|');
      return {
        employeeId: Number(employeeId),
        date,
        clear: value === INHERIT,
        weekOff: value === WEEK_OFF,
        shiftId: value !== INHERIT && value !== WEEK_OFF ? Number(value) : null,
      };
    })),
    onSuccess: (result) => {
      setChanges({});
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      toast.success(`Roster saved (${result.updated} day${result.updated === 1 ? '' : 's'} updated).`);
    },
    onError: (error) => toast.error(apiError(error, 'Roster could not be saved.')),
  });

  const copyWeek = useMutation({
    mutationFn: () => rosterApi.copyWeek({ sourceWeekStart: from, targetWeekStart: addDays(from, 7), repeatWeeks: Number(copyRepeat) || 1 }),
    onSuccess: (result) => {
      setCopyOpen(false);
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      toast.success(`Week copied (${result.updated} day${result.updated === 1 ? '' : 's'} updated).`);
    },
    onError: (error) => toast.error(apiError(error, 'Week could not be copied.')),
  });

  const move = async (delta) => {
    if (pending && !(await confirm({ title: 'Discard roster changes?', description: 'You have shift changes that are not saved yet. Moving to another week will discard them.', confirmLabel: 'Discard changes' }))) return;
    setChanges({});
    setFrom((current) => addDays(current, delta));
  };

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Attendance"
        title="Roster"
        description="Plan shifts and week offs per employee per day for rotational teams. Days left on “Default” follow the employee, department or company shift."
        actions={canEdit && (
          <>
            <Button variant="secondary" size="sm" icon={Copy} onClick={() => setCopyOpen(true)} disabled={pending > 0}>Copy week</Button>
            <Button variant="secondary" size="sm" icon={Undo2} onClick={() => setChanges({})} disabled={!pending}>Discard</Button>
            <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()} disabled={!pending}>
              Save{pending ? ` (${pending})` : ''}
            </Button>
          </>
        )}
      />

      <Card
        title={`${formatDay(from)} – ${formatDay(to)}`}
        actions={(
          <div className="d-flex align-items-center gap-2">
            <Button variant="secondary" size="sm" icon={ChevronLeft} aria-label="Previous period" onClick={() => move(-days)} />
            <Button variant="secondary" size="sm" onClick={() => { setChanges({}); setFrom(weekStart(istToday())); }}>This week</Button>
            <Button variant="secondary" size="sm" icon={ChevronRight} aria-label="Next period" onClick={() => move(days)} />
            <select className="form-select form-select-sm" style={{ width: 'auto' }} value={days} onChange={(e) => { setChanges({}); setDays(Number(e.target.value)); }} aria-label="Days shown">
              <option value={7}>1 week</option>
              <option value={14}>2 weeks</option>
            </select>
          </div>
        )}
      >
        {roster.isLoading && <SkeletonText lines={5} />}
        {roster.isError && <ErrorState description="Couldn’t load the roster." onRetry={() => roster.refetch()} />}
        {roster.data?.rows?.length === 0 && <EmptyState title="No employees in view" description="Employees you can see attendance for appear here." />}
        {roster.data?.rows?.length > 0 && (
          <div className="table-responsive" style={{ maxHeight: '70vh' }}>
            <table className="table table-sm align-middle mb-0" style={{ minWidth: 200 + days * 110 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--hz-surface, #fff)', zIndex: 1 }}>
                <tr>
                  <th scope="col" style={{ minWidth: 200 }}>Employee</th>
                  {dates.map((d) => <th key={d} scope="col" className="text-center" style={{ minWidth: 110 }}>{shortDayLabel(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {roster.data.rows.map((row) => (
                  <tr key={row.employeeId}>
                    <th scope="row" style={{ fontWeight: 500 }}>
                      <div>{row.employeeName}</div>
                      <div className="text-muted-hz" style={{ fontSize: 12 }}>{[row.employeeCode, row.departmentName].filter(Boolean).join(' · ')}</div>
                    </th>
                    {row.cells.map((cell) => {
                      const key = `${row.employeeId}|${cell.date}`;
                      const value = key in changes ? changes[key] : cellValue(cell);
                      const shift = value && value !== WEEK_OFF ? shiftsById[value] : null;
                      const effectiveOff = value === WEEK_OFF || (value === INHERIT && cell.weekOff && !(key in changes));
                      const color = effectiveOff ? 'var(--hz-gray-300, #cbd5e1)' : (shift?.color || (value === INHERIT ? cell.color : null) || 'var(--hz-gray-300, #cbd5e1)');
                      const label = effectiveOff ? 'Week off' : shift ? shift.code : `${cell.shiftCode || 'Default'}`;
                      return (
                        <td key={cell.date} className="text-center" style={{ borderLeft: `3px solid ${color}`, background: key in changes ? 'var(--hz-warning-50, #fffbeb)' : undefined }}>
                          {canEdit ? (
                            <select
                              className="form-select form-select-sm"
                              value={value}
                              aria-label={`${row.employeeName} on ${cell.date}`}
                              onChange={(e) => {
                                const next = e.target.value;
                                setChanges((current) => {
                                  const copy = { ...current };
                                  if (next === cellValue(cell)) delete copy[key]; else copy[key] = next;
                                  return copy;
                                });
                              }}
                            >
                              <option value={INHERIT}>{`Default${cell.rostered ? '' : ` (${cell.weekOff ? 'WO' : cell.shiftCode || '—'})`}`}</option>
                              <option value={WEEK_OFF}>Week off</option>
                              {roster.data.shifts.filter((s) => s.active || String(s.id) === value).map((s) => (
                                <option key={s.id} value={String(s.id)}>{s.code} {s.startTime}–{s.endTime}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: 13, color: effectiveOff ? 'var(--hz-text-muted)' : undefined }}>{label}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copy week"
        description={`Copies the roster of ${formatDay(from)} – ${formatDay(addDays(from, 6))} onto the following week(s). Days without a roster entry are reset to Default.`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCopyOpen(false)}>Cancel</Button>
            <Button loading={copyWeek.isPending} onClick={() => copyWeek.mutate()}>Copy</Button>
          </>
        )}
      >
        <FormField as="select" label="Repeat for" value={String(copyRepeat)} onChange={(v) => setCopyRepeat(v)}>
          {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} week{n === 1 ? '' : 's'}</option>)}
        </FormField>
      </Dialog>
    </div>
  );
}
