import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileDown, Settings } from 'lucide-react';
import { statutoryReturnsApi } from '../../../api/endpoints/salary';
import Card from '../../../components/ui/Card';
import { SkeletonText } from '../../../components/ui/Skeleton';
import { useToast } from '../../../components/ui/Toast';
import { formatCurrency } from '../../../utils/formatCurrency';

const FILES = [
  { kind: 'pf-ecr.txt', label: 'PF ECR (EPFO)', prefix: 'pf-ecr', ext: 'txt', hint: 'ECR 2.0 text file for the EPFO unified portal' },
  { kind: 'esi.csv', label: 'ESI contribution', prefix: 'esi-contribution', ext: 'csv', hint: 'IP number, days paid, wages and contributions' },
  { kind: 'pt.csv', label: 'Professional tax', prefix: 'professional-tax', ext: 'csv', hint: 'Summary by state and slab, with employee detail' },
  { kind: 'tds.csv', label: 'TDS summary', prefix: 'tds-summary', ext: 'csv', hint: 'Employee, PAN, gross and TDS for Form 24Q' },
];

/** PF/ESI/PT/TDS totals, data warnings and return-file downloads for one payroll run (SALARY_MANAGE). */
export default function StatutoryExportsCard({ runId, run }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(null);
  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['payroll-run-statutory', runId, run?.status],
    queryFn: () => statutoryReturnsApi.summary(runId),
    enabled: !!runId,
  });

  async function download(file) {
    setDownloading(file.kind);
    try {
      const period = run ? `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}` : runId;
      await statutoryReturnsApi.download(runId, file.kind, `${file.prefix}-${period}.${file.ext}`);
    } catch {
      toast.error(`Could not download the ${file.label} file`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card
      title="Statutory returns"
      subtitle={run?.status === 'DRAFT' ? 'Preview - file returns from a processed run' : 'Files for PF, ESI, PT and TDS filing'}
      actions={(
        <Link to="/salary/settings" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
          <Settings size={14} /> Payroll settings
        </Link>
      )}
    >
      {isLoading && <SkeletonText lines={3} />}
      {isError && <p className="mb-0" style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>Couldn&apos;t load the statutory summary.</p>}
      {summary && (
        <>
          <div className="row g-3 mb-3" style={{ fontSize: 13 }}>
            <Figure label={`PF (${summary.pfMembers} members)`} value={summary.pfEmployee} sub={`Employer EPF ${formatCurrency(summary.pfEmployerEpf)} · EPS ${formatCurrency(summary.pfEmployerEps)}`} />
            <Figure label={`ESI (${summary.esiMembers} IPs)`} value={summary.esiEmployee} sub={`Employer ${formatCurrency(summary.esiEmployer)}`} />
            <Figure label="Professional tax" value={summary.professionalTax} />
            <Figure label="TDS (s.192)" value={summary.tds} />
          </div>
          <div className="d-flex flex-wrap gap-2">
            {FILES.map((file) => (
              <button
                key={file.kind}
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                onClick={() => download(file)}
                disabled={downloading === file.kind}
                title={file.hint}
              >
                <FileDown size={14} /> {downloading === file.kind ? 'Downloading…' : file.label}
              </button>
            ))}
          </div>
          {summary.warnings?.length > 0 && (
            <div className="mt-3 p-3" style={{ background: 'var(--hz-warning-50, #fff8e6)', border: '1px solid var(--hz-border)', borderRadius: 'var(--hz-radius-lg)' }}>
              <div className="d-flex align-items-center gap-2 mb-2" style={{ fontWeight: 600, fontSize: 13 }}>
                <AlertTriangle size={15} /> {summary.warnings.length} data issue{summary.warnings.length === 1 ? '' : 's'}
              </div>
              <ul className="mb-0 ps-3" style={{ fontSize: 12 }}>
                {summary.warnings.map((w, index) => (
                  <li key={`${w.employeeId}-${index}`}>
                    <strong>{w.employeeName}</strong> ({w.employeeCode}): {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div className="col-6 col-md-3">
      <div style={{ fontSize: 11, color: 'var(--hz-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 'var(--hz-text-lg)', fontWeight: 700 }}>{formatCurrency(value)}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{sub}</div>}
    </div>
  );
}
