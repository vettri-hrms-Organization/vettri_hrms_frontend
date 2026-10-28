import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, History, Receipt } from 'lucide-react';
import { currentFinancialYear, employeeSalaryApi, financialYearLabel, payrollApi, taxDeclarationApi } from '../../api/endpoints/salary';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { formatCurrency } from '../../utils/formatCurrency';
import PayrollStatusBadge from './components/PayrollStatusBadge';
import AssignSalaryStructureModal from './components/AssignSalaryStructureModal';
import { useBreadcrumbLabel } from '../../components/layout/BreadcrumbContext';

/**
 * Serves two routes with one component:
 *  - /salary/employees/:employeeId - HR/Admin looking up any employee (SALARY_VIEW)
 *  - /my-payslip - an employee viewing their own (no employeeId in the URL,
 *    resolved from the logged-in user instead - see EmployeeSalaryController#
 *    getDetail's isSelf bypass on the backend for the matching permission check)
 * Management actions (Revise/Define Structure) and the HR-only back link
 * are hidden unless the viewer actually has SALARY_MANAGE/SALARY_VIEW -
 * without that, a self-viewing employee would see a button that 403s.
 */
export default function SalaryDetails() {
  const { employeeId: routeEmployeeId } = useParams();
  const { user, hasPermission, hasRole } = useAuth();
  const employeeId = routeEmployeeId || user?.employeeId;
  const canManage = hasPermission('SALARY_MANAGE');
  const canViewList = hasPermission('SALARY_VIEW');
  const isEmployee = !!user?.employeeId;
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const thisFy = currentFinancialYear();
  const [form16Fy, setForm16Fy] = useState(thisFy - 1);
  const [downloadingForm16, setDownloadingForm16] = useState(false);
  const toast = useToast();

  async function downloadForm16() {
    setDownloadingForm16(true);
    try {
      await taxDeclarationApi.downloadForm16(employeeId, form16Fy);
    } catch (err) {
      toast.error(err.response?.status === 400
        ? `No processed payroll in ${financialYearLabel(form16Fy)} to build a Form 16 from.`
        : 'Could not download Form 16');
    } finally {
      setDownloadingForm16(false);
    }
  }

  // Employees get their own payslip once the run is processed; SALARY_VIEW holders can pull any line.
  const canDownload = (p) => canViewList || p.status === 'PROCESSED' || p.status === 'PAID';

  async function downloadPayslip(p) {
    setDownloadingId(p.id);
    try {
      await payrollApi.downloadPayslipPdf(p.id, `payslip-${data.employeeCode}-${p.periodYear}-${String(p.periodMonth).padStart(2, '0')}.pdf`);
    } catch (err) {
      toast.error(err.response?.status === 403 ? 'This payslip is not available yet.' : 'Could not download the payslip');
    } finally {
      setDownloadingId(null);
    }
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['salary-employee-detail', employeeId],
    queryFn: () => employeeSalaryApi.getDetail(employeeId),
    enabled: !!employeeId,
  });

  useBreadcrumbLabel(data?.employeeName);

  if (!employeeId) {
    return (
      <Card>
        <EmptyState
          icon={Receipt}
          title="No linked employee record"
          description="This login isn't linked to an employee profile, so there's no payslip to show."
        />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <SkeletonText lines={8} />
      </Card>
    );
  }

  if (isError || !data) {
    return <ErrorState description="Couldn't load this employee's salary details." onRetry={refetch} />;
  }

  const structure = data.currentStructure;

  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      {canViewList ? (
        <Link to="/salary/employees" className="d-inline-flex align-items-center gap-1 text-decoration-none" style={{ fontSize: 13, color: 'var(--hz-text-secondary)', width: 'fit-content' }}>
          <ArrowLeft size={14} /> Back to Employee Salary List
        </Link>
      ) : (
        <Link to="/dashboard" className="d-inline-flex align-items-center gap-1 text-decoration-none" style={{ fontSize: 13, color: 'var(--hz-text-secondary)', width: 'fit-content' }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      )}

      <div className={`hz-greeting ${isEmployee ? 'hz-employee-pay-header' : ''}`}>
        <div className="position-relative d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <Avatar name={data.employeeName} src={data.profilePhotoUrl} size="xl" />
            <div>
              <h1 style={{ fontSize: 'var(--hz-text-2xl)', fontWeight: 700, marginBottom: 4, color: '#fff' }}>{isEmployee ? 'My pay' : data.employeeName}</h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0, fontSize: 'var(--hz-text-sm)' }}>
                {isEmployee ? 'Salary details and payslips, securely in one place.' : `${data.employeeCode} · ${data.designationTitle || '—'} · ${data.departmentName || '—'}`}
              </p>
            </div>
          </div>
          {canManage && (
            <button className="btn btn-light" onClick={() => setModalOpen(true)}>
              {structure ? 'Revise Structure' : 'Define Structure'}
            </button>
          )}
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <Card title={isEmployee ? 'Salary details' : 'Current Compensation'} subtitle={structure ? `Effective from ${new Date(structure.effectiveFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}>
            {!structure && <EmptyState icon={FileSpreadsheet} title="No payslip available yet" description={isEmployee ? 'Your salary information will appear here once payroll has been configured.' : 'Define a structure to include this employee in payroll.'} />}
            {structure && (
              <div className="d-flex flex-column gap-3">
                <div
                  className="d-flex flex-wrap gap-4 p-3"
                  style={{ background: 'var(--hz-gradient-surface)', border: '1px solid var(--hz-border)', borderRadius: 'var(--hz-radius-lg)' }}
                >
                  <SummaryTile label="Gross Salary" value={structure.grossSalary} />
                  <SummaryTile label="Total Deductions" value={structure.totalDeductions} tone="danger" />
                  <SummaryTile label="Net Salary" value={structure.netSalary} tone="primary" />
                </div>
                {structure.autoStatutory && (
                  <p className="mb-0" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                    PF, ESI, professional tax and TDS are calculated each month at payroll, so net pay on your payslip may differ from the figure above.
                  </p>
                )}
                <div className="row g-3">
                  {Object.entries(structure.components).map(([key, value]) => (
                    <div className="col-6 col-md-4" key={key}>
                      <p style={{ fontSize: 11, color: 'var(--hz-text-muted)', marginBottom: 2 }}>{splitLabel(key)}</p>
                      <p style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, marginBottom: 0 }}>{formatCurrency(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-12 col-lg-5">
          <Card title={isEmployee ? 'Compensation history' : 'Structure History'} subtitle="Most recent first">
            {(!data.structureHistory || data.structureHistory.length === 0) && <EmptyState icon={History} title="No history yet" />}
            {data.structureHistory?.length > 0 && (
              <div className="d-flex flex-column gap-2">
                {data.structureHistory.map((h) => (
                  <div key={h.id} className="d-flex align-items-center justify-content-between p-2" style={{ borderBottom: '1px solid var(--hz-border)' }}>
                    <div>
                      <span style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>{new Date(h.effectiveFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {h.active && (
                        <span className="ms-2 badge text-bg-light" style={{ fontSize: 10 }}>
                          Current
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{formatCurrency(h.netSalary)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title={isEmployee ? 'Payslip history' : 'Payroll History'} subtitle={isEmployee ? 'Your processed payslips' : 'Every payroll run this employee has appeared in'}>
        {(!data.payrollHistory || data.payrollHistory.length === 0) && (
          <EmptyState icon={Receipt} title="No payroll history yet" description="This employee hasn't appeared in a processed payroll run yet." />
        )}
        {data.payrollHistory?.length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0 hz-table" style={{ fontSize: 'var(--hz-text-sm)' }}>
              <thead>
                <tr>
                  <th className="text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                    Period
                  </th>
                  <th className="text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                    Paid days
                  </th>
                  <th className="text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                    LOP
                  </th>
                  <th className="text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                    Net Salary
                  </th>
                  <th className="text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                    Status
                  </th>
                  <th className="text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                    Payment Date
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.payrollHistory.map((p) => (
                  <Fragment key={p.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-1"
                        style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        aria-expanded={expandedId === p.id}
                        title="Show earnings, deductions and employer contributions"
                      >
                        {expandedId === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {p.periodLabel || '—'}
                      </button>
                    </td>
                    <td>{p.paidDays != null ? `${Number(p.paidDays)} / ${p.daysInPeriod}` : '—'}</td>
                    <td>{Number(p.lopDays) > 0 ? Number(p.lopDays) : '—'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.netSalary)}</td>
                    <td>
                      <PayrollStatusBadge status={p.status} />
                    </td>
                    <td>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="text-end">
                      {canDownload(p) && (
                        <button
                          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                          onClick={() => downloadPayslip(p)}
                          disabled={downloadingId === p.id}
                        >
                          <Download size={13} /> {downloadingId === p.id ? 'Downloading…' : 'Download PDF'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--hz-gray-50)' }}>
                        <PayslipBreakdown item={p} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Form 16 (Part B)"
        subtitle="Annual salary and TDS statement computed from processed payroll. Part A is issued by your employer from TRACES."
        actions={isEmployee && !routeEmployeeId ? (
          <Link to="/my-tax-declaration" className="btn btn-sm btn-outline-secondary">Tax declaration</Link>
        ) : undefined}
      >
        <div className="d-flex flex-wrap align-items-center gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={form16Fy}
            onChange={(e) => setForm16Fy(Number(e.target.value))}
            aria-label="Financial year"
          >
            {[thisFy, thisFy - 1, thisFy - 2].map((fy) => (
              <option key={fy} value={fy}>{financialYearLabel(fy)}{fy === thisFy ? ' (so far)' : ''}</option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={downloadForm16} disabled={downloadingForm16}>
            <FileText size={13} /> {downloadingForm16 ? 'Preparing…' : 'Download Form 16 Part B'}
          </button>
        </div>
      </Card>

      {modalOpen && (
        <AssignSalaryStructureModal
          employee={{ employeeId: data.employeeId, employeeName: data.employeeName, employeeCode: data.employeeCode }}
          onClose={(saved) => {
            setModalOpen(false);
            if (saved) refetch();
          }}
        />
      )}
    </div>
  );
}

const EARNING_LINES = [
  ['basicSalary', 'Basic salary'], ['hra', 'HRA'], ['specialAllowance', 'Special allowance'], ['medicalAllowance', 'Medical allowance'],
  ['travelAllowance', 'Travel allowance'], ['bonus', 'Bonus'], ['incentives', 'Incentives'], ['overtime', 'Overtime'],
];
const DEDUCTION_LINES = [
  ['pf', 'Provident fund (PF)'], ['esi', 'ESI'], ['professionalTax', 'Professional tax'], ['tds', 'Income tax (TDS)'], ['otherDeductions', 'Other deductions'],
];

/** One payslip's earnings (incl. additional earnings), deductions and employer contributions. */
function PayslipBreakdown({ item }) {
  const c = item.components || {};
  const earnings = [
    ...EARNING_LINES.filter(([key]) => Number(c[key]) > 0).map(([key, label]) => [label, c[key]]),
    ...(item.adjustments || []).map((a) => [`${a.label}${a.taxable ? '' : ' (non-taxable)'}`, a.amount]),
  ];
  const deductions = DEDUCTION_LINES.filter(([key]) => Number(c[key]) > 0).map(([key, label]) => [label, c[key]]);
  const employer = [
    ['Employer EPF', item.employerEpf],
    ['Employer EPS (pension)', item.employerEps],
    ['Employer ESI', item.employerEsi],
  ].filter(([, value]) => Number(value) > 0);
  return (
    <div className="row g-3 py-2" style={{ fontSize: 13 }}>
      <BreakdownColumn title="Earnings" rows={earnings} total={['Gross earnings', item.grossSalary]} />
      <BreakdownColumn title="Deductions" rows={deductions} total={['Total deductions', item.totalDeductions]} />
      <BreakdownColumn
        title="Employer contributions"
        note="Paid by the company on top of your salary - not deducted."
        rows={employer}
        total={employer.length ? ['Total', item.employerContributions] : null}
        empty="None this month"
      />
    </div>
  );
}

function BreakdownColumn({ title, rows, total, note, empty = '—' }) {
  return (
    <div className="col-12 col-md-4">
      <p className="text-uppercase mb-1" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--hz-text-muted)', fontWeight: 600 }}>{title}</p>
      {note && <p className="mb-1" style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{note}</p>}
      {rows.length === 0 && <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>{empty}</p>}
      {rows.map(([label, value]) => (
        <div key={label} className="d-flex justify-content-between">
          <span>{label}</span>
          <span>{formatCurrency(value)}</span>
        </div>
      ))}
      {total && (
        <div className="d-flex justify-content-between mt-1 pt-1" style={{ borderTop: '1px solid var(--hz-border)', fontWeight: 600 }}>
          <span>{total[0]}</span>
          <span>{formatCurrency(total[1])}</span>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  const color = tone === 'primary' ? 'var(--hz-primary-700)' : tone === 'danger' ? 'var(--hz-danger-600)' : 'var(--hz-text-primary)';
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--hz-text-muted)', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ fontSize: 'var(--hz-text-lg)', fontWeight: 700, margin: 0, color }}>{formatCurrency(value)}</p>
    </div>
  );
}

// "SPECIAL_ALLOWANCE" -> "Special allowance", "specialAllowance" -> "Special allowance",
// payroll codes such as HRA, PF and TDS stay upper case.
const PAYROLL_ACRONYMS = new Set(['HRA', 'PF', 'EPF', 'TDS', 'ESI', 'ESIC', 'LTA', 'DA', 'PT', 'NPS', 'CTC', 'VPF']);

function splitLabel(key) {
  const words = String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean);
  return words
    .map((word, index) => {
      if (PAYROLL_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      const lower = word.toLowerCase();
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}
