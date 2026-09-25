import { CalendarOff, Clock3, WalletCards, ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../../../components/ui/EmptyState';
import Skeleton, { SkeletonText } from '../../../components/ui/Skeleton';
import { formatCurrency } from '../../../utils/formatCurrency';
import { formatTimeIST, toISTDateInputValue } from '../../../utils/formatDateTime';

export function EmployeeMetric({ icon: Icon, label, value, detail, tone }) {
  return <article className={`hz-dashboard__employee-metric hz-dashboard__employee-metric--${tone}`}><span className="hz-dashboard__employee-metric-icon"><Icon size={18} /></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

export function AttendanceWidget({ records, loading }) {
  const todayKey = toISTDateInputValue(new Date());
  const todayRecords = records.filter((record) => record.punchTime?.slice(0, 10) === todayKey);
  const checkIn = todayRecords.find((record) => record.punchType === 'IN');
  const checkOut = todayRecords.find((record) => record.punchType === 'OUT');
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = toISTDateInputValue(date);
    const label = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(date).slice(0, 2);
    return { label, active: records.some((record) => toISTDateInputValue(record.punchTime) === key) };
  });

  return (
    <section className="hz-dashboard__surface hz-attendance-widget" aria-labelledby="attendance-widget-title">
      <div className="hz-dashboard__section-heading"><div><span className="hz-dashboard__section-kicker">Today</span><h2 id="attendance-widget-title">Attendance</h2></div><Clock3 size={19} aria-hidden="true" /></div>
      {loading ? <SkeletonText lines={4} /> : <>
        <div className="hz-attendance-widget__summary">
          <div><strong>{checkIn ? formatTimeIST(checkIn.punchTime) : '--:--'}</strong><span>Check-in</span></div>
          <div><strong>{checkOut ? formatTimeIST(checkOut.punchTime) : 'Working'}</strong><span>{checkOut ? 'Check-out' : 'Current status'}</span></div>
        </div>
        <div className="hz-attendance-widget__week" aria-label="Attendance for the last seven days">
          {days.map((day) => <span key={`${day.label}-${day.active}`} className={day.active ? 'is-present' : ''}><i />{day.label}</span>)}
        </div>
      </>}
      <Link to="/my-profile?tab=attendance" className="hz-dashboard__text-link">View attendance <ArrowRight size={15} /></Link>
    </section>
  );
}

export function LeaveWidget({ balances, requests, loading, year, holidays = [], holidaysLoading, holidaysError }) {
  const upcoming = requests.filter((request) => request.startDate >= new Date().toISOString().slice(0, 10)).sort((first, second) => first.startDate.localeCompare(second.startDate))[0];
  const upcomingHolidays = holidays
    .filter((holiday) => typeof holiday.date === 'string' && holiday.date >= new Date().toISOString().slice(0, 10))
    .sort((first, second) => first.date.localeCompare(second.date));
  return (
    <section className="hz-dashboard__surface hz-leave-widget" aria-labelledby="leave-widget-title">
      <div className="hz-leave-widget__header"><div><span className="hz-dashboard__section-kicker">{year} balance</span><h2 id="leave-widget-title">Leave Balance</h2></div><CalendarOff size={19} aria-hidden="true" /></div>
      <div className="hz-leave-widget__layout">
        <div className="hz-leave-widget__balance-pane">
          {loading ? <div className="hz-leave-widget__ring-grid" aria-label="Loading leave balances">{[1, 2, 3, 4].map((item) => <div className="hz-leave-ring-card" key={item}><Skeleton className="hz-leave-ring-skeleton" width={132} height={132} radius="50%" /><Skeleton height={14} width="72%" /></div>)}</div> : balances.length ? <div className="hz-leave-widget__ring-grid">{balances.map((balance, index) => <LeaveRing balance={balance} index={index} key={balance.leaveTypeId} />)}</div> : <EmptyState icon={CalendarOff} title="No leave balances available." />}
          <div className="hz-leave-widget__footer"><span>{upcoming ? `Next leave: ${upcoming.leaveTypeName} · ${new Date(upcoming.startDate).toLocaleDateString()}` : 'Plan time away with confidence.'}</span><Link to="/my-profile?tab=leave" className="hz-dashboard__text-link">Manage leave <ArrowRight size={15} /></Link></div>
        </div>
        <div className="hz-leave-widget__holidays" aria-labelledby="upcoming-holidays-title">
          <div className="hz-leave-widget__holidays-heading"><div><span className="hz-dashboard__section-kicker">Company calendar</span><h3 id="upcoming-holidays-title">Upcoming Public Holidays</h3></div><CalendarDays size={18} aria-hidden="true" /></div>
          {holidaysLoading ? <div className="hz-leave-widget__holiday-list" aria-label="Loading upcoming holidays">{[1, 2, 3].map((item) => <div className="hz-leave-widget__holiday-skeleton" key={item}><Skeleton height={13} width="42%" /><Skeleton height={13} width="24%" /><Skeleton height={13} width="20%" /></div>)}</div> : holidaysError ? <p className="hz-leave-widget__message">Unable to load upcoming holidays.</p> : upcomingHolidays.length ? <div className="hz-leave-widget__holiday-list">{upcomingHolidays.map((holiday) => <div className="hz-leave-widget__holiday-row" key={holiday.id || `${holiday.name}-${holiday.date}`}><strong>{holiday.name}</strong><span>{holiday.type || holiday.holidayType || 'Company holiday'}</span><time dateTime={holiday.date}>{formatHolidayDate(holiday.date)}</time></div>)}</div> : <p className="hz-leave-widget__message">No upcoming holidays.</p>}
        </div>
      </div>
    </section>
  );
}

function LeaveRing({ balance, index }) {
  const available = Number(balance.remainingDays) || 0;
  const allocation = Number(balance.allocatedDays) + (Number(balance.carriedForwardDays) || 0);
  const progress = allocation > 0 ? Math.min(100, Math.max(0, (available / allocation) * 100)) : 0;
  const radius = 55;
  const colors = ['var(--hz-primary-600)', 'var(--hz-brand-indigo-500)', 'var(--hz-accent-500)', 'var(--hz-primary-700)'];
  const accessibleLabel = `${balance.leaveTypeName}: ${formatDays(available)} days available out of ${formatDays(allocation)} days.`;
  return <Link to="/my-profile?tab=leave" className="hz-leave-ring-card" aria-label={accessibleLabel} style={{ '--hz-ring-color': colors[index % colors.length] }}>
    <div className="hz-leave-ring" role="img" aria-label={accessibleLabel}>
      <svg viewBox="0 0 132 132" aria-hidden="true"><circle className="hz-leave-ring__track" cx="66" cy="66" r={radius} /><circle className="hz-leave-ring__progress" cx="66" cy="66" r={radius} pathLength="100" style={{ '--hz-ring-progress': progress }} /></svg>
      <span className="hz-leave-ring__content"><small>Available</small><strong>{formatDays(available)}<em> / {formatDays(allocation)}</em></strong></span>
    </div>
    <strong className="hz-leave-ring-card__label">{balance.leaveTypeName}</strong>
  </Link>;
}

function formatDays(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatHolidayDate(date) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', weekday: 'short' }).format(new Date(`${date}T00:00:00`));
}

export function FinanceWidget({ salary }) {
  const structure = salary?.currentStructure;
  const latestPayslip = salary?.payrollHistory?.[0];
  return (
    <section className="hz-dashboard__surface hz-finance-widget" aria-labelledby="finance-widget-title">
      <div className="hz-dashboard__section-heading"><div><span className="hz-dashboard__section-kicker">My finances</span><h2 id="finance-widget-title">Latest pay</h2></div><WalletCards size={19} aria-hidden="true" /></div>
      <span className="hz-finance-widget__label">Net pay</span>
      <strong className="hz-finance-widget__amount">{structure ? formatCurrency(structure.netSalary) : '--'}</strong>
      <div className="hz-finance-widget__details"><span>Earnings <strong>{structure ? formatCurrency(structure.grossSalary) : '--'}</strong></span><span>Deductions <strong>{structure ? formatCurrency(structure.totalDeductions) : '--'}</strong></span></div>
      <p>{latestPayslip ? `Latest payslip · ${latestPayslip.paymentDate ? new Date(latestPayslip.paymentDate).toLocaleDateString() : 'Pending payment'}` : 'Your latest payslip will appear here.'}</p>
      <Link to="/my-payslip" className="hz-dashboard__text-link">View payslip <ArrowRight size={15} /></Link>
    </section>
  );
}
