import { useState } from 'react';
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
  const totalAvailable = balances.reduce((total, balance) => total + (Number(balance.remainingDays) || 0), 0);
  const pendingByType = requests.reduce((accumulator, request) => {
    if (!request || request.status !== 'PENDING') return accumulator;
    const leaveTypeName = request.leaveTypeName || 'Leave';
    accumulator[leaveTypeName] = (accumulator[leaveTypeName] || 0) + (Number(request.days) || 0);
    return accumulator;
  }, {});

  return (
    <section className="hz-dashboard__surface hz-leave-widget" aria-labelledby="leave-widget-title">
      <div className="hz-leave-widget__header">
        <div><span className="hz-dashboard__section-kicker">{year} balance</span><h2 id="leave-widget-title">Leave Balance</h2></div>
        <CalendarOff size={19} aria-hidden="true" />
      </div>

      <div className="hz-leave-widget__layout">
        <div className="hz-leave-widget__balance-pane">
          {loading ? (
            <div className="hz-leave-widget__hero hz-leave-widget__hero--skeleton" aria-label="Loading leave balances">
              <div className="hz-leave-widget__meta">
                <span className="hz-leave-widget__eyebrow">Total available</span>
                <div className="hz-leave-widget__total"><Skeleton height={58} width={160} /></div>
                <Skeleton height={18} width="68%" />
                <div className="hz-leave-widget__actions">
                  <Skeleton height={38} width={124} />
                  <Skeleton height={38} width={126} />
                </div>
              </div>
              <div className="hz-leave-widget__capsule-row hz-leave-widget__capsule-row--skeleton">
                {[1, 2, 3, 4].map((item) => (
                  <div className="hz-leave-capsule hz-leave-capsule--skeleton" key={item}>
                    <Skeleton height={16} width={42} />
                    <Skeleton className="hz-leave-capsule__tube-skeleton" height={140} width={30} />
                    <Skeleton height={16} width={54} />
                  </div>
                ))}
              </div>
            </div>
          ) : balances.length ? (
            <div className="hz-leave-widget__hero">
              <div className="hz-leave-widget__meta">
                <span className="hz-leave-widget__eyebrow">Total available</span>
                <div className="hz-leave-widget__total">
                  <strong>{formatLeaveNumber(totalAvailable)}</strong>
                  <span>days</span>
                </div>
                <p>{`Across ${balances.length} leave type${balances.length === 1 ? '' : 's'}`}</p>
                <div className="hz-leave-widget__actions">
                  <Link to="/leave" className="hz-leave-widget__action hz-leave-widget__action--primary">Apply Leave</Link>
                  <Link to="/my-profile?tab=leave" className="hz-leave-widget__action hz-leave-widget__action--secondary">View History</Link>
                </div>
              </div>

              <div className="hz-leave-widget__capsule-row" aria-label="Leave balances by type">
                {balances.map((balance, index) => (
                  <LeaveCapsule
                    key={balance.leaveTypeId || `${balance.leaveTypeName}-${index}`}
                    balance={balance}
                    index={index}
                    pendingDays={pendingByType[balance.leaveTypeName] || 0}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="hz-leave-widget__empty-state">
              <EmptyState icon={CalendarOff} title="No leave balances available." description="Your leave balances will appear here once your organization configures them." />
            </div>
          )}

          <div className="hz-leave-widget__footer">
            <span>{upcoming ? `Next leave: ${upcoming.leaveTypeName} · ${new Date(upcoming.startDate).toLocaleDateString()}` : 'Plan time away with confidence.'}</span>
            <Link to="/my-profile?tab=leave" className="hz-dashboard__text-link">Manage leave <ArrowRight size={15} /></Link>
          </div>
        </div>

        <div className="hz-leave-widget__holidays" aria-labelledby="upcoming-holidays-title">
          <div className="hz-leave-widget__holidays-heading">
            <div><span className="hz-dashboard__section-kicker">Company calendar</span><h3 id="upcoming-holidays-title">Upcoming Public Holidays</h3></div>
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          {holidaysLoading ? <div className="hz-leave-widget__holiday-list" aria-label="Loading upcoming holidays">{[1, 2, 3].map((item) => <div className="hz-leave-widget__holiday-skeleton" key={item}><Skeleton height={13} width="42%" /><Skeleton height={13} width="24%" /><Skeleton height={13} width="20%" /></div>)}</div> : holidaysError ? <p className="hz-leave-widget__message">Unable to load upcoming holidays.</p> : upcomingHolidays.length ? <div className="hz-leave-widget__holiday-list">{upcomingHolidays.map((holiday) => <div className="hz-leave-widget__holiday-row" key={holiday.id || `${holiday.name}-${holiday.date}`}><strong>{holiday.name}</strong><span>{holiday.type || holiday.holidayType || 'Company holiday'}</span><time dateTime={holiday.date}>{formatHolidayDate(holiday.date)}</time></div>)}</div> : <p className="hz-leave-widget__message">No upcoming holidays.</p>}
        </div>
      </div>
    </section>
  );
}

function LeaveCapsule({ balance, index, pendingDays }) {
  const available = Number(balance.remainingDays) || 0;
  const used = Number(balance.usedDays) || 0;
  const total = (Number(balance.allocatedDays) || 0) + (Number(balance.carriedForwardDays) || 0);
  const percentage = total > 0 ? Math.min(100, Math.max(0, (available / total) * 100)) : 0;
  const accent = LEAVE_TYPE_COLORS[index % LEAVE_TYPE_COLORS.length];
  const [showTooltip, setShowTooltip] = useState(false);
  const code = getLeaveCode(balance.leaveTypeName);
  const accessibleLabel = `${balance.leaveTypeName}: ${formatLeaveNumber(available)} days available, ${formatLeaveNumber(used)} used, ${formatLeaveNumber(pendingDays)} pending, ${formatLeaveNumber(total)} total.`;

  return (
    <div
      className="hz-leave-capsule"
      tabIndex={0}
      role="listitem"
      aria-label={accessibleLabel}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      onClick={() => setShowTooltip((previous) => !previous)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setShowTooltip((previous) => !previous);
        }
      }}
    >
      <div className="hz-leave-capsule__value">{formatLeaveNumber(available)}</div>
      <div className="hz-leave-capsule__tube" aria-hidden="true">
        <div
          className="hz-leave-capsule__fill"
          style={{
            '--hz-leave-fill-height': `${percentage}%`,
            '--hz-leave-fill-color': accent,
          }}
        />
      </div>
      <div className="hz-leave-capsule__meta">
        <span>{code}</span>
        <small>{balance.leaveTypeName}</small>
      </div>
      {showTooltip && (
        <div className="hz-leave-capsule__tooltip" role="tooltip">
          <strong>{balance.leaveTypeName}</strong>
          <ul>
            <li><span>Available</span><strong>{formatLeaveNumber(available)} days</strong></li>
            <li><span>Used</span><strong>{formatLeaveNumber(used)} days</strong></li>
            <li><span>Pending</span><strong>{formatLeaveNumber(pendingDays)} days</strong></li>
            <li><span>Total</span><strong>{formatLeaveNumber(total)} days</strong></li>
          </ul>
        </div>
      )}
    </div>
  );
}

const LEAVE_TYPE_COLORS = ['#2563EB', '#F97316', '#10B981', '#FBBF24', '#8B5CF6', '#14B8A6'];

function getLeaveCode(name = '') {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return 'LV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function formatLeaveNumber(value) {
  const number = Number(value) || 0;
  if (Number.isInteger(number)) return String(number);
  return String(Number(number.toFixed(2)).toString());
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
