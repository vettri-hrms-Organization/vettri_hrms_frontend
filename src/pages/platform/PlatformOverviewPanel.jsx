import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, CircleDollarSign, Clock, Laptop, Users } from 'lucide-react';
import Card from '../../components/ui/Card';
import { SkeletonText } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import { supportAccessApi } from '../../api/endpoints/supportAccess';
import { formatDateIST, formatDateTimeIST } from '../../utils/formatDateTime';

const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const STATUS = {
  ACTIVE: { label: 'Active', color: 'var(--hz-success-600)', background: 'var(--hz-success-50)' },
  TRIALING: { label: 'Trial', color: 'var(--hz-primary-600)', background: 'var(--hz-primary-50)' },
  TRIAL: { label: 'Trial', color: 'var(--hz-primary-600)', background: 'var(--hz-primary-50)' },
  PENDING_PAYMENT: { label: 'Awaiting ₹1', color: 'var(--hz-warning-600)', background: 'var(--hz-warning-50)' },
  PAST_DUE: { label: 'Overdue', color: 'var(--hz-warning-600)', background: 'var(--hz-warning-50)' },
  EXPIRED: { label: 'Trial ended', color: 'var(--hz-danger-600)', background: 'var(--hz-danger-50)' },
  SUSPENDED: { label: 'Suspended', color: 'var(--hz-danger-600)', background: 'var(--hz-danger-50)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--hz-text-muted)', background: 'var(--hz-gray-100, #f2f4f7)' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paying', label: 'Paying', test: (row) => row.status === 'ACTIVE' && row.plan !== 'TRIAL' },
  { key: 'trial', label: 'On trial', test: (row) => ['TRIALING', 'TRIAL'].includes(row.status) },
  { key: 'ending', label: 'Ending in 7 days', test: (row) => row.daysLeft != null && row.daysLeft >= 0 && row.daysLeft <= 7 },
  { key: 'attention', label: 'Needs attention', test: (row) => ['PAST_DUE', 'EXPIRED', 'SUSPENDED', 'PENDING_PAYMENT'].includes(row.status) },
];

function SummaryTile({ icon: Icon, label, value, detail, color }) {
  return (
    <div className="h-100 d-flex flex-column gap-1 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 14, background: 'var(--hz-bg-surface)' }}>
      <div className="d-flex align-items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hz-text-secondary)' }}>
        <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 28, height: 28, borderRadius: 8, background: `${color}1A`, color }}><Icon size={15} aria-hidden="true" /></span>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
      {detail && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{detail}</div>}
    </div>
  );
}

/**
 * SUPER_ADMIN business view of every customer: plan, status, how long they can still use it,
 * payments and usage counts. No employee names or HR data - those need the company's support grant.
 */
export default function PlatformOverviewPanel() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['platform-overview'], queryFn: supportAccessApi.platformOverview });

  const rows = useMemo(() => {
    const active = FILTERS.find((item) => item.key === filter);
    const term = search.trim().toLowerCase();
    return (data?.companies || [])
      .filter((row) => !row.demo)
      .filter((row) => !active?.test || active.test(row))
      .filter((row) => !term || `${row.name} ${row.adminName || ''} ${row.adminEmail || ''}`.toLowerCase().includes(term));
  }, [data, filter, search]);

  if (isError) return <ErrorState description="Couldn't load the platform overview." onRetry={refetch} />;
  const summary = data?.summary;

  return (
    <Card title="Customers overview" subtitle="Plans, payments and usage for every company. Employee data stays private unless a company allows support access.">
      {isLoading && <SkeletonText lines={6} />}
      {summary && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-xl-2"><SummaryTile icon={Building2} label="Companies" value={summary.companies} detail={`${summary.paying} paying`} color="#4169E1" /></div>
          <div className="col-6 col-xl-2"><SummaryTile icon={Clock} label="On trial" value={summary.trials} detail={`${summary.trialsEndingThisWeek} ending this week`} color="#6366F1" /></div>
          <div className="col-6 col-xl-2"><SummaryTile icon={AlertTriangle} label="Needs attention" value={summary.overdue + summary.readOnly} detail={`${summary.overdue} overdue · ${summary.readOnly} read-only`} color="#9A6519" /></div>
          <div className="col-6 col-xl-2"><SummaryTile icon={CircleDollarSign} label="This month" value={inr(summary.revenueThisMonth)} detail={`${inr(summary.revenueTotal)} all time`} color="#12735A" /></div>
          <div className="col-6 col-xl-2"><SummaryTile icon={Users} label="Employees" value={summary.employees.toLocaleString('en-IN')} detail="across all companies" color="#8B5CF6" /></div>
          <div className="col-6 col-xl-2"><SummaryTile icon={Laptop} label="Laptops" value={summary.devices.toLocaleString('en-IN')} detail="with the Vettri Agent" color="#06B6D4" /></div>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        {FILTERS.map((item) => (
          <button key={item.key} type="button" className={`btn btn-sm ${filter === item.key ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>
        ))}
        <input className="form-control form-control-sm ms-auto" style={{ maxWidth: 260 }} placeholder="Search company or admin" aria-label="Search companies" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="table-responsive">
        <table className="table align-middle mb-0 hz-table" aria-label="Customer companies">
          <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>Valid until</th><th>Employees</th><th>Laptops</th><th>Paid so far</th><th>Last payment</th><th>Last active</th><th>Support</th></tr></thead>
          <tbody>
            {data && rows.length === 0 && <tr><td colSpan={10} className="text-secondary-hz">No companies match.</td></tr>}
            {rows.map((row) => {
              const status = STATUS[row.status] || { label: row.status || 'No plan', color: 'var(--hz-text-muted)', background: 'var(--hz-gray-100, #f2f4f7)' };
              const urgent = row.daysLeft != null && row.daysLeft <= 7;
              return (
                <tr key={row.companyId}>
                  <td>
                    <div>{row.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--hz-text-muted)' }}>{row.adminName || '—'}{row.adminEmail ? ` · ${row.adminEmail}` : ''}</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--hz-text-muted)' }}>Joined {row.signedUpAt ? formatDateIST(row.signedUpAt) : '—'}</div>
                  </td>
                  <td>{row.plan || '—'}{row.billingCycle ? <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{row.billingCycle.toLowerCase()}</div> : null}</td>
                  <td><span className="badge rounded-pill" style={{ background: status.background, color: status.color, fontWeight: 700 }}>{status.label}</span></td>
                  <td>
                    {row.validUntil ? formatDateIST(row.validUntil) : '—'}
                    {row.daysLeft != null && <div style={{ fontSize: 12, fontWeight: urgent ? 700 : 400, color: urgent ? 'var(--hz-warning-600)' : 'var(--hz-text-muted)' }}>{row.daysLeft < 0 ? `${-row.daysLeft} days ago` : `${row.daysLeft} days left`}</div>}
                  </td>
                  <td>{row.employees}{row.employeeLimit ? <span style={{ color: 'var(--hz-text-muted)' }}> / {row.employeeLimit}</span> : null}</td>
                  <td>{row.devices}</td>
                  <td>{inr(row.totalPaid)}</td>
                  <td>{row.lastPaymentAt ? <>{inr(row.lastPaymentAmount)}<div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{formatDateIST(row.lastPaymentAt)}</div></> : '—'}</td>
                  <td>{row.lastActiveAt ? formatDateTimeIST(row.lastActiveAt) : 'Never'}<div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{row.activeUsers7d} active users (7 days)</div></td>
                  <td>{row.supportAccessUntil ? <span style={{ color: 'var(--hz-warning-600)', fontWeight: 600 }}>{row.supportAccessLevel === 'FULL' ? 'Full' : 'View'} until {formatDateTimeIST(row.supportAccessUntil)}</span> : <span style={{ color: 'var(--hz-text-muted)' }}>Off</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
