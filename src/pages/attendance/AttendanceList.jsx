import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { Radio, Clock, Fingerprint, AlertTriangle, CalendarOff, Users } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints/attendance';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import { useAuth } from '../../hooks/useAuth';
import { formatTimeIST } from '../../utils/formatDateTime';

function PunchBadge({ type }) {
  return <StatusBadge status={type === 'IN' ? 'PRESENT' : type === 'OUT' ? 'COMPLETED' : type} variant={type === 'IN' ? 'success' : type === 'OUT' ? 'info' : 'neutral'} dot={false}>{type}</StatusBadge>;
}

/**
 * The detailed list categorizes active employees without a punch today,
 * including approved leave; it doesn't infer lateness without shift data.
 */
function AttendanceExceptionsCard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-exceptions'],
    queryFn: () => attendanceApi.exceptions(),
  });

  return (
    <Card
      title="Attendance Exceptions"
      subtitle={data?.date ? `Employees with no punch on ${data.date}` : undefined}
    >
      {isLoading && <SkeletonText lines={2} />}
      {isError && <ErrorState description="Couldn't load exceptions." onRetry={refetch} />}
      {!isLoading && !isError && data && !data.workingDay && (
        <EmptyState icon={CalendarOff} title="Not a working day" description="Weekends and company holidays are excluded from this check." />
      )}
      {!isLoading && !isError && data?.workingDay && (data.exceptions || []).length === 0 && (
        <EmptyState icon={Clock} title="No exceptions" description="Every active employee has either punched in or is on approved leave today." />
      )}
      {!isLoading && !isError && data?.workingDay && (data.exceptions || []).length > 0 && (
        <div className="d-flex flex-column gap-2">
          <div className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: 13, color: 'var(--hz-warning-600)' }}>
            <AlertTriangle size={15} />
            {(data.exceptions || []).filter((item) => item.category !== 'LEAVE').length} employee(s) require attention
          </div>
          <div className="d-flex flex-column gap-2">
            {data.exceptions.map((item) => (
              <Link
                key={item.employeeId}
                to={`/employees/${item.employeeId}?tab=attendance`}
                className="d-flex align-items-center justify-content-between flex-wrap gap-2 text-decoration-none px-3 py-2 rounded-3"
                style={{ background: 'var(--hz-gray-50)', border: '1px solid var(--hz-border)' }}
              >
                <span className="d-flex align-items-center gap-2">
                  <Avatar name={item.employeeName} size="sm" />
                  <span>
                    <strong className="d-block" style={{ fontSize: 13, color: 'var(--hz-text-primary)' }}>{item.employeeName}</strong>
                    <small style={{ color: 'var(--hz-text-secondary)' }}>{item.message}</small>
                  </span>
                </span>
                <StatusBadge status={item.category} variant={item.category === 'LEAVE' || item.category === 'WFH_APPROVED' ? 'success' : item.category === 'REGULARIZATION_PENDING' ? 'warning' : 'danger'} dot={false}>
                  {item.category.replaceAll('_', ' ')}
                </StatusBadge>
              </Link>
            ))}
          </div>
          {/* Backward compatibility for older server responses. */}
          {(data.exceptions || []).length === 0 && data.missingPunch.length > 0 && (
          <div className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: 13, color: 'var(--hz-warning-600)' }}>
            {data.missingPunch.length} employee{data.missingPunch.length === 1 ? '' : 's'} with no punch today
          </div>
          )}
          <div className="d-flex flex-wrap gap-2">
            {(data.exceptions || []).length === 0 && data.missingPunch.map((emp) => (
              <Link
                key={emp.id}
                to={`/employees/${emp.id}`}
                className="d-flex align-items-center gap-2 text-decoration-none px-2 py-1 rounded-3"
                style={{ background: 'var(--hz-gray-50)', border: '1px solid var(--hz-border)' }}
              >
                <Avatar name={emp.fullName} size="sm" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--hz-text-primary)' }}>{emp.fullName}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function AttendanceRegularizationReviewCard() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const { data: requests = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-regularizations-pending'],
    queryFn: attendanceApi.pendingRegularizations,
    enabled: hasPermission('ATTENDANCE_MANAGE'),
  });
  const review = useMutation({
    mutationFn: ({ id, approved }) => attendanceApi.reviewRegularization(id, approved, notes[id] || null),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['attendance-regularizations-pending'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-exceptions'] });
    },
    onError: (failure) => setError(failure.response?.data?.message || 'Could not review this request.'),
  });

  if (!hasPermission('ATTENDANCE_MANAGE')) return null;
  return (
    <Card title="Attendance regularization requests" subtitle="Review employee-submitted exceptions within your authorized scope">
      {isLoading && <SkeletonText lines={2} />}
      {isError && <ErrorState description="Couldn't load regularization requests." onRetry={refetch} />}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!isLoading && !isError && requests.length === 0 && <EmptyState icon={Clock} title="No pending requests" description="New attendance regularization requests will appear here." />}
      {requests.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Pending attendance regularization requests">
            <thead><tr><th>Employee</th><th>Date</th><th>Requested time</th><th>Reason</th><th>Review note</th><th>Actions</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request.id}>
                <td>{request.employeeName}</td>
                <td>{request.attendanceDate}</td>
                <td>{request.requestedCheckIn}{request.requestedCheckOut ? ` – ${request.requestedCheckOut}` : ''}</td>
                <td>{request.reason}</td>
                <td><input className="form-control form-control-sm" aria-label={`Review note for ${request.employeeName}`} value={notes[request.id] || ''} maxLength={500} onChange={(event) => setNotes({ ...notes, [request.id]: event.target.value })} /></td>
                <td><div className="d-flex gap-2"><Button size="sm" onClick={() => review.mutate({ id: request.id, approved: true })} loading={review.isPending}>Approve</Button><Button size="sm" variant="secondary" onClick={() => review.mutate({ id: request.id, approved: false })} disabled={review.isPending}>Reject</Button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AttendanceList() {
  const { user, hasPermission } = useAuth();
  if (user?.employeeId && !hasPermission('ATTENDANCE_VIEW')) return <Navigate to="/my-profile?tab=attendance" replace />;
  return <AttendanceManagement />;
}

function AttendanceManagement() {
  const [liveRecords, setLiveRecords] = useState([]);
  const [connectionState, setConnectionState] = useState('connecting');
  const eventSourceRef = useRef(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => attendanceApi.byDate(),
  });

  useEffect(() => {
    if (data) {
      setLiveRecords(data);
    }
  }, [data]);

  useEffect(() => {
    const es = new EventSource(attendanceApi.streamUrl());
    eventSourceRef.current = es;

    es.addEventListener('connected', () => setConnectionState('live'));
    es.addEventListener('attendance', (event) => {
      try {
        const record = JSON.parse(event.data);
        setLiveRecords((prev) => (prev.some((r) => r.id === record.id) ? prev : [record, ...prev]));
      } catch {
        setConnectionState('disconnected');
      }
    });
    es.onerror = () => setConnectionState('disconnected');

    return () => es.close();
  }, []);

  const uniqueEmployees = new Set(liveRecords.filter((record) => record.employeeId).map((record) => record.employeeId)).size;
  const unmappedPunches = liveRecords.filter((record) => !record.mapped).length;

  return (
    <div className="hz-module-page hz-module-page--attendance d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Workforce"
        title="Attendance"
        description="Live punches from your biometric devices, today"
        actions={<div className="d-flex align-items-center gap-2">
          <Link to="/attendance/devices">
            <Button variant="secondary" size="sm" icon={Fingerprint}>
              Devices
            </Button>
          </Link>
          <Link to="/attendance/presence">
            <Button variant="secondary" size="sm" icon={Users}>
              Team presence
            </Button>
          </Link>
          <div
            className={`hz-live-pill ${connectionState === 'live' ? 'hz-live-pill--on' : 'hz-live-pill--off'}`}
          >
            <Radio size={13} />
            {connectionState === 'live' ? 'Live' : connectionState === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </div>
        </div>}
      />

      <div className="row g-3">
        <AttendanceMetric label="Punches today" value={liveRecords.length} icon={Clock} tone="primary" />
        <AttendanceMetric label="Employees recorded" value={uniqueEmployees} icon={Users} tone="success" />
        <AttendanceMetric label="Unmapped punches" value={unmappedPunches} icon={AlertTriangle} tone="warning" />
      </div>

      <AttendanceExceptionsCard />
      <AttendanceRegularizationReviewCard />

      <Card bodyClassName="p-0">
        {isLoading && (
          <div className="p-4">
            <SkeletonText lines={6} />
          </div>
        )}

        {isError && <ErrorState description="Couldn't load today's attendance." onRetry={refetch} />}

        {!isLoading && !isError && liveRecords.length === 0 && (
          <EmptyState
            icon={Clock}
            title="No punches yet today"
            description="As soon as someone scans their fingerprint on a mapped device, it'll show up here instantly."
          />
        )}

        {!isLoading && !isError && liveRecords.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Today's attendance">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th className="ps-4">Employee</th>
                <th>Department</th>
                <th>Punch Time</th>
                <th>Type</th>
                <th>Source</th>
                <th>Verify Mode</th>
                <th className="pe-4">Device</th>
              </tr>
            </thead>
            <tbody>
              {liveRecords.map((r) => (
                <tr key={r.id}>
                  <td data-label="Employee" className="ps-4">
                    {r.mapped ? (
                      <Link to={`/employees/${r.employeeId}`} className="d-flex align-items-center gap-2 text-decoration-none">
                        <Avatar name={r.employeeName} size="sm" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>
                            {r.employeeName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.employeeCode}</div>
                        </div>
                      </Link>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <Avatar name="?" size="sm" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{r.employeeName}</div>
                          <StatusBadge status="PENDING" variant="warning">Unmapped</StatusBadge>
                        </div>
                      </div>
                    )}
                  </td>
                  <td data-label="Department" style={{ fontSize: 'var(--hz-text-sm)' }}>{r.departmentName || '—'}</td>
                  <td data-label="Punch time" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>
                    {formatTimeIST(r.punchTime)}
                  </td>
                  <td data-label="Type">
                    <PunchBadge type={r.punchType} />
                  </td>
                  <td data-label="Source" style={{ fontSize: 'var(--hz-text-sm)' }}>{r.source || 'BIOMETRIC'}</td>
                  <td data-label="Verify mode" style={{ fontSize: 'var(--hz-text-sm)' }}>{r.verifyMode}</td>
                  <td data-label="Device" className="pe-4" style={{ fontSize: 'var(--hz-text-sm)' }}>
                    {r.deviceName}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AttendanceMetric({ label, value, icon: Icon, tone }) {
  return (
    <div className="col-12 col-md-4">
      <StatCard label={label} value={value} icon={Icon} accent={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'primary'} />
    </div>
  );
}
