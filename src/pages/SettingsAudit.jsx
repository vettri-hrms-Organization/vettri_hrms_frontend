import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { axiosClient } from '../api/axiosClient';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import FormField from '../components/ui/FormField';
import { SkeletonText } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const ACTION_VARIANT = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  ACTIVATE: 'success',
  DEACTIVATE: 'warning',
  LOGIN: 'neutral',
  PASSWORD_CHANGE: 'primary',
};

// Every entity name actually passed to AuditLogService.log(...)
const ENTITY_TYPES = [
  'Candidate',
  'Department',
  'Designation',
  'Device',
  'Employee',
  'Goal',
  'Holiday',
  'Interview',
  'JobOpening',
  'LeaveRequest',
  'LeaveType',
  'PayrollItem',
  'PayrollRun',
  'PerformanceReview',
  'Role',
  'SalaryStructure',
  'Team',
  'User',
];

const PAGE_SIZE = 10;

const HEADER_COLOR = '#0B2342';

export default function SettingsAudit() {
  const [page, setPage] = useState(0);
  const [entityName, setEntityName] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, entityName],
    queryFn: () =>
      axiosClient
        .get('/api/audit/logs', {
          params: {
            page,
            size: PAGE_SIZE,
            entityName: entityName || undefined,
          },
        })
        .then((res) => res.data),
  });

  const rows = data?.content || [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  function handleEntityChange(value) {
    setEntityName(value);
    setPage(0);
  }

  const startRecord =
    totalElements === 0 ? 0 : page * PAGE_SIZE + 1;

  const endRecord = Math.min(
    (page + 1) * PAGE_SIZE,
    totalElements
  );

  return (
    <div className="hz-admin-page hz-admin-page--audit d-flex flex-column gap-4">

      {/* Page Header */}
      <PageHeader
        eyebrow="Administration"
        title="Audit Logs"
        description="Every create, update, activation, and login event across the platform"
        actions={
          <div style={{ width: 220 }}>
            <FormField
              as="select"
              label="Entity"
              value={entityName}
              onChange={handleEntityChange}
            >
              <option value="">All entities</option>

              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FormField>
          </div>
        }
      />

      {/* Audit Table */}
      <Card bodyClassName="p-0">

        {/* Loading */}
        {isLoading && (
          <div className="p-4">
            <SkeletonText lines={6} />
          </div>
        )}

        {/* Error */}
        {isError && (
          <ErrorState
            description="Couldn't load audit logs."
            onRetry={refetch}
          />
        )}

        {/* Data */}
        {!isLoading && !isError && (
          <>
            <div className="table-responsive">

              <table
                className="table table-bordered table-hover table-striped align-middle mb-0"
                style={{
                  fontSize: 'var(--hz-text-sm)',
                  minWidth: 900,
                }}
              >

                {/* Header */}
                <thead>
                  <tr>
                    <th
                      className="ps-4 py-3"
                      style={{
                        backgroundColor: HEADER_COLOR,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        borderColor: HEADER_COLOR,
                      }}
                    >
                      When
                    </th>

                    <th
                      className="py-3"
                      style={{
                        backgroundColor: HEADER_COLOR,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        borderColor: HEADER_COLOR,
                      }}
                    >
                      Entity
                    </th>

                    <th
                      className="py-3"
                      style={{
                        backgroundColor: HEADER_COLOR,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        borderColor: HEADER_COLOR,
                      }}
                    >
                      Action
                    </th>

                    <th
                      className="py-3"
                      style={{
                        backgroundColor: HEADER_COLOR,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        borderColor: HEADER_COLOR,
                      }}
                    >
                      Performed By
                    </th>

                    <th
                      className="pe-4 py-3"
                      style={{
                        backgroundColor: HEADER_COLOR,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        borderColor: HEADER_COLOR,
                      }}
                    >
                      Details
                    </th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody>

                  {rows.map((log) => (
                    <tr key={log.id}>

                      {/* When */}
                      <td
                        className="ps-4 py-3"
                        style={{
                          color: 'var(--hz-text-secondary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.performedAt
                          ? new Date(log.performedAt).toLocaleString()
                          : '—'}
                      </td>

                      {/* Entity */}
                      <td
                        className="py-3"
                        style={{
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.entityName || '—'}

                        {log.entityId !== null &&
                          log.entityId !== undefined && (
                            <span
                              style={{
                                color: 'var(--hz-text-muted)',
                                fontWeight: 400,
                              }}
                            >
                              {' '}
                              #{log.entityId}
                            </span>
                          )}
                      </td>

                      {/* Action */}
                      <td className="py-3">
                        <StatusBadge
                          status={log.action}
                          variant={
                            ACTION_VARIANT[log.action] || 'neutral'
                          }
                          dot={false}
                        >
                          {log.action}
                        </StatusBadge>
                      </td>

                      {/* Performed By */}
                      <td
                        className="py-3"
                        style={{
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.performedBy || '—'}
                      </td>

                      {/* Details */}
                      <td
                        className="pe-4 py-3"
                        style={{
                          color: 'var(--hz-text-secondary)',
                          maxWidth: 500,
                        }}
                      >
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 500,
                          }}
                          title={log.details || ''}
                        >
                          {log.details || '—'}
                        </div>
                      </td>

                    </tr>
                  ))}

                </tbody>
              </table>

            </div>

            {/* Empty State */}
            {rows.length === 0 && (
              <div className="p-4">
                <EmptyState
                  title={
                    entityName
                      ? 'No matching activity'
                      : 'No activity yet'
                  }
                  description={
                    entityName
                      ? `No ${entityName} events recorded.`
                      : 'Actions taken across Vettri HRMS will show up here as they happen.'
                  }
                />
              </div>
            )}

            {/* Pagination */}
            {totalElements > 0 && (
              <div
                className="d-flex align-items-center justify-content-between px-4 py-3"
                style={{
                  borderTop: '1px solid var(--hz-border)',
                  backgroundColor: '#fff',
                }}
              >

                {/* Record Count */}
                <span
                  style={{
                    fontSize: 'var(--hz-text-sm)',
                    color: 'var(--hz-text-muted)',
                  }}
                >
                  Showing {startRecord} - {endRecord} of {totalElements}
                </span>

                {/* Pagination Controls */}
                <div className="d-flex align-items-center gap-2">

                  {/* Previous */}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={() =>
                      setPage((p) => Math.max(p - 1, 0))
                    }
                    disabled={page === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>

                  {/* Page Number */}
                  <span
                    className="px-2"
                    style={{
                      fontSize: 'var(--hz-text-sm)',
                      color: 'var(--hz-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Page {page + 1} of {Math.max(totalPages, 1)}
                  </span>

                  {/* Next */}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={() =>
                      setPage((p) =>
                        Math.min(
                          p + 1,
                          Math.max(totalPages - 1, 0)
                        )
                      )
                    }
                    disabled={
                      totalPages === 0 ||
                      page >= totalPages - 1
                    }
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>

                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}