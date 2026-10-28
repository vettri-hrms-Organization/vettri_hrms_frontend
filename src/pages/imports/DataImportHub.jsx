import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, CalendarDays, FileSpreadsheet, History, Landmark, ReceiptIndianRupee, Users, Wallet } from 'lucide-react';
import { importsApi } from '../../api/endpoints/imports';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';
import Skeleton from '../../components/ui/Skeleton';
import { formatDateTimeIST } from '../../utils/formatDateTime';
import ImportWizard from './ImportWizard';

const META = {
  'salary-structures': { icon: Wallet },
  'leave-balances': { icon: CalendarDays, supportsReplace: true, supportsLeaveMode: true },
  holidays: { icon: Landmark },
  'opening-ytd': { icon: ReceiptIndianRupee, supportsReplace: true },
  'bank-details': { icon: Banknote },
};

const STATUS_VARIANT = { COMPLETED: 'success', PARTIAL: 'warning', FAILED: 'danger' };

export default function DataImportHub() {
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = params.get('type');
  const [expandedBatch, setExpandedBatch] = useState(null);

  // The import API needs one of these (organization scope); EMPLOYEE_IMPORT-only users just get the employee card.
  const canUseHub = ['SALARY_MANAGE', 'LEAVE_MANAGE', 'EMPLOYEE_MANAGE'].some((code) => hasPermission(code));
  const typesQuery = useQuery({ queryKey: ['import-types'], queryFn: importsApi.types, enabled: canUseHub });
  const batchesQuery = useQuery({ queryKey: ['import-batches'], queryFn: () => importsApi.batches(undefined, 50), enabled: canUseHub });
  const batchDetail = useQuery({
    queryKey: ['import-batch', expandedBatch],
    queryFn: () => importsApi.batch(expandedBatch),
    enabled: !!expandedBatch,
  });

  const types = typesQuery.data || [];
  const current = types.find((t) => t.type === selected);
  const canImportEmployees = hasPermission('EMPLOYEE_IMPORT');

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Settings"
        title="Data import"
        description="Move your existing HR and payroll data into Vettri from Excel. Every file is validated row by row before anything is saved."
        actions={current ? (
          <Button variant="secondary" icon={ArrowLeft} onClick={() => setParams({})}>All imports</Button>
        ) : null}
      />

      {typesQuery.isError && <ErrorBanner>We could not load the available imports.</ErrorBanner>}

      {current ? (
        <ImportWizard
          key={current.type}
          type={current.type}
          title={current.title}
          description={current.description}
          supportsReplace={!!META[current.type]?.supportsReplace}
          supportsLeaveMode={!!META[current.type]?.supportsLeaveMode}
        />
      ) : (
        <div className="row g-3">
          {typesQuery.isLoading && [1, 2, 3].map((n) => <div key={n} className="col-12 col-md-6 col-xl-4"><Skeleton height={150} /></div>)}
          {canImportEmployees && (
            <ImportCard
              icon={Users}
              title="Employees"
              description="Create employee records in bulk with codes, departments, managers and joining dates."
              action={<Link to="/employees/import" className="btn btn-primary btn-sm">Open employee import</Link>}
            />
          )}
          {types.map((type) => {
            const Icon = META[type.type]?.icon || FileSpreadsheet;
            return (
              <ImportCard
                key={type.type}
                icon={Icon}
                title={type.title}
                description={type.description}
                columns={type.columns}
                action={<Button size="sm" onClick={() => setParams({ type: type.type })}>Start import</Button>}
              />
            );
          })}
          {!typesQuery.isLoading && !types.length && !canImportEmployees && (
            <div className="col-12">
              <EmptyState icon={FileSpreadsheet} title="No imports available" description="Ask an administrator for Salary, Leave or Employee manage access." />
            </div>
          )}
        </div>
      )}

      {canUseHub && <div className="hz-card">
        <div className="hz-card__header">
          <div className="d-flex align-items-center gap-2"><History size={18} /><h3 className="hz-card__title mb-0">Import history</h3></div>
        </div>
        <div className="hz-card__body">
          {batchesQuery.isLoading && <Skeleton height={120} />}
          {batchesQuery.isError && <ErrorBanner>We could not load the import history.</ErrorBanner>}
          {batchesQuery.data && !batchesQuery.data.length && (
            <p className="text-secondary-hz mb-0">No imports yet. Batches appear here after each import, including failed ones.</p>
          )}
          {batchesQuery.data?.length > 0 && (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>#</th><th>Import</th><th>File</th><th>When</th><th>By</th>
                    <th className="text-end">Rows</th><th className="text-end">Imported</th><th className="text-end">Skipped</th><th className="text-end">Not imported</th>
                    <th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {batchesQuery.data.map((batch) => (
                    <BatchRow
                      key={batch.id}
                      batch={batch}
                      expanded={expandedBatch === batch.id}
                      detail={expandedBatch === batch.id ? batchDetail.data : null}
                      onToggle={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}

function ImportCard({ icon: Icon, title, description, columns, action }) {
  const required = (columns || []).filter((c) => c.required).map((c) => c.header);
  return (
    <div className="col-12 col-md-6 col-xl-4">
      <div className="hz-card h-100"><div className="hz-card__body d-flex flex-column gap-2 h-100">
        <div className="d-flex align-items-center gap-2">
          <span className="d-inline-flex align-items-center justify-content-center rounded" style={{ width: 34, height: 34, background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}>
            <Icon size={18} />
          </span>
          <strong>{title}</strong>
        </div>
        <p className="small text-secondary-hz mb-0 flex-grow-1">{description}</p>
        {required.length > 0 && <p className="small mb-0"><span className="text-secondary-hz">Required:</span> {required.join(', ')}</p>}
        <div>{action}</div>
      </div></div>
    </div>
  );
}

function BatchRow({ batch, expanded, detail, onToggle }) {
  return (
    <>
      <tr>
        <td>{batch.id}</td>
        <td>{batch.title}{batch.options && <div className="small text-secondary-hz">{batch.options}</div>}</td>
        <td className="text-truncate" style={{ maxWidth: 180 }}>{batch.fileName || '—'}</td>
        <td className="text-nowrap">{formatDateTimeIST(batch.createdAt)}</td>
        <td>{batch.importedBy || '—'}</td>
        <td className="text-end">{batch.totalRows}</td>
        <td className="text-end">{batch.importedRows}</td>
        <td className="text-end">{batch.skippedRows}</td>
        <td className="text-end">{batch.failedRows}</td>
        <td><Badge variant={STATUS_VARIANT[batch.status] || 'neutral'}>{batch.status}</Badge></td>
        <td>
          {(batch.failedRows > 0 || batch.status === 'FAILED') && (
            <button type="button" className="btn btn-link btn-sm p-0" onClick={onToggle}>{expanded ? 'Hide' : 'Errors'}</button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11}>
            <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap', background: 'var(--hz-gray-50)', padding: 8, borderRadius: 6 }}>
              {detail ? (detail.errorReport || detail.summary) : 'Loading…'}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
