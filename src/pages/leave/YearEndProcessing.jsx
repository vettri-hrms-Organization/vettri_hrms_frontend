import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Download, PlayCircle, RefreshCw } from 'lucide-react';
import { leavePolicyApi } from '../../api/endpoints/leave';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Dialog from '../../components/ui/Dialog';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import SearchField from '../../components/ui/SearchField';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { exportToCsv } from '../../utils/exportToCsv';
import { formatDateTimeIST } from '../../utils/formatDateTime';

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0');

/**
 * HR "Year-end processing": preview, per employee and leave type, the closing balance and how it splits into
 * carried forward / lapsed / encashable, then run it. Running writes next year's carried-forward days and
 * can be repeated safely (it overwrites with the recomputed figures). The same run happens automatically on 1 Jan.
 */
export default function YearEndProcessing() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['leave-year-end', year],
    queryFn: () => leavePolicyApi.yearEndPreview(year),
  });

  const run = useMutation({
    mutationFn: () => leavePolicyApi.runYearEnd(year),
    onSuccess: (result) => {
      setConfirm(false);
      queryClient.setQueryData(['leave-year-end', year], result);
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      toast.success(`Year-end ${year} processed: ${fmt(result.totalCarried)} day(s) carried into ${year + 1}.`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Year-end processing failed.'),
  });

  const accruals = useMutation({
    mutationFn: leavePolicyApi.runAccruals,
    onSuccess: (r) => toast.success(`Accrual balances refreshed (${r.rowsWritten} row(s)).`),
    onError: (err) => toast.error(err.response?.data?.message || 'Could not refresh accruals.'),
  });

  const rows = useMemo(() => {
    const all = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.employeeName?.toLowerCase().includes(q) || r.employeeCode?.toLowerCase().includes(q) || r.leaveTypeName?.toLowerCase().includes(q));
  }, [data, search]);

  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <Card
      title="Year-end processing"
      subtitle="Leave year = calendar year (Jan–Dec). Runs automatically on 1 January (IST); you can preview and re-run it here."
      actions={(
        <div className="d-flex gap-2 flex-wrap">
          <select className="form-select form-select-sm" style={{ width: 120 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Closing year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={accruals.isPending} onClick={() => accruals.mutate()}>Refresh accruals</Button>
          <Button size="sm" variant="secondary" icon={Download} disabled={!rows.length}
            onClick={() => exportToCsv(`leave-year-end-${year}`, rows.map((r) => ({
              Employee: r.employeeName, Code: r.employeeCode || '', 'Leave Type': r.leaveTypeName,
              Closing: r.closing, Carried: r.carried, Lapsed: r.lapsed, Encashable: r.encashable, Processed: r.processed ? 'Yes' : 'No',
            })))}
          >Export</Button>
          <Button size="sm" icon={PlayCircle} disabled={!data || isFetching} onClick={() => setConfirm(true)}>Run year-end</Button>
        </div>
      )}
    >
      {isLoading && <SkeletonText lines={6} />}
      {isError && <ErrorState description="Couldn't load the year-end preview." onRetry={refetch} />}
      {data && (
        <>
          <div className="hz-inline-summary mb-3" aria-label="Year-end summary">
            <Summary label="Employees" value={data.employees} />
            <Summary label={`Carried into ${data.nextYear}`} value={fmt(data.totalCarried)} tone="success" />
            <Summary label="Lapsing" value={fmt(data.totalLapsed)} tone="danger" />
            <Summary label="Encashable (of lapsing)" value={fmt(data.totalEncashable)} tone="warning" />
          </div>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
              {data.projected ? <Badge variant="warning">Projected</Badge> : null}{' '}
              {data.projected ? 'The year is not over yet - figures assume the full year’s accrual and approvals so far. ' : ''}
              {data.lastProcessedAt ? `Last processed ${formatDateTimeIST(data.lastProcessedAt)}.` : 'Not processed yet.'}
            </div>
            <SearchField value={search} onChange={setSearch} placeholder="Filter employee or type…" aria-label="Filter year-end rows" />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Nothing to process" description="No employees or carry-forward leave types for this year." />
          ) : (
            <div className="table-responsive">
              <table className="table mb-0 align-middle hz-table" aria-label={`Year-end ${year} preview`}>
                <thead>
                  <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                    <th>Employee</th><th>Leave type</th><th className="text-end">Closing</th><th className="text-end">Carried</th>
                    <th className="text-end">Lapsed</th><th className="text-end">Encashable</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.employeeId}-${r.leaveTypeId}`} style={{ fontSize: 'var(--hz-text-sm)' }}>
                      <td><div style={{ fontWeight: 600 }}>{r.employeeName}</div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.employeeCode}</div></td>
                      <td>{r.leaveTypeName}</td>
                      <td className="text-end">{fmt(r.closing)}</td>
                      <td className="text-end">{fmt(r.carried)}</td>
                      <td className="text-end">{fmt(r.lapsed)}</td>
                      <td className="text-end">{fmt(r.encashable)}</td>
                      <td>{r.processed ? <Badge variant="success">Processed</Badge> : <Badge variant="neutral">Pending</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Run year-end for ${year}?`} description={`Sets ${year + 1} carried-forward days for every employee from the figures above. Re-running later recomputes and overwrites them.`}>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button loading={run.isPending} onClick={() => run.mutate()}>Run year-end</Button>
        </div>
      </Dialog>
    </Card>
  );
}

function Summary({ label, value, tone = 'neutral' }) {
  return <div className={`hz-inline-summary__item hz-inline-summary__item--${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
