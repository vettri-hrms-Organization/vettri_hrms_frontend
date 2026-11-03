import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { BookOpen, CalendarDays, CalendarPlus, Gift, MoreHorizontal, PartyPopper, Search } from 'lucide-react';
import { leaveRequestsApi, leaveTypesApi } from '../../api/endpoints/leave';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Dialog from '../../components/ui/Dialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { categoricalColor } from '../../design-system/palette';
import { formatDateIST } from '../../utils/formatDateTime';
import ApplyLeaveModal from './ApplyLeaveModal';
import LeaveSelfServicePanel, { CompOffDialog } from './LeaveSelfServicePanel';
import { leaveStatusMeta } from './leaveStatusMeta';
import './my-leave.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE_SIZE = 8;
const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const fmt = (n) => {
  const number = Number(n) || 0;
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
};
const plural = (n, word) => `${fmt(n)} ${word}${Number(n) === 1 ? '' : 's'}`;
const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const parseDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`);

/** Leave days of a request that fall in `year`, one entry per calendar day (half-day requests count 0.5). */
function daysInYear(request, year) {
  const result = [];
  if (!request?.startDate || !request?.endDate) return result;
  const end = parseDate(request.endDate);
  const weight = request.halfDay ? 0.5 : 1;
  for (let day = parseDate(request.startDate); day <= end; day.setDate(day.getDate() + 1)) {
    if (day.getFullYear() === year) result.push({ date: new Date(day), weight });
  }
  // Leave counted in working days (weekends/holidays skipped) should not be inflated by the calendar walk.
  const total = result.reduce((sum, entry) => sum + entry.weight, 0);
  const days = Number(request.days) || total;
  if (total > 0 && days < total) result.forEach((entry) => { entry.weight *= days / total; });
  return result;
}

function overlapsYear(request, year) {
  return parseDate(request.startDate).getFullYear() <= year && parseDate(request.endDate).getFullYear() >= year;
}

function canCancel(request) {
  if (request.status === 'PENDING') return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Mirrors the backend: approved leave can be cancelled only until it starts.
  return request.status === 'APPROVED' && parseDate(request.startDate) >= today;
}

/** "Accrued so far" only means something for leave that builds up over the year. */
function accruedLabel(mode) {
  if (mode === 'MONTHLY' || mode === 'QUARTERLY') return 'Accrued so far';
  if (mode === 'COMP_OFF') return 'Credited';
  return 'Granted';
}

export default function MyLeave() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showApply, setShowApply] = useState(false);
  const [showCompOff, setShowCompOff] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  // Shortcuts elsewhere ("Request leave" on the home page) open the form straight away.
  useEffect(() => {
    if (searchParams.get('apply') !== 'leave') return;
    setShowApply(true);
    const next = new URLSearchParams(searchParams);
    next.delete('apply');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const balancesQuery = useQuery({
    queryKey: ['leave-balance', String(employeeId), year],
    queryFn: () => leaveRequestsApi.balance(employeeId, year),
    enabled: !!employeeId,
  });
  const requestsQuery = useQuery({
    queryKey: ['leave-requests-employee', String(employeeId)],
    queryFn: () => leaveRequestsApi.byEmployee(employeeId),
    enabled: !!employeeId,
  });
  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: leaveTypesApi.list });

  // Links such as "View History" arrive with #leave-history; scroll there once the history has rendered.
  useEffect(() => {
    if (requestsQuery.isLoading || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [requestsQuery.isLoading]);

  const cancel = useMutation({
    mutationFn: (id) => leaveRequestsApi.cancel(id),
    onSuccess: () => {
      setCancelling(null);
      toast.success('Leave request cancelled.');
      queryClient.invalidateQueries({ queryKey: ['leave-requests-employee'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (error) => {
      setCancelling(null);
      toast.error(error?.response?.data?.message || 'Could not cancel the request.');
    },
  });

  const balances = Array.isArray(balancesQuery.data) ? balancesQuery.data : [];
  const requests = useMemo(() => (Array.isArray(requestsQuery.data) ? requestsQuery.data : []), [requestsQuery.data]);
  const types = Array.isArray(typesQuery.data) ? typesQuery.data : [];
  const typeById = new Map(types.map((type) => [String(type.id), type]));
  const pending = requests.filter((request) => request.status === 'PENDING');
  const yearRequests = useMemo(() => requests.filter((request) => overlapsYear(request, year)), [requests, year]);
  const otherTypes = types.filter((type) => type.active !== false && !balances.some((balance) => String(balance.leaveTypeId) === String(type.id)));

  if (!employeeId) {
    return <div className="hz-my-leave"><PageHeader eyebrow="My workspace" title="Leave" /><EmptyState icon={CalendarDays} title="No employee record" description="Your account is not linked to an employee record, so there is no leave to show." /></div>;
  }

  return (
    <div className="hz-my-leave">
      <PageHeader
        eyebrow="My workspace"
        title="Leave"
        description="Plan time away, track balances and see every request in one place"
        actions={(
          <select className="form-select hz-my-leave__year" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Leave year">
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((option) => (
              <option key={option} value={option}>{`Jan ${option} – Dec ${option}`}</option>
            ))}
          </select>
        )}
      />

      <section className="hz-my-leave__top" aria-labelledby="my-leave-pending">
        <div className="hz-my-leave__panel hz-my-leave__pending">
          <h2 id="my-leave-pending" className="hz-my-leave__section-title">Pending leave requests</h2>
          {requestsQuery.isLoading && <SkeletonText lines={2} />}
          {!requestsQuery.isLoading && pending.length === 0 && (
            <div className="hz-my-leave__all-clear">
              <span className="hz-my-leave__all-clear-icon" aria-hidden="true"><PartyPopper size={22} /></span>
              <div><strong>No pending leave requests</strong><p>Request leave whenever you need time away.</p></div>
            </div>
          )}
          {!requestsQuery.isLoading && pending.length > 0 && (
            <ul className="hz-my-leave__pending-list">
              {pending.map((request) => (
                <li key={request.id}>
                  <div>
                    <strong>{shortDate(request.startDate)}{request.endDate !== request.startDate ? ` – ${shortDate(request.endDate)}` : ''}</strong>
                    <span>{request.leaveTypeName} · {plural(request.days, 'day')}{request.pendingWith ? ` · waiting for ${request.pendingWith}` : ''}</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setCancelling(request)}>Cancel</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="hz-my-leave__panel hz-my-leave__actions">
          <Button icon={CalendarPlus} onClick={() => setShowApply(true)}>Request leave</Button>
          <button type="button" className="hz-my-leave__link" onClick={() => setShowCompOff(true)}><Gift size={15} aria-hidden="true" /> Request credit for comp-off</button>
          <button type="button" className="hz-my-leave__link" onClick={() => setShowPolicy(true)}><BookOpen size={15} aria-hidden="true" /> Leave policy explained</button>
        </div>
      </section>

      <section aria-labelledby="my-leave-stats">
        <h2 id="my-leave-stats" className="hz-my-leave__heading">My leave stats</h2>
        <LeaveStats requests={yearRequests} year={year} loading={requestsQuery.isLoading} />
      </section>

      <section aria-labelledby="my-leave-balances">
        <h2 id="my-leave-balances" className="hz-my-leave__heading">Leave balances</h2>
        {balancesQuery.isLoading && <div className="hz-my-leave__panel"><SkeletonText lines={4} /></div>}
        {!balancesQuery.isLoading && balances.length === 0 && <div className="hz-my-leave__panel"><EmptyState icon={CalendarDays} title="No leave types configured" description="Your balances appear here once HR sets up leave types." /></div>}
        {balances.length > 0 && (
          <div className="hz-my-leave__balances">
            {balances.map((balance, index) => <BalanceCard key={balance.leaveTypeId} balance={balance} type={typeById.get(String(balance.leaveTypeId))} color={categoricalColor(index)} />)}
          </div>
        )}
        {otherTypes.length > 0 && (
          <div className="hz-my-leave__panel hz-my-leave__other">
            <span>Other leave types available:</span>
            {otherTypes.map((type) => <Badge key={type.id} variant="neutral">{type.name}</Badge>)}
          </div>
        )}
      </section>

      <section aria-labelledby="my-leave-history" id="leave-history">
        <h2 id="my-leave-history" className="hz-my-leave__heading">Leave history</h2>
        <LeaveHistory requests={yearRequests} loading={requestsQuery.isLoading} onCancel={setCancelling} />
      </section>

      <section id="leave-balance-details" aria-label="Leave balance details">
        <LeaveSelfServicePanel employeeId={employeeId} />
      </section>

      {showApply && <ApplyLeaveModal defaultEmployeeId={employeeId} onClose={() => setShowApply(false)} />}
      {showCompOff && <CompOffDialog employeeId={employeeId} onClose={() => setShowCompOff(false)} />}
      <PolicyDialog open={showPolicy} onClose={() => setShowPolicy(false)} types={types.filter((type) => type.active !== false)} />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling.id)}
        loading={cancel.isPending}
        title="Cancel this leave request?"
        description={cancelling ? `${cancelling.leaveTypeName}, ${shortDate(cancelling.startDate)}${cancelling.endDate !== cancelling.startDate ? ` – ${shortDate(cancelling.endDate)}` : ''}. Any days already deducted go back to your balance.` : undefined}
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
      />
    </div>
  );
}

function LeaveStats({ requests, year, loading }) {
  const { weekly, monthly, byType } = useMemo(() => {
    const consumed = requests.filter((request) => request.status === 'APPROVED');
    const weeklyTotals = WEEKDAYS.map((name) => ({ name, days: 0 }));
    const monthlyTotals = MONTHS.map((name) => ({ name, days: 0 }));
    const typeTotals = new Map();
    consumed.forEach((request) => {
      daysInYear(request, year).forEach(({ date, weight }) => {
        weeklyTotals[(date.getDay() + 6) % 7].days += weight;
        monthlyTotals[date.getMonth()].days += weight;
        typeTotals.set(request.leaveTypeName, (typeTotals.get(request.leaveTypeName) || 0) + weight);
      });
    });
    const round = (rows) => rows.map((row) => ({ ...row, days: Number(row.days.toFixed(2)) }));
    return {
      weekly: round(weeklyTotals),
      monthly: round(monthlyTotals),
      byType: [...typeTotals.entries()].map(([name, days]) => ({ name, days: Number(days.toFixed(2)) })),
    };
  }, [requests, year]);
  const totalConsumed = byType.reduce((sum, row) => sum + row.days, 0);
  const tooltip = { contentStyle: { background: 'var(--hz-bg-surface)', border: '1px solid var(--hz-border)', borderRadius: 8, fontSize: 12, color: 'var(--hz-text-primary)' }, cursor: { fill: 'var(--hz-surface-muted)' }, formatter: (value) => [plural(value, 'day'), 'Leave'] };
  const axis = { tick: { fill: 'var(--hz-text-muted)', fontSize: 11 }, tickLine: false, axisLine: false };

  return (
    <div className="hz-my-leave__stats">
      <div className="hz-my-leave__panel hz-my-leave__stat">
        <h3>Weekly pattern</h3>
        <p className="hz-my-leave__stat-hint">Approved leave days by weekday</p>
        {loading ? <SkeletonText lines={3} /> : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={weekly} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" {...axis} />
              <Tooltip {...tooltip} />
              <Bar dataKey="days" fill="var(--hz-primary-500)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="hz-my-leave__panel hz-my-leave__stat">
        <h3>Consumed leave types</h3>
        <p className="hz-my-leave__stat-hint">{totalConsumed ? `${plural(totalConsumed, 'day')} taken in ${year}` : `No leave taken in ${year}`}</p>
        {loading ? <SkeletonText lines={3} /> : (
          <div className="hz-my-leave__donut">
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={byType.length ? byType : [{ name: 'None', days: 1 }]} dataKey="days" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={byType.length > 1 ? 2 : 0} stroke="none">
                  {(byType.length ? byType : [{ name: 'None' }]).map((row, index) => <Cell key={row.name} fill={byType.length ? categoricalColor(index) : 'var(--hz-border)'} />)}
                </Pie>
                {byType.length > 0 && <Tooltip {...tooltip} formatter={(value, name) => [plural(value, 'day'), name]} />}
              </PieChart>
            </ResponsiveContainer>
            <ul className="hz-my-leave__legend">
              {byType.map((row, index) => <li key={row.name}><i style={{ background: categoricalColor(index) }} />{row.name}<strong>{fmt(row.days)}</strong></li>)}
            </ul>
          </div>
        )}
      </div>
      <div className="hz-my-leave__panel hz-my-leave__stat hz-my-leave__stat--wide">
        <h3>Monthly stats</h3>
        <p className="hz-my-leave__stat-hint">Approved leave days per month, {year}</p>
        {loading ? <SkeletonText lines={3} /> : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={monthly} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" {...axis} />
              <Tooltip {...tooltip} />
              <Bar dataKey="days" fill="var(--hz-primary-500)" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BalanceCard({ balance, type, color }) {
  const available = Number(balance.remainingDays) || 0;
  const consumed = Number(balance.usedDays) || 0;
  const accrued = Number(balance.allocatedDays) || 0;
  const carried = Number(balance.carriedForwardDays) || 0;
  const quota = balance.accrualMode === 'COMP_OFF' ? null : (Number(balance.annualEntitlementDays) || accrued);
  const pool = available + consumed;
  const share = pool > 0 ? Math.max(0, Math.min(100, (available / pool) * 100)) : 0;
  return (
    <article className="hz-my-leave__panel hz-my-leave__balance">
      <header>
        <h3>{balance.leaveTypeName}</h3>
        {type?.paid === false && <Badge variant="neutral">Unpaid</Badge>}
        <a href="#leave-balance-details">View details</a>
      </header>
      <div className="hz-my-leave__ring" style={{ '--ring-color': color, '--ring-share': `${share}%` }} role="img" aria-label={`${plural(available, 'day')} available`}>
        <div><strong>{fmt(available)}</strong><span>{Number(available) === 1 ? 'Day' : 'Days'} available</span></div>
      </div>
      <dl className="hz-my-leave__figures">
        <div><dt>Available</dt><dd>{plural(available, 'day')}</dd></div>
        <div><dt>Consumed</dt><dd>{plural(consumed, 'day')}</dd></div>
        <div><dt>{accruedLabel(balance.accrualMode)}</dt><dd>{plural(accrued, 'day')}</dd></div>
        <div><dt>Annual quota</dt><dd>{quota === null ? '—' : plural(quota, 'day')}</dd></div>
        {carried > 0 && <div><dt>Carried forward</dt><dd>{plural(carried, 'day')}</dd></div>}
        {Number(balance.negativeAllowanceDays) > 0 && <div><dt>Can go below zero by</dt><dd>{plural(balance.negativeAllowanceDays, 'day')}</dd></div>}
      </dl>
    </article>
  );
}

function LeaveHistory({ requests, loading, onCancel }) {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [menuFor, setMenuFor] = useState(null);

  const typeNames = [...new Set(requests.map((request) => request.leaveTypeName))].sort();
  const needle = query.trim().toLowerCase();
  const rows = requests
    .filter((request) => !typeFilter || request.leaveTypeName === typeFilter)
    .filter((request) => !statusFilter || request.status === statusFilter)
    .filter((request) => !needle || [request.leaveTypeName, request.reason, request.decisionNote, request.decidedByName]
      .some((value) => String(value || '').toLowerCase().includes(needle)))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => { setPage(0); }, [typeFilter, statusFilter, query]);

  // Close the row menu on any click outside it, or on Escape.
  useEffect(() => {
    if (menuFor === null) return undefined;
    const onPointer = (event) => { if (!event.target.closest('.hz-my-leave__menu')) setMenuFor(null); };
    const onKey = (event) => { if (event.key === 'Escape') setMenuFor(null); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [menuFor]);

  return (
    <div className="hz-my-leave__panel hz-my-leave__history">
      <div className="hz-my-leave__filters">
        <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by leave type">
          <option value="">All leave types</option>
          {typeNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <label className="hz-my-leave__search">
          <Search size={15} aria-hidden="true" />
          <input type="search" placeholder="Search notes, type or approver" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search leave history" />
        </label>
        <span className="hz-my-leave__total">Total: {rows.length}</span>
      </div>

      {loading && <div className="p-3"><SkeletonText lines={4} /></div>}
      {!loading && rows.length === 0 && <EmptyState icon={CalendarDays} title={requests.length ? 'No requests match these filters' : 'No leave requests this year'} description={requests.length ? 'Try a different leave type, status or search.' : 'Requests you make appear here.'} />}
      {!loading && rows.length > 0 && (
        <div className="hz-my-leave__table-wrap">
          <table className="hz-my-leave__table" aria-label="Leave history">
            <thead>
              <tr><th>Leave dates</th><th>Leave type</th><th>Status</th><th>Action taken on</th><th>Leave note</th><th>Reject / cancel reason</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {shown.map((request) => {
                const meta = leaveStatusMeta(request.status);
                const closed = request.status === 'REJECTED' || request.status === 'CANCELLED';
                return (
                  <tr key={request.id}>
                    <td>
                      <strong>{shortDate(request.startDate)}{request.endDate !== request.startDate ? ` – ${shortDate(request.endDate)}` : ''}</strong>
                      <small>{request.halfDay ? `Half day${request.halfDaySession ? ` (${request.halfDaySession === 'FIRST_HALF' ? 'first half' : 'second half'})` : ''}` : plural(request.days, 'day')}</small>
                    </td>
                    <td>
                      <strong>{request.leaveTypeName}</strong>
                      {request.requestedAt && <small>Requested on {shortDate(request.requestedAt)}</small>}
                    </td>
                    <td>
                      <Badge variant={meta.variant} dot>{meta.label}</Badge>
                      {request.decidedByName && request.status !== 'PENDING' && <small>by {request.decidedByName}</small>}
                      {request.status === 'PENDING' && request.pendingWith && <small>with {request.pendingWith}</small>}
                    </td>
                    <td>{request.decidedAt ? formatDateIST(request.decidedAt) : '—'}</td>
                    <td className="hz-my-leave__note">{request.reason || '—'}</td>
                    <td className="hz-my-leave__note">{closed && request.decisionNote ? request.decisionNote : '—'}</td>
                    <td className="hz-my-leave__row-actions">
                      {canCancel(request) && (
                        <div className="hz-my-leave__menu">
                          <button type="button" className="hz-my-leave__menu-button" aria-label={`Actions for ${request.leaveTypeName} on ${shortDate(request.startDate)}`} aria-expanded={menuFor === request.id} onClick={() => setMenuFor(menuFor === request.id ? null : request.id)}>
                            <MoreHorizontal size={16} />
                          </button>
                          {menuFor === request.id && (
                            <div className="hz-my-leave__menu-list" role="menu">
                              <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onCancel(request); }}>Cancel request</button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length > PAGE_SIZE && (
        <div className="hz-my-leave__pager">
          <span>{current * PAGE_SIZE + 1} to {Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}</span>
          <Button size="sm" variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
          <span>Page {current + 1} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

const MODE_TEXT = {
  YEARLY_UPFRONT: (days) => `${plural(days, 'day')} credited at the start of the year.`,
  MONTHLY: (days) => `${plural(days, 'day')} a year, building up every month (${fmt(days / 12)} per month).`,
  QUARTERLY: (days) => `${plural(days, 'day')} a year, credited every quarter (${fmt(days / 4)} per quarter).`,
  COMP_OFF: () => 'Credited when an approved comp-off claim is recorded for working on a weekly off or holiday.',
};

/** Plain-language summary of each leave type's rules, from the policy HR configured. */
export function policyLines(type) {
  const policy = type.policy || {};
  const lines = [];
  const mode = policy.accrualMode || 'YEARLY_UPFRONT';
  lines.push((MODE_TEXT[mode] || MODE_TEXT.YEARLY_UPFRONT)(Number(type.defaultDaysPerYear) || 0));
  if (mode === 'YEARLY_UPFRONT' && policy.prorateOnJoining) lines.push('If you join mid-year you get a share for the months left.');
  if (policy.probationDays) lines.push(`Can be used after ${plural(policy.probationDays, 'day')} of service.`);
  if (type.carryForward) {
    const cap = policy.maxCarryForwardDays ? `up to ${plural(policy.maxCarryForwardDays, 'day')}` : 'unused days';
    const expiry = policy.carryForwardExpiryMonths ? `, which expire after ${plural(policy.carryForwardExpiryMonths, 'month')}` : '';
    lines.push(`Carries forward ${cap} to next year${expiry}.`);
  } else if (mode !== 'COMP_OFF') {
    lines.push('Unused days do not carry forward to next year.');
  }
  if (policy.maxBalanceDays) lines.push(`Balance is capped at ${plural(policy.maxBalanceDays, 'day')}.`);
  if (policy.negativeBalanceDays) lines.push(`You may go up to ${plural(policy.negativeBalanceDays, 'day')} below zero.`);
  if (policy.creditExpiryDays) lines.push(`Credits expire ${plural(policy.creditExpiryDays, 'day')} after they are given.`);
  if (policy.encashable) lines.push(`Can be encashed${policy.maxEncashableDaysPerYear ? ` (up to ${plural(policy.maxEncashableDaysPerYear, 'day')} a year)` : ''}.`);
  if (policy.sandwichRule) lines.push('Weekends and holidays between two leave days are counted as leave.');
  if (type.autoApprove) lines.push('Approved automatically.');
  if (type.paid === false) lines.push('Unpaid: these days are deducted from salary.');
  return lines;
}

function PolicyDialog({ open, onClose, types }) {
  return (
    <Dialog open={open} onClose={onClose} title="Leave policy explained" description="How each leave type works in your company" size="lg" footer={<Button onClick={onClose}>Done</Button>}>
      {types.length === 0 ? <EmptyState icon={BookOpen} title="No leave types configured" /> : (
        <div className="hz-my-leave__policy">
          {types.map((type) => (
            <section key={type.id}>
              <h3>{type.name}</h3>
              <ul>{policyLines(type).map((line) => <li key={line}>{line}</li>)}</ul>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
