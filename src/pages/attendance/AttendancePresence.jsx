import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Home, RefreshCw, Users, X } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints/attendance';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Avatar from '../../components/ui/Avatar';
import { SkeletonText } from '../../components/ui/Skeleton';

export default function AttendancePresence() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const presence = useQuery({ queryKey: ['attendance-team'], queryFn: () => attendanceApi.team() });
  const requests = useQuery({ queryKey: ['attendance-wfh-team'], queryFn: attendanceApi.teamWfh });
  const decision = useMutation({
    mutationFn: ({ id, action }) => action === 'approve' ? attendanceApi.approveWfh(id, note) : attendanceApi.rejectWfh(id, note),
    onSuccess: () => { setNote(''); queryClient.invalidateQueries({ queryKey: ['attendance-wfh-team'] }); },
  });
  const checkedIn = presence.data?.filter((item) => item.status === 'CHECKED_IN').length || 0;

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Workforce" title="Team presence" description="Review your direct reports’ attendance and decide pending WFH requests." actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { presence.refetch(); requests.refetch(); }}>Refresh</Button>} />
      {decision.isError && <div className="alert alert-danger mb-0">WFH decision could not be saved.</div>}
      <div className="row g-3"><div className="col-12 col-md-4"><Metric label="Checked in" value={checkedIn} icon={Clock3} /></div><div className="col-12 col-md-4"><Metric label="Team sessions" value={presence.data?.length || 0} icon={Users} /></div><div className="col-12 col-md-4"><Metric label="Pending WFH" value={requests.data?.length || 0} icon={Home} /></div></div>
      <Card title="Today’s team presence"><div className="table-responsive">{presence.isLoading && <SkeletonText lines={5} />}{presence.isError && <ErrorState description="Couldn’t load team presence." onRetry={presence.refetch} />}{!presence.isLoading && !presence.isError && presence.data?.length === 0 && <EmptyState icon={Users} title="No team attendance yet" description="Your direct reports will appear after they check in." />}{presence.data?.length > 0 && <table className="table mb-0 align-middle"><thead><tr><th>Employee</th><th>Mode</th><th>Check in</th><th>Check out</th><th>Status</th><th>Duration</th></tr></thead><tbody>{presence.data.map((item) => <tr key={item.id}><td><div className="d-flex align-items-center gap-2"><Avatar name={item.employeeName} size="sm" /><strong>{item.employeeName}</strong></div></td><td>{item.locationType || '—'}</td><td>{item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>{item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td><StatusBadge status={item.status} variant={item.status === 'CHECKED_IN' ? 'success' : 'info'} dot={false}>{item.status.replace('_', ' ')}</StatusBadge></td><td>{item.durationMinutes ? `${item.durationMinutes} min` : '—'}</td></tr>)}</tbody></table>}</div></Card>
      <Card title="Pending WFH approvals" subtitle="Decisions apply only within your company workspace."><div className="mb-3"><label className="form-label" htmlFor="manager-note">Decision note</label><input id="manager-note" className="form-control" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note shared with the employee" maxLength={500} /></div>{requests.isLoading && <SkeletonText lines={4} />}{requests.isError && <ErrorState description="Couldn’t load WFH requests." onRetry={requests.refetch} />}{!requests.isLoading && !requests.isError && requests.data?.length === 0 && <EmptyState icon={Home} title="No pending requests" description="There are no WFH decisions waiting for you." />}{requests.data?.length > 0 && <div className="d-flex flex-column gap-2">{requests.data.map((request) => <div key={request.id} className="d-flex align-items-center justify-content-between flex-wrap gap-3 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 8 }}><div><div className="d-flex align-items-center gap-2"><strong>{request.employeeName}</strong><StatusBadge status="PENDING" variant="warning" dot={false}>PENDING</StatusBadge></div><div className="text-muted-hz" style={{ fontSize: 13 }}>{request.workDate} · {request.reason || 'No reason provided'}</div></div><div className="d-flex gap-2"><Button variant="secondary" size="sm" icon={X} onClick={() => decision.mutate({ id: request.id, action: 'reject' })} loading={decision.isPending}>Reject</Button><Button size="sm" icon={Check} onClick={() => decision.mutate({ id: request.id, action: 'approve' })} loading={decision.isPending}>Approve</Button></div></div>)}</div>}</Card>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return <div className="hz-stat-card"><div className="d-flex align-items-center justify-content-between"><div><div className="text-muted-hz" style={{ fontSize: 13 }}>{label}</div><strong style={{ fontSize: 28 }}>{value}</strong></div><Icon size={22} /></div></div>;
}
