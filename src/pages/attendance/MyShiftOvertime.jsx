import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Timer } from 'lucide-react';
import { dailyAttendanceApi, overtimeApi } from '../../api/endpoints/shifts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatusBadge, { formatStatusLabel } from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { DAY_STATUS_VARIANT, OT_STATUS_VARIANT, addDays, apiError, formatDay, formatMinutes, formatPunch, istToday } from './shiftUtils';

/**
 * Self-service: day-by-day shift evaluation (shift, in/out, worked, late, early, OT) for a month,
 * plus the employee's overtime entries and an overtime claim form. Used on My Attendance.
 */
export default function MyShiftOvertime({ from, to }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = istToday();
  const rangeTo = to > today ? today : to;
  const [claimDate, setClaimDate] = useState(() => addDays(today, -1));
  const [claimNote, setClaimNote] = useState('');

  const daily = useQuery({
    queryKey: ['attendance-daily-me', from, rangeTo],
    queryFn: () => dailyAttendanceApi.mine(from, rangeTo),
    enabled: from <= rangeTo,
  });
  const overtime = useQuery({ queryKey: ['overtime-mine'], queryFn: overtimeApi.mine });

  const claim = useMutation({
    mutationFn: () => overtimeApi.claim(claimDate, claimNote.trim() || null),
    onSuccess: () => {
      setClaimNote('');
      queryClient.invalidateQueries({ queryKey: ['overtime-mine'] });
      toast.success('Overtime submitted for approval.');
    },
    onError: (error) => toast.error(apiError(error, 'Overtime could not be claimed.')),
  });

  const rows = daily.data || [];
  const lateCount = rows.filter((r) => r.late).length;
  const otMinutes = rows.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
  const currentShift = rows[0];

  return (
    <>
      <Card
        title="Shift & daily summary"
        subtitle={currentShift ? `Current shift: ${currentShift.shiftName} (${currentShift.shiftStart}–${currentShift.shiftEnd})` : 'Your shift, punctuality and overtime by day.'}
        actions={rows.length > 0 && (
          <div className="d-flex gap-2">
            <Badge variant={lateCount ? 'warning' : 'success'}>{lateCount} late mark{lateCount === 1 ? '' : 's'}</Badge>
            <Badge variant="info">OT {formatMinutes(otMinutes) === '—' ? '0m' : formatMinutes(otMinutes)}</Badge>
          </div>
        )}
      >
        {daily.isLoading && <SkeletonText lines={4} />}
        {daily.isError && <ErrorState description="Couldn’t load your daily summary." onRetry={() => daily.refetch()} />}
        {!daily.isLoading && !daily.isError && rows.length === 0 && (
          <EmptyState icon={CalendarDays} title="Nothing to show" description="Daily summaries appear once the month has started." />
        )}
        {rows.length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Date</th><th>Shift</th><th>First in</th><th>Last out</th><th>Worked</th><th>Status</th><th>Late / early</th><th>Overtime</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td>{formatDay(r.date)}</td>
                    <td>
                      <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: r.shiftColor || 'var(--hz-gray-300)' }} />
                      {r.shiftCode} <span className="text-muted-hz" style={{ fontSize: 12 }}>{r.shiftStart}–{r.shiftEnd}</span>
                    </td>
                    <td>{formatPunch(r.firstIn)}</td>
                    <td>{r.missingOut ? <span className="text-muted-hz">Missing</span> : formatPunch(r.lastOut)}</td>
                    <td>{formatMinutes(r.workedMinutes)}</td>
                    <td><StatusBadge status={r.status} variant={DAY_STATUS_VARIANT[r.status] || 'neutral'} dot={false}>{formatStatusLabel(r.status)}</StatusBadge></td>
                    <td>
                      {r.late && <Badge variant="warning">Late {formatMinutes(r.lateInMinutes)}</Badge>}{' '}
                      {r.earlyOut && <Badge variant="warning">Early {formatMinutes(r.earlyOutMinutes)}</Badge>}
                      {!r.late && !r.earlyOut && '—'}
                    </td>
                    <td>{formatMinutes(r.overtimeMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="My overtime" subtitle="Overtime is calculated from your punches after the shift ends. Claim a day if it is not listed yet; your manager approves it and it is paid in the next payroll.">
        <form className="row g-3 align-items-end mb-3" onSubmit={(e) => { e.preventDefault(); claim.mutate(); }}>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="ot-claim-date">Work date</label>
            <input id="ot-claim-date" type="date" className="form-control" max={today} value={claimDate} onChange={(e) => setClaimDate(e.target.value)} required />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="ot-claim-note">Note</label>
            <input id="ot-claim-note" className="form-control" maxLength={500} placeholder="What did you work on? (optional)" value={claimNote} onChange={(e) => setClaimNote(e.target.value)} />
          </div>
          <div className="col-12 col-md-3">
            <Button type="submit" className="w-100" icon={Timer} loading={claim.isPending} disabled={!claimDate}>Claim overtime</Button>
          </div>
        </form>
        {overtime.isLoading && <SkeletonText lines={2} />}
        {overtime.isError && <ErrorState description="Couldn’t load your overtime." onRetry={() => overtime.refetch()} />}
        {overtime.data?.length === 0 && <EmptyState icon={Timer} title="No overtime yet" description="Approved and pending overtime will appear here." />}
        {overtime.data?.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead><tr><th>Date</th><th>Overtime</th><th>Status</th><th>Amount</th><th>Review note</th></tr></thead>
              <tbody>
                {overtime.data.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDay(e.workDate)}</td>
                    <td>{formatMinutes(e.approvedMinutes ?? e.computedMinutes)}</td>
                    <td><StatusBadge status={e.status} variant={OT_STATUS_VARIANT[e.status]} dot={false}>{e.status === 'REJECTED' ? 'Declined' : formatStatusLabel(e.status)}</StatusBadge></td>
                    <td>{e.amount == null ? '—' : `₹${Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</td>
                    <td>{e.reviewNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
