import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, FileText, Receipt } from 'lucide-react';
import { currentFinancialYear, employeeSalaryApi, financialYearLabel, payrollApi, taxDeclarationApi } from '../../api/endpoints/salary';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { Skeleton, SkeletonText } from '../../components/ui/Skeleton';
import { formatCurrency } from '../../utils/formatCurrency';
import PayrollStatusBadge from './components/PayrollStatusBadge';
import AssignSalaryStructureModal from './components/AssignSalaryStructureModal';
import { useBreadcrumbLabel } from '../../components/layout/BreadcrumbContext';
import { PayslipPicker, PayslipSummary, YearToDate, isPublished, longDate, sortByPeriod } from './PayslipParts';
import './payslips.css';

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
  // Self view (/my-payslip). An HR user who is also an employee gets the HR copy on /salary/employees/:id.
  const isSelf = isEmployee && !routeEmployeeId;
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
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
      <section className="hz-payslip__panel">
        <EmptyState
          icon={Receipt}
          title="No linked employee record"
          description="This login isn't linked to an employee profile, so there's no payslip to show."
        />
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="hz-payslip" aria-busy="true" aria-label="Loading payslips">
        <Skeleton height={56} width="40%" />
        <div className="hz-payslip__grid">
          <div className="hz-payslip__panel d-flex flex-column gap-3">
            <Skeleton height={32} width="55%" />
            <Skeleton height={40} width="35%" />
            <SkeletonText lines={6} />
          </div>
          <div className="hz-payslip__panel"><SkeletonText lines={5} /></div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState description={isSelf ? "Couldn't load your payslips." : "Couldn't load this employee's salary details."} onRetry={refetch} />;
  }

  const structure = data.currentStructure;
  // Newest period first. Employees pick between published payslips; SALARY_VIEW holders can inspect every line.
  const history = sortByPeriod(data.payrollHistory || []);
  const pickable = canViewList ? history : history.filter(isPublished);
  const selected = history.find((p) => p.id === selectedId) || pickable[0] || null;

  function showPayslip(id) {
    setSelectedId(id);
    document.getElementById('hz-payslip-summary')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="hz-payslip">
      {canViewList ? (
        <Link to="/salary/employees" className="hz-payslip__back">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Employee Salary List
        </Link>
      ) : (
        <Link to="/dashboard" className="hz-payslip__back">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Dashboard
        </Link>
      )}

      <header className="hz-payslip__header">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <Avatar name={data.employeeName} src={data.profilePhotoUrl} size="lg" />
          <div className="min-w-0">
            {isSelf && <p className="hz-payslip__eyebrow">My finances</p>}
            <h1 className="hz-payslip__title">{isSelf ? 'My Payslips' : data.employeeName}</h1>
            <p className="hz-payslip__subtitle">
              {isSelf ? 'Your monthly pay, deductions and tax documents in one place.' : `${data.employeeCode} · ${data.designationTitle || '—'} · ${data.departmentName || '—'}`}
            </p>
          </div>
        </div>
        {canManage && (
          <button type="button" className="btn btn-outline-primary" onClick={() => setModalOpen(true)}>
            {structure ? 'Revise Structure' : 'Define Structure'}
          </button>
        )}
      </header>

      {!selected ? (
        <section className="hz-payslip__panel">
          <EmptyState
            icon={Receipt}
            title="No payslip published yet"
            description={isSelf
              ? 'Your payslip will appear here as soon as your first payroll is processed.'
              : "This employee hasn't appeared in a processed payroll run yet."}
          />
        </section>
      ) : (
        <div className="hz-payslip__grid">
          <section className="hz-payslip__panel" id="hz-payslip-summary" aria-label="Selected payslip">
            {pickable.length > 0 && <PayslipPicker items={pickable} selectedId={selected.id} onSelect={setSelectedId} />}
            <PayslipSummary
              item={selected}
              canDownload={canDownload(selected)}
              downloading={downloadingId === selected.id}
              onDownload={() => downloadPayslip(selected)}
            />
          </section>
          <div className="hz-payslip__side">
            <YearToDate items={history} selected={selected} />
            <StructurePanel structure={structure} isSelf={isSelf} />
          </div>
        </div>
      )}

      {!selected && structure && <StructurePanel structure={structure} isSelf={isSelf} />}
      {!selected && !structure && !isSelf && (
        <section className="hz-payslip__panel">
          <EmptyState icon={FileSpreadsheet} title="No salary structure" description="Define a structure to include this employee in payroll." />
        </section>
      )}

      {history.length > 0 && (
        <section className="hz-payslip__panel hz-payslip__panel--flush" aria-labelledby="hz-payslip-history">
          <div className="hz-payslip__panel-head">
            <h2 className="hz-payslip__heading mb-0" id="hz-payslip-history">{isSelf ? 'All payslips' : 'Payroll history'}</h2>
            <span className="hz-payslip__muted">{isSelf ? 'Every payroll you have been part of' : 'Every payroll run this employee has appeared in'}</span>
          </div>
          <div className="hz-payslip__table-wrap">
            <table className="hz-payslip__table">
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Paid days</th>
                  <th scope="col">LOP</th>
                  <th scope="col" className="text-end">Net pay</th>
                  <th scope="col">Status</th>
                  <th scope="col">Payment date</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className={p.id === selected?.id ? 'is-selected' : ''}>
                    <td>
                      <button
                        type="button"
                        className="hz-payslip__link"
                        onClick={() => showPayslip(p.id)}
                        aria-current={p.id === selected?.id ? 'true' : undefined}
                        title="Show earnings, deductions and employer contributions"
                      >
                        {p.periodLabel || '—'}
                      </button>
                    </td>
                    <td className="is-num">{p.paidDays != null ? `${Number(p.paidDays)} / ${p.daysInPeriod}` : '—'}</td>
                    <td className="is-num">{Number(p.lopDays) > 0 ? Number(p.lopDays) : '—'}</td>
                    <td className="is-num text-end"><strong>{formatCurrency(p.netSalary)}</strong></td>
                    <td><PayrollStatusBadge status={p.status} /></td>
                    <td className="text-nowrap">{longDate(p.paymentDate)}</td>
                    <td className="text-end">
                      {canDownload(p) && (
                        <button
                          type="button"
                          className="hz-payslip__link"
                          onClick={() => downloadPayslip(p)}
                          disabled={downloadingId === p.id}
                          aria-label={`Download ${p.periodLabel} payslip PDF`}
                        >
                          <Download size={14} aria-hidden="true" /> {downloadingId === p.id ? 'Downloading…' : 'PDF'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="hz-payslip__pair">
        <section className="hz-payslip__panel" aria-labelledby="hz-payslip-comp">
          <h2 className="hz-payslip__heading" id="hz-payslip-comp">{isSelf ? 'Compensation history' : 'Structure history'}</h2>
          {(!data.structureHistory || data.structureHistory.length === 0) && <p className="hz-payslip__muted">No history yet.</p>}
          {data.structureHistory?.length > 0 && (
            <ul className="hz-payslip__rows">
              {data.structureHistory.map((h) => (
                <li key={h.id}>
                  <span>
                    Effective {longDate(h.effectiveFrom)}
                    {h.active && <span className="hz-payslip__chip">Current</span>}
                  </span>
                  <strong>{formatCurrency(h.netSalary)}<small> net / month</small></strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hz-payslip__panel" aria-labelledby="hz-payslip-form16">
          <div className="hz-payslip__panel-head hz-payslip__panel-head--plain">
            <h2 className="hz-payslip__heading mb-0" id="hz-payslip-form16">Form 16 (Part B)</h2>
            {isSelf && <Link to="/my-tax-declaration" className="hz-payslip__link">Tax declaration</Link>}
          </div>
          <p className="hz-payslip__muted mb-3">Annual salary and TDS statement computed from processed payroll. Part A is issued by your employer from TRACES.</p>
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
              <FileText size={13} aria-hidden="true" /> {downloadingForm16 ? 'Preparing…' : 'Download Form 16 Part B'}
            </button>
          </div>
        </section>
      </div>

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

/** Current salary structure (monthly), with each configured component. */
function StructurePanel({ structure, isSelf }) {
  return (
    <section className="hz-payslip__panel" aria-labelledby="hz-payslip-structure">
      <h2 className="hz-payslip__heading mb-1" id="hz-payslip-structure">{isSelf ? 'Salary structure' : 'Current compensation'}</h2>
      {!structure ? (
        <p className="hz-payslip__muted">{isSelf ? 'Your salary information will appear here once payroll has been configured.' : 'Define a structure to include this employee in payroll.'}</p>
      ) : (
        <>
          <p className="hz-payslip__muted">Monthly · effective from {longDate(structure.effectiveFrom)}</p>
          <dl className="hz-payslip__ytd">
            <div><dt>Gross salary</dt><dd>{formatCurrency(structure.grossSalary)}</dd></div>
            <div><dt>Deductions</dt><dd className="is-deduction">{formatCurrency(structure.totalDeductions)}</dd></div>
            <div><dt>Net salary</dt><dd className="is-net">{formatCurrency(structure.netSalary)}</dd></div>
          </dl>
          <ul className="hz-payslip__rows hz-payslip__rows--compact">
            {Object.entries(structure.components || {}).map(([key, value]) => (
              <li key={key}><span>{splitLabel(key)}</span><span>{formatCurrency(value)}</span></li>
            ))}
          </ul>
          {structure.autoStatutory && (
            <p className="hz-payslip__note mt-2 mb-0">
              PF, ESI, professional tax and TDS are calculated each month at payroll, so net pay on your payslip may differ from the figure above.
            </p>
          )}
        </>
      )}
    </section>
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
