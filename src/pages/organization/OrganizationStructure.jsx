import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, GitBranch, Network, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { organizationApi } from '../../api/endpoints/organization';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../../hooks/useAuth';

const ALL = 'all';

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function employeeSearchText(employee) {
  return [
    employee.fullName,
    employee.employeeCode,
    employee.departmentName,
    employee.teamName,
    employee.designation,
    employee.status,
    employee.reportingManagerName,
  ].map(normalized).join(' ');
}

function matchesEmployeeFilters(employee, filters) {
  if (filters.department !== ALL
      && (filters.department === 'unassigned' ? employee.departmentId != null : String(employee.departmentId) !== filters.department)) {
    return false;
  }
  if (filters.team !== ALL
      && (filters.team === 'unassigned' ? employee.teamId != null : String(employee.teamId) !== filters.team)) {
    return false;
  }
  if (filters.designation !== ALL && employee.designation !== filters.designation) return false;
  if (filters.status !== ALL && employee.status !== filters.status) return false;
  return true;
}

function EmployeeRow({ employee, canViewProfile }) {
  const initials = (employee.fullName || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="d-flex align-items-center justify-content-between gap-3 py-2 px-3 border-bottom">
      <div className="d-flex align-items-center gap-3 min-w-0">
        {employee.profilePhotoUrl ? (
          <img
            src={employee.profilePhotoUrl}
            alt=""
            className="rounded-circle flex-shrink-0"
            width="38"
            height="38"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
            aria-hidden="true"
            style={{ width: 38, height: 38, background: 'var(--hz-primary-50)', color: 'var(--hz-primary-700)', fontWeight: 700 }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0">
          {employee.id && canViewProfile ? (
            <Link to={`/employees/${employee.id}`} className="fw-semibold text-decoration-none">
              {employee.fullName || 'Unnamed employee'}
            </Link>
          ) : (
            <span className="fw-semibold">{employee.fullName || 'Unnamed employee'}</span>
          )}
          <div className="small text-secondary-hz">
            {[employee.employeeCode, employee.designation].filter(Boolean).join(' · ') || 'Employee'}
          </div>
        </div>
      </div>
      <span className="badge rounded-pill text-bg-light text-nowrap">{employee.status || 'Status unavailable'}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="hz-inline-summary__item">
      <strong className="d-inline-flex align-items-center gap-2"><Icon size={16} aria-hidden="true" />{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TeamBranch({ team, searchActive, canViewProfile }) {
  return (
    <details className="border rounded-3 mb-2" open={searchActive || undefined}>
      <summary className="d-flex align-items-center justify-content-between gap-3 p-3" style={{ cursor: 'pointer' }}>
        <span className="fw-semibold">{team.name}</span>
        <span className="small text-secondary-hz text-nowrap">
          {team.employeeCount} {team.employeeCount === 1 ? 'employee' : 'employees'}
          {team.leadEmployeeName ? ` · Lead: ${team.leadEmployeeName}` : ''}
        </span>
      </summary>
      <div className="px-2 pb-2">
        {team.employees.length
          ? team.employees.map((employee) => <EmployeeRow key={employee.id} employee={employee} canViewProfile={canViewProfile(employee)} />)
          : <p className="small text-secondary-hz px-3 mb-2">No employees match the selected filters.</p>}
      </div>
    </details>
  );
}

function DepartmentBranch({ department, searchActive, canViewProfile }) {
  return (
    <details className="border rounded-3 mb-3" open={searchActive || undefined}>
      <summary className="d-flex align-items-center justify-content-between gap-3 p-3" style={{ cursor: 'pointer' }}>
        <span className="fw-semibold">{department.name}</span>
        <span className="small text-secondary-hz text-nowrap">
          {department.employeeCount} {department.employeeCount === 1 ? 'employee' : 'employees'}
          {' · '}{department.teamCount} {department.teamCount === 1 ? 'team' : 'teams'}
        </span>
      </summary>
      <div className="px-3 pb-2">
        {department.teams.length
          ? department.teams.map((team) => <TeamBranch key={team.id ?? `${department.name}-unassigned`} team={team} searchActive={searchActive} canViewProfile={canViewProfile} />)
          : <p className="small text-secondary-hz mb-2">No teams match the selected filters.</p>}
      </div>
    </details>
  );
}

function ReportingBranch({ employee, childrenByManager, searchActive, canViewProfile, visited = new Set() }) {
  if (visited.has(employee.id)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(employee.id);
  const reports = childrenByManager.get(employee.id) || [];

  return (
    <div className="border-start ms-3 ps-3">
      <details className="border rounded-3 mb-2" open={searchActive || undefined}>
        <summary className="d-flex align-items-center justify-content-between gap-3 p-2" style={{ cursor: 'pointer' }}>
          <span className="min-w-0">
            <span className="fw-semibold">{employee.fullName || 'Unnamed employee'}</span>
            <span className="small text-secondary-hz d-block">
              {[employee.employeeCode, employee.designation].filter(Boolean).join(' · ') || 'Employee'}
            </span>
          </span>
          <span className="small text-secondary-hz text-nowrap">
            {reports.length ? `${reports.length} direct ${reports.length === 1 ? 'report' : 'reports'}` : 'No direct reports'}
          </span>
        </summary>
        {employee.id && (
          <div className="px-3 pt-2">
            <EmployeeRow employee={employee} canViewProfile={canViewProfile(employee)} />
          </div>
        )}
        {reports.length > 0 && (
          <div className="pb-2">
            {reports.map((report) => (
              <ReportingBranch
                key={report.id}
                employee={report}
                childrenByManager={childrenByManager}
                searchActive={searchActive}
                canViewProfile={canViewProfile}
                visited={nextVisited}
              />
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

export default function OrganizationStructure() {
  const { user, hasPermission } = useAuth();
  const [view, setView] = useState('organization');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    department: ALL,
    team: ALL,
    designation: ALL,
    status: ALL,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['organization-structure'],
    queryFn: organizationApi.structure,
  });

  const employees = data?.employees || [];
  const searchTerm = normalized(search);
  const hasFilters = Object.values(filters).some((filter) => filter !== ALL);
  const searchActive = !!searchTerm;
  const canViewProfile = (employee) => hasPermission('EMPLOYEE_VIEW')
    || String(user?.employeeId || '') === String(employee.id);

  const options = useMemo(() => {
    const departments = new Map();
    const teams = new Map();
    const designations = new Set();
    const statuses = new Set();
    (data?.departments || []).forEach((department) => {
      if (department.id != null) departments.set(String(department.id), department.name);
      department.teams.forEach((team) => {
        if (team.id != null) teams.set(String(team.id), team.name);
      });
    });
    employees.forEach((employee) => {
      if (employee.designation) designations.add(employee.designation);
      if (employee.status) statuses.add(employee.status);
    });
    return {
      departments: [...departments].sort((a, b) => a[1].localeCompare(b[1])),
      teams: [...teams].sort((a, b) => a[1].localeCompare(b[1])),
      designations: [...designations].sort((a, b) => a.localeCompare(b)),
      statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
    };
  }, [data, employees]);

  const visibleOrganization = useMemo(() => {
    return (data?.departments || []).map((department) => {
      const departmentMatchesSearch = searchTerm && normalized(department.name).includes(searchTerm);
      const departmentAllowed = filters.department === ALL
        || (filters.department === 'unassigned' ? department.id == null : String(department.id) === filters.department);
      if (!departmentAllowed) return null;

      const teams = department.teams.map((team) => {
        const teamMatchesSearch = searchTerm && normalized(team.name).includes(searchTerm);
        const teamAllowed = filters.team === ALL
          || (filters.team === 'unassigned' ? team.id == null : String(team.id) === filters.team);
        if (!teamAllowed) return null;
        const matchingEmployees = team.employees.filter((employee) => (
          matchesEmployeeFilters(employee, filters)
          && (!searchTerm
            || departmentMatchesSearch
            || teamMatchesSearch
            || employeeSearchText(employee).includes(searchTerm))
        ));
        const hasParentMatch = departmentMatchesSearch || teamMatchesSearch;
        if ((searchTerm || hasFilters) && matchingEmployees.length === 0 && !hasParentMatch) return null;
        return { ...team, employees: matchingEmployees, employeeCount: matchingEmployees.length };
      }).filter(Boolean);

      if ((searchTerm || hasFilters) && teams.length === 0 && !departmentMatchesSearch) return null;
      return {
        ...department,
        teams,
        employeeCount: teams.reduce((sum, team) => sum + team.employeeCount, 0),
        teamCount: teams.length,
      };
    }).filter(Boolean);
  }, [data, filters, hasFilters, searchTerm]);

  const visibleReportingEmployees = useMemo(() => {
    const filtered = employees.filter((employee) => matchesEmployeeFilters(employee, filters));
    const matches = filtered.filter((employee) => !searchTerm || employeeSearchText(employee).includes(searchTerm));
    if (!searchTerm) return matches;

    const allById = new Map(employees.map((employee) => [employee.id, employee]));
    const visibleById = new Map(matches.map((employee) => [employee.id, employee]));
    matches.forEach((employee) => {
      let managerId = employee.reportingManagerId;
      const seen = new Set([employee.id]);
      while (managerId != null && !seen.has(managerId)) {
        seen.add(managerId);
        const manager = allById.get(managerId);
        if (!manager) break;
        visibleById.set(manager.id, manager);
        managerId = manager.reportingManagerId;
      }
    });
    return [...visibleById.values()];
  }, [employees, filters, searchTerm]);

  const childrenByManager = useMemo(() => {
    const visibleIds = new Set(visibleReportingEmployees.map((employee) => employee.id));
    const map = new Map();
    visibleReportingEmployees.forEach((employee) => {
      if (employee.reportingManagerId != null && visibleIds.has(employee.reportingManagerId)) {
        const reports = map.get(employee.reportingManagerId) || [];
        reports.push(employee);
        map.set(employee.reportingManagerId, reports);
      }
    });
    map.forEach((reports) => reports.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')));
    return map;
  }, [visibleReportingEmployees]);

  const reportingRoots = useMemo(() => {
    const visibleIds = new Set(visibleReportingEmployees.map((employee) => employee.id));
    const roots = visibleReportingEmployees.filter((employee) => (
      employee.reportingManagerId == null || !visibleIds.has(employee.reportingManagerId)
    ));
    return roots.length ? roots : visibleReportingEmployees;
  }, [visibleReportingEmployees]);

  const resetFilters = () => {
    setSearch('');
    setFilters({ department: ALL, team: ALL, designation: ALL, status: ALL });
  };

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Organization"
        title="Organization Structure"
        description="Explore your company structure and employee reporting relationships."
        actions={(
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching} aria-label="Refresh organization structure">
            Refresh
          </Button>
        )}
      />

      {isLoading ? (
        <div className="hz-state" role="status">Loading organization structure…</div>
      ) : isError ? (
        <ErrorState
          title={error?.response?.status === 403 ? 'Organization access unavailable' : 'Could not load organization structure'}
          description={error?.response?.status === 403
            ? 'Your account does not have permission to view organization structure.'
            : 'The organization data could not be loaded. Please try again.'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <div className="hz-inline-summary" aria-label="Organization summary">
            <Stat icon={Building2} label="Company" value={data.companyName || 'Organization'} />
            <Stat icon={Users} label="Employees" value={data.employeeCount} />
            <Stat icon={Building2} label="Departments" value={data.departmentCount} />
            <Stat icon={Network} label="Teams" value={data.teamCount} />
          </div>

          <Card className="hz-organization-structure" bodyClassName="d-flex flex-column gap-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="btn-group" role="tablist" aria-label="Organization views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'organization'}
                  className={`btn ${view === 'organization' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setView('organization')}
                >
                  <Network size={16} className="me-2" />Organization Tree
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'reporting'}
                  className={`btn ${view === 'reporting' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setView('reporting')}
                >
                  <GitBranch size={16} className="me-2" />Reporting Tree
                </button>
              </div>
              {(search || hasFilters) && (
                <button type="button" className="btn btn-link btn-sm" onClick={resetFilters}>Clear filters</button>
              )}
            </div>

            <div className="row g-2 align-items-center">
              <div className="col-12 col-lg-4">
                <label className="visually-hidden" htmlFor="organization-search">Search organization</label>
                <div className="input-group">
                  <span className="input-group-text"><Search size={16} aria-hidden="true" /></span>
                  <input
                    id="organization-search"
                    className="form-control"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search people, code, team, or designation"
                  />
                </div>
              </div>
              <div className="col-6 col-lg">
                <label className="visually-hidden" htmlFor="organization-department-filter">Filter by department</label>
                <select id="organization-department-filter" className="form-select" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
                  <option value={ALL}>All departments</option>
                  <option value="unassigned">Unassigned department</option>
                  {options.departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              <div className="col-6 col-lg">
                <label className="visually-hidden" htmlFor="organization-team-filter">Filter by team</label>
                <select id="organization-team-filter" className="form-select" value={filters.team} onChange={(event) => setFilters((current) => ({ ...current, team: event.target.value }))}>
                  <option value={ALL}>All teams</option>
                  <option value="unassigned">Unassigned team</option>
                  {options.teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              <div className="col-6 col-lg">
                <label className="visually-hidden" htmlFor="organization-designation-filter">Filter by designation</label>
                <select id="organization-designation-filter" className="form-select" value={filters.designation} onChange={(event) => setFilters((current) => ({ ...current, designation: event.target.value }))}>
                  <option value={ALL}>All designations</option>
                  {options.designations.map((designation) => <option key={designation} value={designation}>{designation}</option>)}
                </select>
              </div>
              <div className="col-6 col-lg">
                <label className="visually-hidden" htmlFor="organization-status-filter">Filter by status</label>
                <select id="organization-status-filter" className="form-select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value={ALL}>All statuses</option>
                  {options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            {view === 'organization' ? (
              visibleOrganization.length ? (
                <div className="d-flex flex-column gap-2">
                  <div className="border rounded-3 p-3 d-flex align-items-center gap-3">
                    <Building2 size={20} className="text-primary flex-shrink-0" />
                    <div>
                      <strong>{data.companyName || 'Company'}</strong>
                      <div className="small text-secondary-hz">Company organization</div>
                    </div>
                  </div>
                  <div className="border-start ms-3 ps-3">
                    {visibleOrganization.map((department) => (
                      <DepartmentBranch
                        key={department.id ?? 'unassigned-department'}
                        department={department}
                        searchActive={searchActive}
                        canViewProfile={canViewProfile}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon={Users} title="No matching organization data" description="Try changing or clearing your search and filters." />
              )
            ) : reportingRoots.length ? (
              <div className="d-flex flex-column gap-2">
                {reportingRoots.map((employee) => (
                  <ReportingBranch
                    key={employee.id}
                    employee={employee}
                    childrenByManager={childrenByManager}
                    searchActive={searchActive}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={GitBranch} title="No matching reporting relationships" description="Try changing or clearing your search and filters." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
