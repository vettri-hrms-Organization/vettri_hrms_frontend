import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Copy, Eye, FilterX, Link2, Mail, Monitor, Plus, ShieldCheck, Search, SearchX, UserRoundPen, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  monitoringApi,
  getDeviceId,
  getDeviceName,
  getDeviceEmployeeName,
  getDeviceEmployeeId,
  isDeviceOnline,
  getDeviceLastSeen,
  getDeviceOS,
  getDeviceAgentVersion,
} from '../../api/endpoints/monitoring';
import { timeAgoIST } from '../../utils/formatDateTime';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import PageHeader from '../../components/ui/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import StatusBadge from '../../components/ui/StatusBadge';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { vettriMicrocopy } from '../../utils/vettriMicrocopy';

const STALE_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'offline7', label: 'Offline 7+ days' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'outdated', label: 'Older agent' },
];

function parseAgentVersion(value) {
  const match = typeof value === 'string' ? value.trim().match(/^v?(\d+(?:\.\d+)*)/i) : null;
  return match ? match[1].split('.').map(Number) : null;
}

function compareAgentVersions(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function toTimestamp(value) {
  if (!value) return null;
  // Backend LocalDateTime values are UTC without an offset (see utils/formatDateTime).
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value}Z` : value;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? null : time;
}

function isOfflineForWeek(device, now) {
  if (isDeviceOnline(device)) return false;
  const lastSeen = toTimestamp(getDeviceLastSeen(device));
  // A device that has never sent a heartbeat has been silent at least as long.
  return lastSeen === null || now - lastSeen >= STALE_OFFLINE_MS;
}

function isUnassigned(device) {
  return !getDeviceEmployeeId(device) && !getDeviceEmployeeName(device);
}

function isOlderAgent(device, newestParsed) {
  if (!newestParsed) return false;
  const parsed = parseAgentVersion(getDeviceAgentVersion(device));
  return Boolean(parsed) && compareAgentVersions(parsed, newestParsed) < 0;
}

function matchesStatusFilter(device, filter, now, newestParsed) {
  switch (filter) {
    case 'online': return isDeviceOnline(device);
    case 'offline': return !isDeviceOnline(device);
    case 'offline7': return isOfflineForWeek(device, now);
    case 'unassigned': return isUnassigned(device);
    case 'outdated': return isOlderAgent(device, newestParsed);
    default: return true;
  }
}

export default function Devices() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [connectOpen, setConnectOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [assignmentDevice, setAssignmentDevice] = useState(null);
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('');
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageDevices = hasPermission('IT_MANAGEMENT_ACCESS')
    && hasPermission('MONITORING_MANAGE');

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['monitoring-devices'], queryFn: monitoringApi.devices, refetchInterval: 30_000 });
  const inventorySummaryQuery = useQuery({
    queryKey: ['monitoring-device-inventory-summary'],
    queryFn: monitoringApi.inventoryScanSummary,
    enabled: canManageDevices,
    refetchInterval: 10_000,
  });
  const canViewInventory = hasPermission('IT_MANAGEMENT_ACCESS') && hasPermission('MONITORING_VIEW');
  const inventorySummary = inventorySummaryQuery.data || { totalDevices: 0, queuedCount: 0, scanningCount: 0, completedCount: 0, failedCount: 0, offlineCount: 0, neverScannedCount: 0 };
  const employees = useQuery({ queryKey: ['monitoring-device-employee-options'], queryFn: monitoringApi.deviceEmployeeOptions, enabled: (connectOpen || Boolean(assignmentDevice)) && canManageDevices });
  const enrollmentQuery = useQuery({ queryKey: ['monitoring-device-enrollments'], queryFn: monitoringApi.deviceEnrollments, enabled: canManageDevices, refetchInterval: 10_000 });
  const bulkScan = useMutation({
    mutationFn: monitoringApi.bulkRequestDeviceInventoryScan,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitoring-devices'] });
      await queryClient.invalidateQueries({ queryKey: ['monitoring-device-inventory-summary'] });
    },
  });
  const enroll = useMutation({
    mutationFn: () => monitoringApi.enrollDevice({ employeeId: Number(employeeId), deviceType: 'WINDOWS_PC' }),
    onSuccess: (result) => { setEnrollment(result); setEmailSent(false); queryClient.invalidateQueries({ queryKey: ['monitoring-device-enrollments'] }); },
  });
  const sendEmail = useMutation({
    mutationFn: (id) => monitoringApi.sendDeviceEnrollmentEmail(id),
    onSuccess: () => setEmailSent(true),
  });
  const revoke = useMutation({
    mutationFn: (id) => monitoringApi.revokeDeviceEnrollment(id),
    onSuccess: () => {
      setEnrollment(null);
      queryClient.invalidateQueries({ queryKey: ['monitoring-device-enrollments'] });
    },
  });
  const updateAssignment = useMutation({
    mutationFn: () => monitoringApi.updateDeviceAssignment(getDeviceId(assignmentDevice), Number(assignmentEmployeeId)),
    onSuccess: () => {
      setAssignmentDevice(null);
      setAssignmentEmployeeId('');
      queryClient.invalidateQueries({ queryKey: ['monitoring-devices'] });
    },
  });
  const currentEnrollment = enrollment
    ? (enrollmentQuery.data || []).find((item) => item.id === enrollment.id) || enrollment
    : null;
  const connectedDevice = currentEnrollment?.device;

  useEffect(() => {
    if (connectedDevice) {
      queryClient.invalidateQueries({ queryKey: ['monitoring-devices'] });
    }
  }, [connectedDevice?.deviceName, queryClient]);

  function openConnect() { setEnrollment(null); enroll.reset(); sendEmail.reset(); revoke.reset(); setEmailSent(false); setEmployeeId(''); setConnectOpen(true); }
  function closeConnect() { setConnectOpen(false); setEnrollment(null); enroll.reset(); setEmailSent(false); setEmployeeId(''); }
  function openAssignment(device) {
    updateAssignment.reset();
    setAssignmentEmployeeId(String(device.employeeId || ''));
    setAssignmentDevice(device);
  }
  function closeAssignment() {
    if (updateAssignment.isPending) return;
    setAssignmentDevice(null);
    setAssignmentEmployeeId('');
    updateAssignment.reset();
  }
  async function copyEnrollmentLink(item) {
    if (item?.enrollmentUrl) await navigator.clipboard.writeText(item.enrollmentUrl);
  }

  async function downloadInventoryReport(format) {
    const blob = await monitoringApi.exportInventoryReport(format);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `device-inventory-report.${format === 'excel' ? 'xlsx' : 'csv'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  const devices = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const newestAgent = useMemo(() => {
    let newest = null;
    devices.forEach((d) => {
      const version = getDeviceAgentVersion(d);
      const parsed = parseAgentVersion(version);
      if (parsed && (!newest || compareAgentVersions(parsed, newest.parsed) > 0)) newest = { version, parsed };
    });
    return newest;
  }, [devices]);
  const newestParsed = newestAgent?.parsed || null;

  // Recomputed with every 30s device refetch, which is precise enough for "7+ days".
  const now = useMemo(() => Date.now(), [devices]);

  const filterCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach((f) => {
      counts[f.value] = devices.filter((d) => matchesStatusFilter(d, f.value, now, newestParsed)).length;
    });
    return counts;
  }, [devices, now, newestParsed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      if (!matchesStatusFilter(d, statusFilter, now, newestParsed)) return false;
      if (!q) return true;
      return [
        getDeviceName(d),
        getDeviceEmployeeName(d),
        d.employeeCode,
        d.hostname,
        d.serialNumber,
        d.hardwareInventory?.serialNumber,
      ].some((value) => value && String(value).toLowerCase().includes(q));
    });
  }, [devices, search, statusFilter, now, newestParsed]);

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'all';
  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
  }

  const columns = [
    {
      key: 'device',
      label: 'Device Name',
      headerClassName: 'ps-4',
      className: 'ps-4',
      render: (d) => (
        <Link to={`/monitoring/devices/${getDeviceId(d)}`} className="d-flex align-items-center gap-2 text-decoration-none">
          <div className="hz-stat__icon" style={{ width: 32, height: 32, background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}>
            <Monitor size={15} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>{getDeviceName(d)}</span>
        </Link>
      ),
    },
    { key: 'employee', label: 'Employee', render: (d) => getDeviceEmployeeName(d) || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (d) => (
        <StatusBadge status={isDeviceOnline(d) ? 'ACTIVE' : 'INACTIVE'} variant={isDeviceOnline(d) ? 'success' : 'neutral'} dot>
          {isDeviceOnline(d) ? 'Online' : 'Offline'}
        </StatusBadge>
      ),
    },
    {
      key: 'lastSeen',
      label: 'Last Seen',
      render: (d) => timeAgoIST(getDeviceLastSeen(d)),
      style: { color: 'var(--hz-text-secondary)' },
    },
    { key: 'os', label: 'Operating System', render: (d) => getDeviceOS(d) },
    {
      key: 'inventory',
      label: 'Hardware Inventory',
      render: (d) => (
        <div className="d-flex flex-column align-items-start gap-1">
          <StatusBadge
            status={d.inventoryStatus || 'NOT_SCANNED'}
            variant={d.inventoryStatus === 'COMPLETED' ? 'success' : d.inventoryStatus === 'FAILED' || d.inventoryStatus === 'OFFLINE' ? 'warning' : 'neutral'}
          >
            {d.inventoryStatus || 'NOT_SCANNED'}
          </StatusBadge>
          <span className="text-secondary-hz small">
            {d.lastInventoryScanAt ? timeAgoIST(d.lastInventoryScanAt) : 'Not scanned'}
          </span>
        </div>
      ),
    },
    {
      key: 'agentVersion',
      label: 'Agent Version',
      render: (d) => (
        <div className="d-flex flex-column align-items-start gap-1">
          <span>{getDeviceAgentVersion(d)}</span>
          {isOlderAgent(d, newestParsed) && (
            <StatusBadge status="PENDING" variant="warning" title={`Newest agent in your fleet is ${newestAgent?.version}`}>
              Update pending
            </StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'pe-4',
      className: 'pe-4',
      render: (d) => (
        <div className="d-flex align-items-center gap-2">
          {canManageDevices && (
            <Button type="button" variant="ghost" size="sm" icon={UserRoundPen} onClick={() => openAssignment(d)}>
              {d.employeeId ? 'Change employee' : 'Map device'}
            </Button>
          )}
          <Link
            to={`/monitoring/devices/${getDeviceId(d)}`}
            className="hz-icon-btn d-inline-flex align-items-center justify-content-center border-0"
            style={{ width: 32, height: 32 }}
            aria-label={`View ${getDeviceName(d)}`}
          >
            <Eye size={15} />
          </Link>
        </div>
      ),
    },
  ];

  const enrollmentColumns = [
    { key: 'employee', label: 'Employee', render: (item) => item.employeeName },
    { key: 'status', label: 'Enrollment', render: (item) => <StatusBadge status={item.status === 'PENDING' ? 'PENDING' : item.status === 'USED' ? 'ACTIVE' : 'INACTIVE'} variant={item.status === 'PENDING' ? 'warning' : item.status === 'USED' ? 'success' : 'neutral'}>{item.status}</StatusBadge> },
    { key: 'expires', label: 'Expires', render: (item) => item.status === 'PENDING' ? timeAgoIST(item.expiresAt) : '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => item.status === 'PENDING' ? (
        <div className="d-flex gap-2">
          <Button type="button" variant="ghost" size="sm" icon={Copy} onClick={() => copyEnrollmentLink(item)}>Copy link</Button>
          <Button type="button" variant="ghost" size="sm" icon={Mail} loading={sendEmail.isPending && sendEmail.variables === item.id} onClick={() => sendEmail.mutate(item.id)}>Email</Button>
          <Button type="button" variant="ghost" size="sm" icon={X} loading={revoke.isPending && revoke.variables === item.id} onClick={() => revoke.mutate(item.id)}>Revoke</Button>
        </div>
      ) : '—',
    },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader eyebrow="Monitoring" title="Monitored Devices" description="Every device enrolled with the Windows Agent" actions={canManageDevices && <Button icon={Plus} onClick={openConnect}>Connect Device</Button>} />

      {canViewInventory && (
        <Card>
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div className="hz-mini-stats">
              {[
                { label: 'Total enrolled', value: inventorySummary.totalDevices },
                { label: 'Queued', value: inventorySummary.queuedCount },
                { label: 'Scanning', value: inventorySummary.scanningCount },
                { label: 'Completed', value: inventorySummary.completedCount },
                { label: 'Failed', value: inventorySummary.failedCount },
                { label: 'Offline', value: inventorySummary.offlineCount },
                { label: 'Never scanned', value: inventorySummary.neverScannedCount },
              ].map((item) => (
                <div key={item.label} className="hz-mini-stat">
                  <span>{item.label}</span>
                  <strong>{item.value ?? 0}</strong>
                </div>
              ))}
            </div>

            <div className="d-flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => bulkScan.mutate()}
                loading={bulkScan.isPending}
                disabled={bulkScan.isPending || !canManageDevices}
              >
                {bulkScan.isPending ? 'Queuing scans...' : 'Scan All Devices'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => downloadInventoryReport('csv')}>
                Download CSV Report
              </Button>
              <Button type="button" variant="secondary" onClick={() => downloadInventoryReport('excel')}>
                Download Excel Report
              </Button>
            </div>
          </div>
          {bulkScan.isError && (
            <div className="mt-3">
              <ErrorBanner>{bulkScan.error?.response?.data?.message || 'Could not queue a bulk inventory scan.'}</ErrorBanner>
            </div>
          )}
        </Card>
      )}

      <FilterBar>
        <div className="position-relative" style={{ maxWidth: 360, width: '100%' }}>
          <Search size={16} className="position-absolute" style={{ left: 12, top: 10, color: 'var(--hz-text-muted)' }} />
          <input
            type="search"
            placeholder="Search device, employee or serial…"
            aria-label="Search devices by name, employee, hostname or serial number"
            className="form-control ps-5"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      <div className="d-flex flex-wrap gap-2" role="group" aria-label="Quick device filters">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(f.value)}
              className="d-inline-flex align-items-center gap-2"
              title={f.value === 'outdated' && newestAgent ? `Older than ${newestAgent.version}, the newest agent in your fleet` : undefined}
              style={{
                minHeight: 34,
                padding: '6px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--hz-primary-500)' : 'var(--hz-border)'}`,
                background: active ? 'var(--hz-primary-50)' : 'var(--hz-bg-surface)',
                color: active ? 'var(--hz-primary-700)' : 'var(--hz-text-secondary)',
                fontSize: 'var(--hz-text-sm)',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {f.label}
              <span
                style={{
                  minWidth: 22,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: active ? 'var(--hz-primary-100)' : 'var(--hz-gray-100)',
                  color: 'var(--hz-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {isLoading ? '–' : filterCounts[f.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          rows={filtered}
          getRowKey={(d) => getDeviceId(d)}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyIcon={hasActiveFilters ? SearchX : Monitor}
          emptyTitle={hasActiveFilters ? vettriMicrocopy.empty.devicesSearchTitle : vettriMicrocopy.empty.devicesTitle}
          emptyDescription={hasActiveFilters ? vettriMicrocopy.empty.devicesSearchDescription : vettriMicrocopy.empty.devicesDescription}
          emptyAction={hasActiveFilters
            ? <Button type="button" variant="secondary" icon={FilterX} onClick={clearFilters}>Clear filters</Button>
            : canManageDevices && <Button icon={Plus} onClick={openConnect}>Connect Device</Button>}
        />
      </Card>

      {canManageDevices && (
        <Card>
          <div className="hz-card__body">
            <h2 className="h5 mb-3">Agent enrollments</h2>
            {enrollmentQuery.isError && <ErrorBanner>{enrollmentQuery.error?.response?.data?.message || 'Could not load agent enrollment requests.'}</ErrorBanner>}
            {sendEmail.isError && <ErrorBanner>{sendEmail.error?.response?.data?.message || 'Could not send enrollment instructions.'}</ErrorBanner>}
            {revoke.isError && <ErrorBanner>{revoke.error?.response?.data?.message || 'Could not revoke this enrollment.'}</ErrorBanner>}
            <Table columns={enrollmentColumns} rows={enrollmentQuery.data || []} getRowKey={(item) => item.id} isLoading={enrollmentQuery.isLoading} emptyTitle="No agent enrollments" emptyDescription="New one-time employee enrollment links will appear here." />
          </div>
        </Card>
      )}

      <Dialog open={connectOpen} onClose={closeConnect} title="Provision a Windows device" description="Create a secure, one-time enrollment for an employee's Windows computer." size="md" footer={!enrollment ? <><Button variant="secondary" onClick={closeConnect}>Cancel</Button><Button form="device-provisioning-form" type="submit" icon={ShieldCheck} loading={enroll.isPending} disabled={!employeeId}>Create enrollment</Button></> : <Button variant="secondary" onClick={closeConnect}>{connectedDevice ? 'Done' : 'Close'}</Button>}>
        <div className="hz-enrollment">
          <div className="hz-enrollment__progress" aria-label="Device enrollment progress">
            <span className="hz-enrollment__step is-complete"><i>1</i>Prepare</span>
            <span className={`hz-enrollment__step ${enrollment ? 'is-complete' : 'is-active'}`}><i>2</i>Secure</span>
            <span className={`hz-enrollment__step ${connectedDevice ? 'is-complete' : enrollment ? 'is-active' : ''}`}><i>3</i>Connect</span>
          </div>
          {!enrollment ? (
            <form id="device-provisioning-form" onSubmit={(event) => { event.preventDefault(); enroll.mutate(); }} className="hz-enrollment">
              <div className="hz-enrollment__intro"><h3>Set up a trusted endpoint</h3><p>Select the employee who will use this computer. The one-time enrollment link expires after 24 hours and can register only one device.</p></div>
              <div className="hz-enrollment__fields"><label className="hz-form-label">Assigned employee<select className="form-select" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required><option value="">Choose an employee</option>{(employees.data || []).map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim()}</option>)}</select></label></div>
              {employees.isError && <ErrorBanner>{employees.error?.response?.data?.message || 'Could not load employees for device assignment.'}</ErrorBanner>}
              {enroll.isError && <ErrorBanner>{enroll.error?.response?.data?.message || 'Could not create the enrollment token.'}</ErrorBanner>}
            </form>
          ) : (
            <>
              <div className="hz-enrollment__intro"><h3>{connectedDevice ? 'Device connected' : 'Enrollment link is ready'}</h3><p>{connectedDevice ? 'The computer has securely enrolled and is reporting to Vettri.' : 'Share this private link with the employee or send the setup instructions by email.'}</p></div>
              <div className="hz-enrollment__token"><div className="hz-enrollment__token-label"><span>Private enrollment link</span><Button type="button" variant="ghost" size="sm" icon={Copy} onClick={() => copyEnrollmentLink(currentEnrollment)}>Copy link</Button></div><div className="hz-enrollment__token-value">{currentEnrollment?.enrollmentUrl || 'Link unavailable'}</div></div>
              <div className="d-flex flex-wrap gap-2">
                <Button type="button" variant="secondary" icon={Mail} loading={sendEmail.isPending} onClick={() => sendEmail.mutate(enrollment.id)}>{emailSent ? 'Instructions sent' : 'Email employee'}</Button>
                {currentEnrollment?.enrollmentUrl && <a className="btn btn-outline-primary d-inline-flex align-items-center gap-2" href={currentEnrollment.enrollmentUrl} target="_blank" rel="noreferrer"><Link2 size={16} /> Open enrollment page</a>}
                {currentEnrollment?.status === 'PENDING' && <Button type="button" variant="ghost" icon={X} loading={revoke.isPending} onClick={() => revoke.mutate(enrollment.id)}>Revoke link</Button>}
              </div>
              {sendEmail.isError && <ErrorBanner>{sendEmail.error?.response?.data?.message || 'Could not send enrollment instructions.'}</ErrorBanner>}
              {revoke.isError && <ErrorBanner>{revoke.error?.response?.data?.message || 'Could not revoke this enrollment.'}</ErrorBanner>}
              {!connectedDevice && currentEnrollment?.status === 'PENDING' && <div className="hz-enrollment__signal"><span><span className="spinner-border spinner-border-sm" aria-hidden="true" /></span><span>Waiting for the employee to install and run the Vettri Agent…</span></div>}
              {connectedDevice && <div className="hz-card"><div className="hz-card__body"><div className="row g-3" style={{ fontSize: 'var(--hz-text-sm)' }}><div className="col-6"><span className="text-secondary-hz d-block">Device</span>{connectedDevice.deviceName}</div><div className="col-6"><span className="text-secondary-hz d-block">Employee</span>{currentEnrollment.employeeName}</div><div className="col-6"><span className="text-secondary-hz d-block">Platform</span>{connectedDevice.operatingSystem}</div><div className="col-6"><span className="text-secondary-hz d-block">Agent</span>{connectedDevice.agentVersion}</div></div></div></div>}
            </>
          )}
        </div>
      </Dialog>
      <Dialog
        open={Boolean(assignmentDevice)}
        onClose={closeAssignment}
        title={assignmentDevice?.employeeId ? 'Change device assignment' : 'Map device to employee'}
        description={`Choose the employee associated with ${assignmentDevice ? getDeviceName(assignmentDevice) : 'this device'}.`}
        size="md"
        footer={(
          <>
            <Button variant="secondary" onClick={closeAssignment}>Cancel</Button>
            <Button
              type="button"
              icon={UserRoundPen}
              loading={updateAssignment.isPending}
              disabled={!assignmentEmployeeId || String(assignmentDevice?.employeeId || '') === assignmentEmployeeId}
              onClick={() => updateAssignment.mutate()}
            >
              Confirm assignment
            </Button>
          </>
        )}
      >
        <div className="hz-enrollment">
          <p className="mb-1">Review both the device and employee before confirming. This uses Vettri's existing device-assignment operation.</p>
          <label className="hz-form-label">
            Employee
            <select
              className="form-select"
              value={assignmentEmployeeId}
              onChange={(event) => setAssignmentEmployeeId(event.target.value)}
              disabled={employees.isLoading || updateAssignment.isPending}
            >
              <option value="">Choose an employee</option>
              {(employees.data || []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim()}
                </option>
              ))}
            </select>
          </label>
          {employees.isError && <ErrorBanner>{employees.error?.response?.data?.message || 'Could not load employees for device assignment.'}</ErrorBanner>}
          {updateAssignment.isError && <ErrorBanner>{updateAssignment.error?.response?.data?.message || 'Could not update this device assignment.'}</ErrorBanner>}
        </div>
      </Dialog>
    </div>
  );
}
