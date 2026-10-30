import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, PlayCircle, Wallet, PauseCircle, Play, XCircle, Receipt, Download, Landmark, FileText } from 'lucide-react';
import { payrollApi } from '../../api/endpoints/salary';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { Skeleton, SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../utils/formatCurrency';
import { exportToCsv } from '../../utils/exportToCsv';
import PayrollStatusBadge from './components/PayrollStatusBadge';
import NewPayrollRunModal from './components/NewPayrollRunModal';
import StatutoryExportsCard from './components/StatutoryExportsCard';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import { PAYROLL_STEPS, PayrollChecklist, PayrollStepper, currentStepIndex, usePayrollChecklist } from './components/PayrollRunGuide';

export default function PayrollProcessing() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [showNewRun, setShowNewRun] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const { hasPermission } = useAuth();
  // The bank file carries full account numbers, so it is SALARY_MANAGE only (enforced server-side too).
  const canManage = hasPermission('SALARY_MANAGE');

  const { data: runs = [], isLoading: loadingRuns, isError: runsError, refetch: refetchRuns } = useQuery({ queryKey: ['payroll-runs'], queryFn: payrollApi.listRuns });

  const activeRunId = selectedRunId ?? runs[0]?.id ?? null;

  const { data: runDetail, isLoading: loadingDetail, isError, refetch } = useQuery({
    queryKey: ['payroll-run', activeRunId],
    queryFn: () => payrollApi.getRun(activeRunId),
    enabled: !!activeRunId,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-run', activeRunId] });
    queryClient.invalidateQueries({ queryKey: ['salary-dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['salary-employees'] });
  }

  const holdMutation = useMutation({
    mutationFn: ({ itemId, onHold }) => payrollApi.setItemHold(activeRunId, itemId, { onHold }),
    onSuccess: invalidateAll,
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update that employee'),
  });

  const processMutation = useMutation({
    mutationFn: () => payrollApi.process(activeRunId),
    onSuccess: () => {
      invalidateAll();
      toast.success('Payroll processed. Review the totals, then mark the run as paid.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not process this run'),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => payrollApi.markPaid(activeRunId, {}),
    onSuccess: () => {
      invalidateAll();
      toast.success('Payroll marked as paid');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not mark this run as paid'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => payrollApi.cancel(activeRunId),
    onSuccess: () => {
      setSelectedRunId(null);
      invalidateAll();
      toast.success('Draft payroll run cancelled');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not cancel this run'),
  });

  const items = runDetail?.items || [];
  const run = runDetail?.run;

  const counts = useMemo(() => {
    const byStatus = { PENDING: 0, ON_HOLD: 0, PROCESSED: 0, PAID: 0 };
    items.forEach((i) => {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    });
    return byStatus;
  }, [items]);

  const preflight = {
    hasEmployees: items.length > 0,
    onHold: counts.ON_HOLD,
    pending: counts.PENDING,
  };

  const checks = usePayrollChecklist({ run, items, onHoldCount: counts.ON_HOLD, hasPermission });
  const processBlocked = !preflight.hasEmployees || preflight.onHold > 0;
  const stepIndex = run ? currentStepIndex(run.status) : 0;
  // In DRAFT the user is reviewing; the action they're heading for is Process.
  const nextStep = PAYROLL_STEPS[Math.min(stepIndex + (run?.status === 'DRAFT' ? 1 : 0), PAYROLL_STEPS.length - 1)];

  function requestConfirmation(action) {
    if (action === 'process' && (!preflight.hasEmployees || preflight.onHold > 0)) {
      toast.warning('Resolve the payroll holds and make sure employees are included before processing.');
      return;
    }
    setConfirmAction(action);
  }

  async function download(key, request, failureMessage) {
    setDownloading(key);
    try {
      await request();
    } catch {
      toast.error(failureMessage);
    } finally {
      setDownloading(null);
    }
  }

  function handleBankExport() {
    download('bank', () => payrollApi.downloadBankTransferCsv(activeRunId, `bank-transfer-${run?.periodLabel?.replace(' ', '-') || activeRunId}.csv`), 'Could not export the bank transfer file');
  }

  function handlePayslip(i) {
    download(`item-${i.id}`, () => payrollApi.downloadPayslipPdf(i.id, `payslip-${i.employeeCode}-${i.periodYear}-${String(i.periodMonth).padStart(2, '0')}.pdf`), 'Could not download the payslip');
  }

  function handleExport() {
    exportToCsv(
      `payroll-${run?.periodLabel?.replace(' ', '-') || 'run'}.csv`,
      items.map((i) => ({
        'Employee ID': i.employeeCode,
        'Employee Name': i.employeeName,
        Department: i.departmentName || '',
        'Paid Days': i.paidDays ?? '',
        'LOP Days': i.lopDays ?? '',
        'Gross Salary': i.grossSalary,
        'Additional Earnings': i.adjustmentsTotal ?? 0,
        PF: i.components?.pf ?? 0,
        ESI: i.components?.esi ?? 0,
        'Professional Tax': i.components?.professionalTax ?? 0,
        TDS: i.components?.tds ?? 0,
        'Total Deductions': i.totalDeductions,
        'Net Salary': i.netSalary,
        'Employer PF (EPF+EPS)': Number(i.employerEpf || 0) + Number(i.employerEps || 0),
        'Employer ESI': i.employerEsi ?? 0,
        Status: i.status,
        'Payment Date': i.paymentDate || '',
      }))
    );
  }

  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Payroll Processing" description="Open, review and run payroll for a pay period" actions={<Button icon={PlusCircle} onClick={() => setShowNewRun(true)}>New Payroll Run</Button>} />

      <div className="row g-3">
        <div className="col-12 col-lg-3">
          <Card bodyClassName="p-0" title="Payroll Runs">
            {loadingRuns && (
              <div className="p-3">
                <SkeletonText lines={4} />
              </div>
            )}
            {!loadingRuns && runsError && (
              <div className="p-3">
                <ErrorState description="Couldn't load payroll runs." onRetry={refetchRuns} />
              </div>
            )}
            {!loadingRuns && !runsError && runs.length === 0 && (
              <div className="p-3">
                <EmptyState icon={Receipt} title="No payroll runs yet" description="Start your first run for the current period." />
              </div>
            )}
            {!loadingRuns && !runsError &&
              runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className="w-100 d-flex align-items-center justify-content-between p-3 border-0 text-start"
                  style={{
                    background: activeRunId === r.id ? 'var(--hz-primary-50)' : 'transparent',
                    borderBottom: '1px solid var(--hz-border)',
                    borderLeft: activeRunId === r.id ? '3px solid var(--hz-primary-600)' : '3px solid transparent',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>{r.periodLabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.totalEmployees} employees</div>
                  </div>
                  <PayrollStatusBadge status={r.status} />
                </button>
              ))}
          </Card>
        </div>

        <div className="col-12 col-lg-9">
          {!activeRunId && loadingRuns && (
            <Card>
              <SkeletonText lines={3} />
            </Card>
          )}
          {!activeRunId && !loadingRuns && (
            <div className="d-flex flex-column gap-3">
              <Card title="Run progress" subtitle="Next: Select month - open a run for the pay period">
                <PayrollStepper status={null} />
              </Card>
              <Card>
                <EmptyState
                  icon={PlayCircle}
                  title="No run selected"
                  description="Create a payroll run or select one from the list to get started. Every employee with an active salary structure is included automatically."
                  action={<Button icon={PlusCircle} onClick={() => setShowNewRun(true)}>New Payroll Run</Button>}
                />
              </Card>
            </div>
          )}

          {activeRunId && isError && <ErrorState description="Couldn't load this payroll run." onRetry={refetch} />}

          {activeRunId && !isError && (
            <div className="d-flex flex-column gap-3">
              <Card>
                {loadingDetail && !run && (
                  <div aria-label="Loading payroll run">
                    <Skeleton height={20} width="40%" />
                    <div className="mt-2"><SkeletonText lines={2} /></div>
                  </div>
                )}
                {run && <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <h3 style={{ fontSize: 'var(--hz-text-lg)', fontWeight: 700, margin: 0 }}>{run?.periodLabel}</h3>
                      {run && <PayrollStatusBadge status={run.status} />}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--hz-text-muted)', marginBottom: 0 }}>
                      {counts.PENDING} pending &middot; {counts.ON_HOLD} on hold &middot; {counts.PROCESSED} processed &middot; {counts.PAID} paid
                    </p>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" onClick={handleExport} disabled={items.length === 0}>
                      <Download size={16} /> Export
                    </button>
                    {canManage && (
                      <button
                        className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                        onClick={handleBankExport}
                        disabled={items.length === 0 || downloading === 'bank'}
                        title="Employee name, code, bank, account number, IFSC and net pay for every item not on hold"
                      >
                        <Landmark size={16} /> {downloading === 'bank' ? 'Exporting…' : 'Export bank transfer CSV'}
                      </button>
                    )}
                    {run?.status === 'DRAFT' && (
                      <Button variant="secondary" icon={XCircle} onClick={() => requestConfirmation('cancel')} loading={cancelMutation.isPending}>
                        Cancel Run
                      </Button>
                    )}
                  </div>
                </div>}

                {run && (
                  <div className="row g-3 mt-1">
                    <div className="col-6 col-md-4"><StatCard label="Total gross" value={formatCurrency(run.totalGross)} icon={Wallet} /></div>
                    <div className="col-6 col-md-4"><StatCard label="Total deductions" value={formatCurrency(run.totalDeductions)} icon={Wallet} accent="warning" /></div>
                    <div className="col-6 col-md-4"><StatCard label="Total net payout" value={formatCurrency(run.totalNet)} icon={Wallet} accent="success" /></div>
                  </div>
                )}
              </Card>

              {run && (
                <Card
                  title="Run progress"
                  subtitle={run.status === 'PAID' ? 'This run is complete' : `Next: ${nextStep.label} - ${nextStep.hint.toLowerCase()}`}
                >
                  <PayrollStepper status={run.status} />
                  <div className="d-flex flex-wrap align-items-center justify-content-between mt-3" style={{ gap: 'var(--hz-space-3)' }}>
                    <p className="mb-0" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)', flex: '1 1 260px' }}>
                      {run.status === 'DRAFT' && (processBlocked
                        ? (!preflight.hasEmployees
                          ? 'Processing is blocked: no employees are included in this run.'
                          : `Processing is blocked: release the ${preflight.onHold} employee${preflight.onHold === 1 ? '' : 's'} on hold first.`)
                        : `${preflight.pending} employee${preflight.pending === 1 ? '' : 's'} ready to process. Review the checklist and the table below, then process.`)}
                      {run.status === 'PROCESSED' && `Totals are locked. Pay employees, then record the payment for ${counts.PROCESSED} processed employee${counts.PROCESSED === 1 ? '' : 's'}.`}
                      {run.status === 'PAID' && `Payment recorded. Download each payslip from the employee table below${canManage ? ', or export the bank transfer and statutory files.' : '.'}`}
                      {run.status === 'CANCELLED' && 'This run was cancelled.'}
                    </p>
                    {run.status === 'DRAFT' && (
                      <Button icon={PlayCircle} onClick={() => requestConfirmation('process')} loading={processMutation.isPending} disabled={processBlocked}>
                        Process Payroll
                      </Button>
                    )}
                    {run.status === 'PROCESSED' && (
                      <Button icon={Wallet} onClick={() => requestConfirmation('paid')} loading={markPaidMutation.isPending}>
                        Mark as Paid
                      </Button>
                    )}
                    {run.status === 'PAID' && (
                      <a href="#payroll-run-employees" className="btn btn-primary d-inline-flex align-items-center gap-2">
                        <FileText size={16} aria-hidden="true" /> Go to payslips
                      </a>
                    )}
                  </div>
                </Card>
              )}

              {run?.status === 'DRAFT' && (
                <Card className="hz-payroll-preflight" title="Before you run" subtitle={`Checks for ${run.periodLabel}`}>
                  <PayrollChecklist checks={checks} />
                </Card>
              )}

              {canManage && run && items.length > 0 && <StatutoryExportsCard runId={activeRunId} run={run} />}

              <div id="payroll-run-employees" />
              <Card bodyClassName="p-0" title="Employees in this Run">
                {loadingDetail && (
                  <div className="p-3">
                    <SkeletonText lines={6} />
                  </div>
                )}
                {!loadingDetail && (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0" style={{ fontSize: 'var(--hz-text-sm)' }}>
                      <thead>
                        <tr>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            Employee
                          </th>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            Paid days
                          </th>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            LOP
                          </th>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            Gross
                          </th>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            Deductions
                          </th>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            Net
                          </th>
                          <th className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                            Status
                          </th>
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.id} style={{ borderBottom: '1px solid var(--hz-border)' }}>
                            <td className="px-3 py-3">
                              <div style={{ fontWeight: 600 }}>{i.employeeName}</div>
                              <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{i.employeeCode}</div>
                            </td>
                            <td className="px-3 py-3">{i.paidDays != null ? `${Number(i.paidDays)} / ${i.daysInPeriod}` : '—'}</td>
                            <td className="px-3 py-3" style={Number(i.lopDays) > 0 ? { color: 'var(--hz-danger-600)', fontWeight: 600 } : undefined}>
                              {Number(i.lopDays) > 0 ? Number(i.lopDays) : '—'}
                            </td>
                            <td className="px-3 py-3">{formatCurrency(i.grossSalary)}</td>
                            <td className="px-3 py-3">{formatCurrency(i.totalDeductions)}</td>
                            <td className="px-3 py-3" style={{ fontWeight: 600 }}>
                              {formatCurrency(i.netSalary)}
                            </td>
                            <td className="px-3 py-3">
                              <PayrollStatusBadge status={i.status} />
                            </td>
                            <td className="px-3 py-3 text-end">
                              <button
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 me-2"
                                onClick={() => handlePayslip(i)}
                                disabled={downloading === `item-${i.id}`}
                                title="Download payslip PDF"
                              >
                                <FileText size={13} /> PDF
                              </button>
                              {run?.status === 'DRAFT' && (i.status === 'PENDING' || i.status === 'ON_HOLD') && (
                                <button
                                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                  onClick={() => holdMutation.mutate({ itemId: i.id, onHold: i.status !== 'ON_HOLD' })}
                                  disabled={holdMutation.isPending}
                                >
                                  {i.status === 'ON_HOLD' ? (
                                    <>
                                      <Play size={13} /> Release
                                    </>
                                  ) : (
                                    <>
                                      <PauseCircle size={13} /> Hold
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {items.length === 0 && (
                      <div className="p-4">
                        <EmptyState title="No employees in this run" description="Every actively-paid employee is included automatically when a run is created." />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      {showNewRun && (
        <NewPayrollRunModal
          onClose={(createdRunId) => {
            setShowNewRun(false);
            if (createdRunId) {
              setSelectedRunId(createdRunId);
              invalidateAll();
            }
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          setConfirmAction(null);
          if (action === 'process') processMutation.mutate();
          if (action === 'paid') markPaidMutation.mutate();
          if (action === 'cancel') cancelMutation.mutate();
        }}
        title={confirmAction === 'process' ? `Process payroll for ${run?.periodLabel || 'this run'}?` : confirmAction === 'paid' ? `Mark ${run?.periodLabel || 'this'} payroll as paid?` : 'Cancel this payroll run?'}
        description={confirmAction === 'process'
          ? `${counts.PENDING} employee${counts.PENDING === 1 ? '' : 's'} will be finalised and totals locked in. After processing, the run can no longer be edited, held or cancelled.`
          : confirmAction === 'paid'
            ? `This records today as the payment date for ${counts.PROCESSED} processed employee${counts.PROCESSED === 1 ? '' : 's'} (${formatCurrency(run?.totalNet)} net) and notifies them.`
            : 'This will cancel the draft run and remove it from active payroll work.'}
        confirmLabel={confirmAction === 'process' ? 'Process payroll' : confirmAction === 'paid' ? 'Mark as paid' : 'Cancel run'}
        variant={confirmAction === 'cancel' ? 'danger' : 'primary'}
        loading={processMutation.isPending || markPaidMutation.isPending || cancelMutation.isPending}
      />
    </div>
  );
}

