import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Search } from 'lucide-react';
import { currentFinancialYear, financialYearLabel, taxDeclarationApi } from '../../api/endpoints/salary';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Dialog from '../../components/ui/Dialog';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../utils/formatCurrency';
import { exportToCsv } from '../../utils/exportToCsv';
import TaxDeclarationForm from './components/TaxDeclarationForm';

/** HR view of every employee's regime choice and investment declaration for a financial year. */
export default function TaxDeclarations() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('SALARY_MANAGE');
  const toast = useToast();
  const thisFy = currentFinancialYear();
  const [fy, setFy] = useState(thisFy);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tax-declarations', fy],
    queryFn: () => taxDeclarationApi.list(fy),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => `${r.employeeName} ${r.employeeCode} ${r.panNumber || ''}`.toLowerCase().includes(term));
  }, [rows, search]);

  const submitted = rows.filter((r) => r.submitted).length;
  const oldRegime = rows.filter((r) => r.submitted && r.regime === 'OLD').length;

  async function downloadForm16(row) {
    setDownloading(row.employeeId);
    try {
      await taxDeclarationApi.downloadForm16(row.employeeId, fy);
    } catch (err) {
      toast.error(err.response?.status === 400 ? `No processed payroll for ${row.employeeName} in ${financialYearLabel(fy)}` : 'Could not download Form 16');
    } finally {
      setDownloading(null);
    }
  }

  function handleExport() {
    exportToCsv(`tax-declarations-${fy}-${String((fy + 1) % 100).padStart(2, '0')}.csv`, rows.map((r) => ({
      'Employee Code': r.employeeCode,
      'Employee Name': r.employeeName,
      PAN: r.panNumber || '',
      Submitted: r.submitted ? 'Yes' : 'No',
      Regime: r.regime,
      '80C': r.section80C,
      '80D': r.section80D,
      'Rent Paid': r.rentPaid,
      Metro: r.metroCity ? 'Yes' : 'No',
      'Home Loan Interest': r.homeLoanInterest,
      'NPS 80CCD(1B)': r.nps80ccd1b,
      'Other Deductions': r.otherDeductions,
      'Other Note': r.otherDeductionsNote || '',
    })));
  }

  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Payroll"
        title="Tax Declarations"
        description={`${submitted} of ${rows.length} employees have declared for ${financialYearLabel(fy)} · ${oldRegime} chose the old regime`}
        actions={(
          <div className="d-flex align-items-center gap-2">
            <select className="form-select" style={{ width: 'auto' }} value={fy} onChange={(e) => setFy(Number(e.target.value))} aria-label="Financial year">
              {[thisFy + 1, thisFy, thisFy - 1, thisFy - 2].map((year) => (
                <option key={year} value={year}>{financialYearLabel(year)}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" onClick={handleExport} disabled={rows.length === 0}>
              <Download size={16} /> Export
            </button>
          </div>
        )}
      />

      {isError && <ErrorState description="Couldn't load tax declarations." onRetry={refetch} />}

      {!isError && (
        <Card bodyClassName="p-0">
          <div className="p-3 border-bottom d-flex align-items-center gap-2">
            <Search size={16} style={{ color: 'var(--hz-text-muted)' }} />
            <input className="form-control form-control-sm" style={{ maxWidth: 320 }} placeholder="Search name, code or PAN" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isLoading && <div className="p-3"><SkeletonText lines={6} /></div>}
          {!isLoading && filtered.length === 0 && <div className="p-4"><EmptyState title="No employees" description="Nobody matches this search." /></div>}
          {!isLoading && filtered.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ fontSize: 'var(--hz-text-sm)' }}>
                <thead>
                  <tr>
                    {['Employee', 'PAN', 'Regime', '80C', 'Rent paid', 'Other deductions', ''].map((h) => (
                      <th key={h} className="px-3 py-3 text-secondary-hz" style={{ fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.employeeId}>
                      <td className="px-3 py-2">
                        <div style={{ fontWeight: 600 }}>{r.employeeName}</div>
                        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.employeeCode}</div>
                      </td>
                      <td className="px-3 py-2">{r.panNumber || <span style={{ color: 'var(--hz-danger-600)' }}>Missing</span>}</td>
                      <td className="px-3 py-2">
                        {r.submitted ? (r.regime === 'OLD' ? 'Old' : 'New') : <span style={{ color: 'var(--hz-text-muted)' }}>Not declared (New)</span>}
                      </td>
                      <td className="px-3 py-2">{r.submitted ? formatCurrency(r.section80C) : '—'}</td>
                      <td className="px-3 py-2">{r.submitted ? formatCurrency(r.rentPaid) : '—'}</td>
                      <td className="px-3 py-2">
                        {r.submitted ? formatCurrency(Number(r.section80D || 0) + Number(r.homeLoanInterest || 0) + Number(r.nps80ccd1b || 0) + Number(r.otherDeductions || 0)) : '—'}
                      </td>
                      <td className="px-3 py-2 text-end text-nowrap">
                        <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setSelected(r)}>
                          {canManage ? 'View / edit' : 'View'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                          onClick={() => downloadForm16(r)}
                          disabled={downloading === r.employeeId}
                          title="Form 16 Part B for this financial year"
                        >
                          <FileText size={13} /> Form 16
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selected && (
        <Dialog
          open
          onClose={() => setSelected(null)}
          title={`Tax declaration · ${financialYearLabel(fy)}`}
          description={`${selected.employeeName} · ${selected.employeeCode}`}
          size="xl"
        >
          <TaxDeclarationForm employeeId={selected.employeeId} fy={fy} canEdit={canManage} />
        </Dialog>
      )}
    </div>
  );
}
