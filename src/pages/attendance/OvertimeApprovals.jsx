import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, RefreshCw, Timer, X } from 'lucide-react';
import { overtimeApi } from '../../api/endpoints/shifts';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { exportToCsv } from '../../utils/exportToCsv';
import { OT_STATUS_VARIANT, addDays, apiError, formatDay, formatMinutes, istToday } from './shiftUtils';

const formatInr = (value) => (value == null ? '—' : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export default function OvertimeApprovals() {
  const { hasPermission, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [from, setFrom] = useState(() => addDays(istToday(), -60));
  const [to, setTo] = useState(() => istToday());
  const [minutes, setMinutes] = useState({}); // id -> approved minutes override
  const [notes, setNotes] = useState({});
  const [generateDate, setGenerateDate] = useState(() => addDays(istToday(), -1));

  const entries = useQuery({
    queryKey: ['overtime', status, from, to],
    queryFn: () => overtimeApi.list(status, from, to),
    enabled: !!from && !!to && from <= to,
  });

  const review = useMutation({
    mutationFn: ({ id, approved }) => overtimeApi.review(id, approved, approved && minutes[id] ? Number(minutes[id]) : null, notes[id] || null),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      toast.success(entry.status === 'APPROVED' ? 'Overtime approved.' : 'Overtime declined.');
    },
    onError: (error) => toast.error(apiError(error, 'Overtime could not be reviewed.')),
  });

  const generate = useMutation({
    mutationFn: () => overtimeApi.generate(generateDate),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      toast.success(`${result.created} new overtime entr${result.created === 1 ? 'y' : 'ies'} for ${formatDay(generateDate)}.`);
    },
    onError: (error) => toast.error(apiError(error, 'Overtime could not be recalculated.')),
  });

  const rows = entries.data || [];
  const exportRows = () => exportToCsv(`overtime-${from}-to-${to}`, rows.map((e) => ({
    Date: e.workDate,
    'Employee code': e.employeeCode || '',
    Employee: e.employeeName,
    Shift: e.shiftName || '',
    'Computed (min)': e.computedMinutes,
    'Approved (min)': e.approvedMinutes ?? '',
    Status: e.status,
    'Amount (INR)': e.amount ?? '',
    Note: e.employeeNote || '',
  })));

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Attendance"
        title="Overtime approvals"
        description="Overtime is calculated nightly from punches beyond the shift end (and claimed by employees). Approved overtime is paid in the next payroll run."
        actions={<Button variant="secondary" size="sm" icon={Download} onClick={exportRows} disabled={!rows.length}>Export CSV</Button>}
      />

      <Card>
        <div className="row g-3 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="ot-status">Status</label>
            <select id="ot-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Declined</option>
              <option value="PAID">Paid</option>
              <option value="">All</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="ot-from">From</label>
            <input id="ot-from" type="date" className="form-control" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="ot-to">To</label>
            <input id="ot-to" type="date" className="form-control" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          {hasPermission('ATTENDANCE_MANAGE') && (
            <div className="col-6 col-md-3 d-flex gap-2 align-items-end">
              <div className="flex-grow-1">
                <label className="form-label" htmlFor="ot-generate">Recalculate day</label>
                <input id="ot-generate" type="date" className="form-control" value={generateDate} max={istToday()} onChange={(e) => setGenerateDate(e.target.value)} />
              </div>
              <Button variant="secondary" icon={RefreshCw} loading={generate.isPending} onClick={() => generate.mutate()} aria-label="Recalculate overtime" disabled={!generateDate} />
            </div>
          )}
        </div>
      </Card>

      <Card title="Overtime entries">
        {entries.isLoading && <SkeletonText lines={5} />}
        {entries.isError && <ErrorState description={apiError(entries.error, 'Couldn’t load overtime.')} onRetry={() => entries.refetch()} />}
        {!entries.isLoading && !entries.isError && rows.length === 0 && (
          <EmptyState icon={Timer} title="No overtime entries" description="Nothing matches these filters." />
        )}
        {rows.length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr><th>Date</th><th>Employee</th><th>Shift</th><th>Overtime</th><th>Status</th><th>Amount</th><th>Note</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const isPending = e.status === 'PENDING';
                  const isOwn = user?.employeeId && String(user.employeeId) === String(e.employeeId);
                  return (
                    <tr key={e.id}>
                      <td>{formatDay(e.workDate)}</td>
                      <td><div style={{ fontWeight: 600 }}>{e.employeeName}</div><div className="text-muted-hz" style={{ fontSize: 12 }}>{[e.employeeCode, e.departmentName].filter(Boolean).join(' · ')}</div></td>
                      <td>{e.shiftName || '—'}</td>
                      <td>
                        {isPending && !isOwn ? (
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            style={{ width: 90 }}
                            min={1}
                            max={e.computedMinutes}
                            placeholder={String(e.computedMinutes)}
                            value={minutes[e.id] ?? ''}
                            onChange={(event) => setMinutes((m) => ({ ...m, [e.id]: event.target.value }))}
                            aria-label={`Approved minutes for ${e.employeeName} on ${e.workDate}`}
                            title="Minutes to approve (defaults to all)"
                          />
                        ) : null}
                        <div className="text-muted-hz" style={{ fontSize: 12 }}>
                          {formatMinutes(e.computedMinutes)} computed{e.approvedMinutes != null ? ` · ${formatMinutes(e.approvedMinutes)} approved` : ''}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={e.status} variant={OT_STATUS_VARIANT[e.status]} dot={false}>{e.status === 'REJECTED' ? 'Declined' : e.status}</StatusBadge>
                        <div className="text-muted-hz" style={{ fontSize: 12 }}>{e.source === 'EMPLOYEE' ? 'Claimed' : 'System'}{e.reviewedByName ? ` · ${e.reviewedByName}` : ''}</div>
                      </td>
                      <td>{formatInr(e.amount)}</td>
                      <td style={{ maxWidth: 220 }}>
                        {e.employeeNote && <div style={{ fontSize: 13 }}>{e.employeeNote}</div>}
                        {isPending && !isOwn ? (
                          <input className="form-control form-control-sm mt-1" placeholder="Review note (optional)" maxLength={500} value={notes[e.id] || ''} onChange={(event) => setNotes((n) => ({ ...n, [e.id]: event.target.value }))} aria-label="Review note" />
                        ) : e.reviewNote && <div className="text-muted-hz" style={{ fontSize: 12 }}>{e.reviewNote}</div>}
                      </td>
                      <td className="text-end text-nowrap">
                        {isPending && !isOwn && (
                          <>
                            <Button size="sm" icon={Check} onClick={() => review.mutate({ id: e.id, approved: true })} disabled={review.isPending}>Approve</Button>{' '}
                            <Button size="sm" variant="secondary" icon={X} onClick={() => review.mutate({ id: e.id, approved: false })} disabled={review.isPending}>Decline</Button>
                          </>
                        )}
                        {isPending && isOwn && <span className="text-muted-hz" style={{ fontSize: 12 }}>Your own entry</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
