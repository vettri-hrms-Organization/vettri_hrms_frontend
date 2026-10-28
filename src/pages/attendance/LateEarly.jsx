import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TimerOff } from 'lucide-react';
import { dailyAttendanceApi } from '../../api/endpoints/shifts';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { exportToCsv } from '../../utils/exportToCsv';
import { apiError, formatDay, formatMinutes, formatPunch, istToday, monthStart } from './shiftUtils';

export default function LateEarly() {
  const [from, setFrom] = useState(() => monthStart(istToday()));
  const [to, setTo] = useState(() => istToday());
  const report = useQuery({
    queryKey: ['late-early', from, to],
    queryFn: () => dailyAttendanceApi.lateEarly(from, to),
    enabled: !!from && !!to && from <= to,
  });
  const data = report.data;

  const exportRows = () => exportToCsv(`late-early-${from}-to-${to}`, (data?.rows || []).map((r) => ({
    Date: r.date,
    'Employee code': r.employeeCode || '',
    Employee: r.employeeName,
    Department: r.departmentName || '',
    Shift: `${r.shiftCode} ${r.shiftStart}-${r.shiftEnd}`,
    'First in': formatPunch(r.firstIn),
    'Last out': formatPunch(r.lastOut),
    'Late (min)': r.lateInMinutes,
    'Early out (min)': r.earlyOutMinutes,
  })));

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Attendance"
        title="Late & early"
        description="Late arrivals beyond the shift's grace period and early departures, for the employees you can see."
        actions={<Button variant="secondary" size="sm" icon={Download} onClick={exportRows} disabled={!data?.rows?.length}>Export CSV</Button>}
      />

      <Card>
        <div className="row g-3 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="le-from">From</label>
            <input id="le-from" type="date" className="form-control" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="le-to">To</label>
            <input id="le-to" type="date" className="form-control" value={to} min={from} max={istToday()} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="col-12 col-md-6 text-muted-hz" style={{ fontSize: 13 }}>
            {data?.latePenaltyEnabled
              ? `Policy: every ${data.lateMarksPerPenalty} late marks in a month = ${data.latePenaltyDays} day(s) loss of pay. Penalties show when the range is within one month.`
              : 'No late-mark pay penalty is configured.'}
          </div>
        </div>
      </Card>

      {report.isLoading && <Card><SkeletonText lines={5} /></Card>}
      {report.isError && <Card><ErrorState description={apiError(report.error, 'Couldn’t load late & early marks.')} onRetry={() => report.refetch()} /></Card>}

      {data && (
        <>
          <Card title="Summary by employee">
            {data.summary.length === 0 ? (
              <EmptyState icon={TimerOff} title="No late or early marks" description="Everyone kept to their shift timings in this period." />
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead><tr><th>Employee</th><th>Late marks</th><th>Late time</th><th>Early outs</th><th>Early time</th>{data.latePenaltyEnabled && <th>LOP penalty</th>}</tr></thead>
                  <tbody>
                    {data.summary.map((s) => (
                      <tr key={s.employeeId}>
                        <td><div style={{ fontWeight: 600 }}>{s.employeeName}</div><div className="text-muted-hz" style={{ fontSize: 12 }}>{[s.employeeCode, s.departmentName].filter(Boolean).join(' · ')}</div></td>
                        <td>{s.lateCount}</td>
                        <td>{formatMinutes(s.lateMinutes)}</td>
                        <td>{s.earlyCount}</td>
                        <td>{formatMinutes(s.earlyMinutes)}</td>
                        {data.latePenaltyEnabled && <td>{s.penaltyDays == null ? '—' : Number(s.penaltyDays) > 0 ? <Badge variant="warning">{Number(s.penaltyDays)} day(s)</Badge> : '0'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.rows.length > 0 && (
            <Card title="Daily marks">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead><tr><th>Date</th><th>Employee</th><th>Shift</th><th>First in</th><th>Last out</th><th>Late</th><th>Early out</th></tr></thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={`${r.employeeId}-${r.date}`}>
                        <td>{formatDay(r.date)}</td>
                        <td>{r.employeeName}</td>
                        <td>{r.shiftCode} <span className="text-muted-hz">{r.shiftStart}–{r.shiftEnd}</span></td>
                        <td>{formatPunch(r.firstIn)}</td>
                        <td>{formatPunch(r.lastOut)}</td>
                        <td>{r.late ? <Badge variant="warning">{formatMinutes(r.lateInMinutes)}</Badge> : '—'}</td>
                        <td>{r.earlyOut ? <Badge variant="warning">{formatMinutes(r.earlyOutMinutes)}</Badge> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
