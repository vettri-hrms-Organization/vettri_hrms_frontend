import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Copy, Eye, Link2, Mail, Monitor, Plus, ShieldCheck, Search, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  monitoringApi,
  getDeviceId,
  getDeviceName,
  getDeviceEmployeeName,
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

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
];

export default function Devices() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [connectOpen, setConnectOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageDevices = hasPermission('MONITORING_MANAGE');

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['monitoring-devices'], queryFn: monitoringApi.devices, refetchInterval: 30_000 });
  const employees = useQuery({ queryKey: ['monitoring-device-employee-options'], queryFn: monitoringApi.deviceEmployeeOptions, enabled: connectOpen && canManageDevices });
  const enrollmentQuery = useQuery({ queryKey: ['monitoring-device-enrollments'], queryFn: monitoringApi.deviceEnrollments, enabled: canManageDevices, refetchInterval: 10_000 });
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
  async function copyEnrollmentLink(item) {
    if (item?.enrollmentUrl) await navigator.clipboard.writeText(item.enrollmentUrl);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((d) => {
      const online = isDeviceOnline(d);
      if (statusFilter === 'online' && !online) return false;
      if (statusFilter === 'offline' && online) return false;
      if (!q) return true;
      const name = getDeviceName(d).toLowerCase();
      const employee = (getDeviceEmployeeName(d) || '').toLowerCase();
      return name.includes(q) || employee.includes(q);
    });
  }, [data, search, statusFilter]);

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
    { key: 'agentVersion', label: 'Agent Version', render: (d) => getDeviceAgentVersion(d) },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'pe-4',
      className: 'pe-4',
      render: (d) => (
        <Link
          to={`/monitoring/devices/${getDeviceId(d)}`}
          className="hz-icon-btn d-inline-flex align-items-center justify-content-center border-0"
          style={{ width: 32, height: 32 }}
          aria-label={`View ${getDeviceName(d)}`}
        >
          <Eye size={15} />
        </Link>
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

      <FilterBar>
        <div className="position-relative" style={{ maxWidth: 360, width: '100%' }}>
          <Search size={16} className="position-absolute" style={{ left: 12, top: 10, color: 'var(--hz-text-muted)' }} />
          <input
            type="search"
            placeholder="Search by device or employee…"
            className="form-control ps-5"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="form-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </FilterBar>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          rows={filtered}
          getRowKey={(d) => getDeviceId(d)}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyIcon={Monitor}
          emptyTitle={search || statusFilter !== 'all' ? 'No matching devices' : 'No devices connected yet'}
          emptyDescription={
            search || statusFilter !== 'all'
              ? 'Try a different search term or status filter.'
              : 'Connect a Windows computer to start monitoring employee activity.'
          }
          emptyAction={canManageDevices && !search && statusFilter === 'all' && <Button icon={Plus} onClick={openConnect}>Connect Device</Button>}
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
    </div>
  );
}
