import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  UserPlus,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
} from 'lucide-react';
import { exportToCsv } from '../../utils/exportToCsv';
import { formatDateIST, toISTDateInputValue } from '../../utils/formatDateTime';

import { employeesApi } from '../../api/endpoints/employees';
import { dashboardApi } from '../../api/endpoints/dashboard';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Table from '../../components/ui/Table';
import CreateEmployeeModal from './CreateEmployeeModal';
import { statusMeta, EMPLOYMENT_TYPE_LABEL } from './statusMeta';
import PageHeader from '../../components/ui/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import SearchField from '../../components/ui/SearchField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { vettriMicrocopy } from '../../utils/vettriMicrocopy';

const COLUMNS = [
  {
    key: 'employee',
    label: 'Employee',
    headerClassName: 'ps-4',
    className: 'ps-4',
    render: (emp) => (
      <Link
        to={`/employees/${emp.id}`}
        className="d-flex align-items-center gap-2 text-decoration-none"
      >
        <Avatar name={emp.fullName} size="sm" />

        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 'var(--hz-text-sm)',
              color: 'var(--hz-text-primary)',
            }}
          >
            {emp.fullName}
          </div>

          <div
            style={{
              fontSize: 12,
              color: 'var(--hz-text-muted)',
            }}
          >
            {emp.employeeCode}
          </div>
        </div>
      </Link>
    ),
  },

  {
    key: 'department',
    label: 'Department',
    render: (emp) => emp.departmentName || '—',
  },

  {
    key: 'designation',
    label: 'Designation',
    render: (emp) => emp.designationTitle || '—',
  },

  {
    key: 'manager',
    label: 'Manager',
    render: (emp) =>
      emp.reportingManagerName ||
      emp.reportingPersonEmail ||
      '—',
  },

  {
    key: 'type',
    label: 'Type',
    render: (emp) =>
      EMPLOYMENT_TYPE_LABEL[emp.employmentType] ||
      emp.employmentType ||
      '—',
  },

  {
    key: 'status',
    label: 'Status',
    render: (emp) => {
      const meta = statusMeta(emp.status);

      return (
        <StatusBadge
          status={emp.status}
          variant={meta.variant}
          dot
        >
          {meta.label}
        </StatusBadge>
      );
    },
  },

  {
    key: 'joined',
    label: 'Joined',
    headerClassName: 'pe-4',
    className: 'pe-4',
    render: (emp) =>
      emp.dateOfJoining
        ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    style: {
      color: 'var(--hz-text-secondary)',
    },
  },
];

/** One CSV row of the employee master export. */
export function toEmployeeExportRow(emp) {
  return {
    'Employee Code': emp.employeeCode || '',
    Name: emp.fullName || '',
    Email: emp.email || '',
    Phone: emp.phone || '',
    Department: emp.departmentName || '',
    Designation: emp.designationTitle || '',
    Team: emp.teamName || '',
    Manager: emp.reportingManagerName || '',
    Status: statusMeta(emp.status).label || '',
    'Employment Type': EMPLOYMENT_TYPE_LABEL[emp.employmentType] || emp.employmentType || '',
    'Date of Joining': emp.dateOfJoining ? formatDateIST(emp.dateOfJoining) : '',
    'Work Location': emp.workLocation || '',
  };
}

export default function EmployeeList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();

  const departmentId = searchParams.get('departmentId');
  const departmentName = searchParams.get('departmentName');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState(null);

  const queryClient = useQueryClient();

  // Keep 25 items per page.
  const pageSize = 25;

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'employees-paged',
      search,
      page,
      pageSize,
      departmentId,
    ],
    queryFn: () =>
      employeesApi.listPaged(
        search,
        page,
        pageSize,
        departmentId
      ),
  });

  // Workforce-wide figures for the summary tiles (shares the dashboard's
  // cache entry, so this is usually already loaded).
  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.summary,
    retry: false,
  });

  const employees = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;
  const canImportEmployees = hasPermission('EMPLOYEE_IMPORT');
  const canCreateEmployees = hasPermission('EMPLOYEE_CREATE');
  const canManageEmployees = hasPermission('EMPLOYEE_MANAGE');
  const canViewEmployees = hasPermission('EMPLOYEE_VIEW');

  const bulkUpdate = useMutation({
    mutationFn: async () =>
      Promise.all(
        Array.from(selectedIds).map((id) =>
          employeesApi.updateStatus(id, bulkStatus)
        )
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employees-paged'],
      });

      setSelectedIds(new Set());
      setBulkStatus(null);
    },
  });

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  // Pages through the same scoped /api/employees/paged endpoint the table
  // uses (with the current search + department filter), so the file only
  // ever contains employees this user is allowed to list.
  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const byId = new Map();
      const exportPageSize = 100;
      for (let p = 0; p < 500; p += 1) {
        const result = await employeesApi.listPaged(search, p, exportPageSize, departmentId);
        const content = result?.content ?? [];
        content.forEach((emp) => byId.set(emp.id, emp));
        if (content.length === 0 || p >= (result?.totalPages ?? 1) - 1) break;
      }
      const rows = Array.from(byId.values()).map(toEmployeeExportRow);
      if (rows.length === 0) {
        setExportError('There are no employees to export.');
        return;
      }
      exportToCsv(`employees-${toISTDateInputValue()}`, rows);
    } catch {
      setExportError("Couldn't export employees. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function handleSearchChange(value) {
    setSearch(value);
    setPage(0);
  }

  function clearDepartmentFilter() {
    setSearchParams({});
    setPage(0);
  }

  function toggleRow(emp) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(emp.id)) {
        next.delete(emp.id);
      } else {
        next.add(emp.id);
      }

      return next;
    });
  }

  function toggleAll(checked) {
    setSelectedIds(
      checked
        ? new Set(employees.map((emp) => emp.id))
        : new Set()
    );
  }

  return (
    <div className="hz-module-page hz-module-page--employees d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Workforce"
        title="Employees"
        description="Your organization's people, all in one place"
        actions={
          <div className="d-flex gap-2">
            {canViewEmployees && (
              <Button
                variant="secondary"
                icon={Download}
                loading={exporting}
                disabled={totalElements === 0}
                onClick={handleExport}
              >
                Export
              </Button>
            )}

            {canImportEmployees && (
              <Link
                to="/employees/import"
                className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
              >
                <FileSpreadsheet size={16} />
                Import Employees
              </Link>
            )}

            {canCreateEmployees && (
              <Button
                icon={UserPlus}
                onClick={() => setShowCreate(true)}
              >
                Onboard Employee
              </Button>
            )}
          </div>
        }
      />

      {summary && (
        <div className="hz-inline-summary" aria-label="Workforce summary">
          <div className="hz-inline-summary__item">
            <strong>{summary.totalEmployees.toLocaleString('en-IN')}</strong>
            <span>Total employees</span>
          </div>
          <div className="hz-inline-summary__item hz-inline-summary__item--success">
            <strong>{summary.activeEmployees.toLocaleString('en-IN')}</strong>
            <span>Active</span>
          </div>
          <div className="hz-inline-summary__item hz-inline-summary__item--warning">
            <strong>{summary.onLeave.toLocaleString('en-IN')}</strong>
            <span>On leave</span>
          </div>
          <div className="hz-inline-summary__item hz-inline-summary__item--info">
            <strong>{(summary.departmentBreakdown?.length ?? 0).toLocaleString('en-IN')}</strong>
            <span>Departments</span>
          </div>
        </div>
      )}

      <FilterBar>
        <SearchField
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name, code, or email…"
          aria-label="Search employees by name, code, or email"
        />

        {departmentId && (
          <div
            className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-3"
            style={{
              background: 'var(--hz-primary-50)',
              border: '1px solid var(--hz-primary-100)',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--hz-primary-700)',
              }}
            >
              Department:{' '}
              {departmentName || departmentId}
            </span>

            <button
              type="button"
              onClick={clearDepartmentFilter}
              className="btn btn-link p-0 d-flex align-items-center"
              style={{
                color: 'var(--hz-primary-700)',
              }}
              aria-label="Clear department filter"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </FilterBar>

      {exportError && <p role="alert" className="text-danger mb-0">{exportError}</p>}

      {canManageEmployees && selectedIds.size > 0 && (
        <div
          className="hz-bulk-toolbar"
          role="toolbar"
          aria-label="Bulk employee actions"
        >
          <strong>
            {selectedIds.size} selected
          </strong>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkStatus('Active')}
          >
            Mark active
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkStatus('On Leave')}
          >
            Mark on leave
          </Button>

          <button
            type="button"
            className="btn btn-link btn-sm"
            onClick={() =>
              setSelectedIds(new Set())
            }
          >
            Clear selection
          </button>
        </div>
      )}

      <Card bodyClassName="p-0">
        <Table
          columns={COLUMNS}
          rows={employees}
          getRowKey={(emp) => emp.id}
          selectable={canManageEmployees}
          selectedKeys={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyTitle={search ? vettriMicrocopy.empty.employeesSearchTitle : vettriMicrocopy.empty.employeesTitle}
          emptyDescription={search ? vettriMicrocopy.empty.employeesSearchDescription : vettriMicrocopy.empty.employeesDescription}
        />

        {!isLoading &&
          !isError &&
          totalElements > 0 && (
            <div className="hz-table-pagination">
              <span
                style={{
                  fontSize:
                    'var(--hz-text-sm)',
                  color:
                    'var(--hz-text-muted)',
                }}
              >
                {page * pageSize + 1}-
                {Math.min(
                  (page + 1) * pageSize,
                  totalElements
                )}{' '}
                of {totalElements}
              </span>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="hz-icon-btn d-flex align-items-center justify-content-center border-0"
                  style={{
                    width: 32,
                    height: 32,
                  }}
                  onClick={() =>
                    setPage((p) =>
                      Math.max(p - 1, 0)
                    )
                  }
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <span
                  style={{
                    fontSize:
                      'var(--hz-text-sm)',
                    color:
                      'var(--hz-text-secondary)',
                  }}
                >
                  Page {page + 1} of{' '}
                  {Math.max(
                    totalPages,
                    1
                  )}
                </span>

                <button
                  type="button"
                  className="hz-icon-btn d-flex align-items-center justify-content-center border-0"
                  style={{
                    width: 32,
                    height: 32,
                  }}
                  onClick={() =>
                    setPage((p) =>
                      Math.min(
                        p + 1,
                        totalPages - 1
                      )
                    )
                  }
                  disabled={
                    page >= totalPages - 1
                  }
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
      </Card>

      {showCreate && (
        <CreateEmployeeModal
          onClose={() => setShowCreate(false)}
        />
      )}

      <ConfirmDialog
        open={!!bulkStatus}
        onClose={() => setBulkStatus(null)}
        onConfirm={() => bulkUpdate.mutate()}
        loading={bulkUpdate.isPending}
        title={`Mark ${selectedIds.size} employees ${bulkStatus?.toLowerCase()}?`}
        description="This will update the employment status for every selected employee."
        confirmLabel="Update status"
      />
    </div>
  );
}
