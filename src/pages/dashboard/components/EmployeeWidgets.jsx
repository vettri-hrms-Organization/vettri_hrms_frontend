import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, CalendarDays, CalendarOff, ClipboardCheck, Clock3, LifeBuoy, UserRound, WalletCards,
} from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import { Skeleton, SkeletonText } from '../../../components/ui/Skeleton';
import { formatCurrency } from '../../../utils/formatCurrency';
import { toISTDateInputValue } from '../../../utils/formatDateTime';
import { addDays } from '../../attendance/shiftUtils';

/*
 * Pieces of the employee home, laid out like a calm Keka-style landing page: a greeting with
 * today's shift and check-in state, one row of key cards (leave, this week, payslip, approvals)
 * and plain panels for holidays and shortcuts. They only present data the page already loads;
 * checking in and applying for leave stay on My Attendance / My Leave, which these link to.
 */

const STATUS_LABEL = { PRESENT: 'Present', HALF_DAY: 'Half day', ABSENT: 'Absent', WEEK_OFF: 'Weekly off', HOLIDAY: 'Holiday', LEAVE: 'On leave' };

/** Approval queues the home to-do feed reports; the same ones the Approvals inbox (and its menu entry) covers. */
const APPROVAL_TODO_KEYS = ['leave', 'timesheets', 'expenses', 'travel', 'profile', 'resignations', 'loans', 'fbp'];

export function formatLeaveNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
}

const plural = (n, word) => `${formatLeaveNumber(n)} ${word}${Number(n) === 1 ? '' : 's'}`;

function minutesLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

/** "10:00" / "10:00:00" shift times as "10:00 AM". */
function shiftTimeLabel(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** yyyy-mm-dd as a calendar date (no timezone shift). */
function dayLabel(iso, options) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', { timeZone: 'UTC', ...options });
}

const workedDay = (day) => day.status === 'PRESENT' || day.status === 'HALF_DAY' || day.workedMinutes > 0;

function CardLink({ to, children, primary = false }) {
  return (
    <Link to={to} className={`hz-emp-home__link${primary ? ' hz-emp-home__link--primary' : ''}`}>
      {children} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

function CardEmpty({ title, description }) {
  return (
    <div className="hz-emp-home__empty">
      <strong>{title}</strong>
      {description && <small>{description}</small>}
    </div>
  );
}

/** One compact card in the key row: small uppercase label, a big figure, a line or two and its links. */
function KeyCard({ id, label, icon: Icon, loading, links, children }) {
  return (
    <section className="hz-emp-home__card" aria-labelledby={id} aria-busy={loading || undefined}>
      <header className="hz-emp-home__card-head">
        <h2 id={id} className="hz-emp-home__label">{label}</h2>
        <Icon size={17} aria-hidden="true" />
      </header>
      <div className="hz-emp-home__card-body">{loading ? <SkeletonText lines={3} /> : children}</div>
      {links && <div className="hz-emp-home__card-links">{links}</div>}
    </section>
  );
}

// ------------------------------------------------------------------ greeting + today

/** What today's attendance looks like, as one short status and a tone for the dot. */
function todayStatus({ hasCheckedIn, hasCheckedOut, shiftToday }) {
  if (hasCheckedOut) return { label: 'Checked out', tone: 'done' };
  if (hasCheckedIn) return { label: 'Checked in', tone: 'in' };
  if (shiftToday?.weekOff) return { label: 'Weekly off', tone: 'off' };
  if (shiftToday?.holiday) return { label: 'Holiday', tone: 'off' };
  if (shiftToday?.leave) return { label: 'On leave', tone: 'off' };
  return { label: 'Not checked in', tone: 'pending' };
}

function shiftLine(shiftToday) {
  if (!shiftToday) return 'No shift assigned for today';
  if (shiftToday.weekOff) return 'Today is a weekly off';
  if (shiftToday.holiday) return 'Today is a holiday';
  if (shiftToday.leave) return `On leave today (${shiftToday.leave})`;
  if (!shiftToday.shiftStart) return 'No shift assigned for today';
  return `${shiftToday.shiftName || 'Shift'} · ${shiftTimeLabel(shiftToday.shiftStart)} – ${shiftTimeLabel(shiftToday.shiftEnd)}`;
}

/**
 * Greeting, who you are, and today's shift with a clear check-in state. The action only links to
 * My Attendance: location, selfie and policy checks live there.
 */
export function EmployeeGreeting({
  greeting, today, employee, firstName,
  hasCheckedIn, hasCheckedOut, attendanceDetail, attendanceLoading,
  shiftToday, shiftLoading, shiftAvailable = true,
}) {
  const status = todayStatus({ hasCheckedIn, hasCheckedOut, shiftToday });
  const role = [employee?.designationTitle, employee?.departmentName].filter(Boolean).join(' · ');
  const workingDay = !shiftToday?.weekOff && !shiftToday?.holiday && !shiftToday?.leave;

  return (
    <header className="hz-emp-home__greeting">
      <div className="hz-emp-home__hello">
        <Avatar name={employee?.fullName || firstName || 'Employee'} src={employee?.profilePhotoUrl} size="lg" />
        <div>
          <p className="hz-emp-home__date">{today}</p>
          <h1>{greeting}</h1>
          <p className="hz-emp-home__role">
            {role && <span>{role}</span>}
            <Link to="/my-profile" className="hz-emp-home__link">View profile <ArrowRight size={14} aria-hidden="true" /></Link>
          </p>
        </div>
      </div>

      <section className="hz-emp-home__today" aria-labelledby="emp-home-today-title">
        <h2 id="emp-home-today-title" className="hz-emp-home__label">Today</h2>
        {attendanceLoading ? (
          <Skeleton height={22} width={150} />
        ) : (
          <p className={`hz-emp-home__status is-${status.tone}`}>
            <i aria-hidden="true" />
            <strong>{status.label}</strong>
          </p>
        )}
        {!attendanceLoading && attendanceDetail && <p className="hz-emp-home__today-detail">{attendanceDetail}</p>}
        {shiftAvailable && (
          shiftLoading ? <Skeleton height={14} width="70%" /> : (
            <p className="hz-emp-home__shift"><Clock3 size={14} aria-hidden="true" /> {shiftLine(shiftToday)}</p>
          )
        )}
        {!attendanceLoading && (
          hasCheckedOut ? (
            <CardLink to="/my-attendance">View attendance</CardLink>
          ) : hasCheckedIn ? (
            <Link to="/my-attendance" className="btn btn-outline-secondary btn-sm hz-emp-home__cta">Check out on My Attendance</Link>
          ) : workingDay ? (
            <Link to="/my-attendance" className="btn btn-primary btn-sm hz-emp-home__cta">Check in on My Attendance</Link>
          ) : (
            <CardLink to="/my-attendance">View attendance</CardLink>
          )
        )}
      </section>
    </header>
  );
}

// ------------------------------------------------------------------ key cards

/** Total days available, the per-type breakdown (available, pending, total) and your next leave. */
export function LeaveCard({ balances, requests, loading, year }) {
  const todayKey = toISTDateInputValue();
  const totalAvailable = balances.reduce((total, balance) => total + (Number(balance.remainingDays) || 0), 0);
  const pendingByType = requests.reduce((byType, request) => {
    if (request?.status !== 'PENDING') return byType;
    const name = request.leaveTypeName || 'Leave';
    byType[name] = (byType[name] || 0) + (Number(request.days) || 0);
    return byType;
  }, {});
  const nextLeave = requests
    .filter((request) => (request.status === 'APPROVED' || request.status === 'PENDING') && typeof request.startDate === 'string' && request.startDate >= todayKey)
    .sort((first, second) => first.startDate.localeCompare(second.startDate))[0];
  const shown = balances.slice(0, 4);

  return (
    <KeyCard
      id="emp-home-leave-title"
      label={`Leave available · ${year}`}
      icon={CalendarOff}
      loading={loading}
      links={<><CardLink to="/my-leave?apply=leave" primary>Request leave</CardLink><CardLink to="/my-leave">View all</CardLink></>}
    >
      {balances.length === 0 ? (
        <CardEmpty title="No leave balances yet" description="They appear once HR sets up your leave types." />
      ) : (
        <>
          <p className="hz-emp-home__figure">{formatLeaveNumber(totalAvailable)}<span>{Number(totalAvailable) === 1 ? 'day' : 'days'}</span></p>
          <ul className="hz-emp-home__types" aria-label="Leave balances by type">
            {shown.map((balance, index) => {
              const total = (Number(balance.allocatedDays) || 0) + (Number(balance.carriedForwardDays) || 0);
              const pending = pendingByType[balance.leaveTypeName] || 0;
              return (
                <li key={balance.leaveTypeId || `${balance.leaveTypeName}-${index}`}>
                  <span>{balance.leaveTypeName}</span>
                  <strong>
                    {formatLeaveNumber(balance.remainingDays)}
                    {total > 0 && <small> / {formatLeaveNumber(total)}</small>}
                  </strong>
                  {pending > 0 && <em>{formatLeaveNumber(pending)} pending</em>}
                </li>
              );
            })}
          </ul>
          {balances.length > shown.length && <p className="hz-emp-home__note">+{plural(balances.length - shown.length, 'more type')}</p>}
        </>
      )}
      {nextLeave && (
        <p className="hz-emp-home__note">
          Next leave: {nextLeave.leaveTypeName} · {dayLabel(nextLeave.startDate.slice(0, 10), { day: 'numeric', month: 'short' })}
          {nextLeave.status === 'PENDING' ? ' (pending)' : ''}
        </p>
      )}
    </KeyCard>
  );
}

/** Monday-to-Sunday strip plus hours worked, days present and late arrivals from the shift-aware daily attendance. */
export function WeekCard({ days, loading, unavailable, monday, today }) {
  const byDate = new Map((days || []).map((day) => [String(day.date).slice(0, 10), day]));
  const worked = (days || []).filter(workedDay);
  const totalWorked = worked.reduce((sum, day) => sum + (day.workedMinutes || 0), 0);
  const late = worked.filter((day) => day.late).length;

  return (
    <KeyCard
      id="emp-home-week-title"
      label="This week"
      icon={Clock3}
      loading={loading}
      links={<CardLink to="/my-attendance">View attendance</CardLink>}
    >
      {unavailable ? (
        <CardEmpty title="Attendance isn't available" description="Your account doesn't track attendance here." />
      ) : (
        <>
          <p className="hz-emp-home__figure">{minutesLabel(totalWorked)}<span>worked</span></p>
          <ol className="hz-emp-home__week" aria-label="Attendance this week">
            {Array.from({ length: 7 }, (_, index) => {
              const iso = addDays(monday, index);
              const day = byDate.get(iso);
              const state = iso > today ? 'future' : !day ? 'none' : day.weekOff || day.holiday ? 'off' : day.leave ? 'leave' : workedDay(day) ? (day.late ? 'late' : 'ok') : 'absent';
              const title = `${dayLabel(iso, { weekday: 'long', day: 'numeric', month: 'short' })}${day ? ` · ${STATUS_LABEL[day.status] || day.status}` : ''}`;
              return (
                <li key={iso} className={`is-${state}${iso === today ? ' is-today' : ''}`} title={title}>
                  <span aria-hidden="true">{dayLabel(iso, { weekday: 'narrow' })}</span>
                  <span className="visually-hidden">{title}</span>
                </li>
              );
            })}
          </ol>
          <p className="hz-emp-home__note">
            {worked.length === 0 ? 'No attendance recorded this week yet' : `${plural(worked.length, 'day')} present · ${late} late`}
          </p>
        </>
      )}
    </KeyCard>
  );
}

/** Latest payslip when payroll has run; otherwise the monthly figures from the current salary structure. */
export function PayslipCard({ salary, loading }) {
  const structure = salary?.currentStructure;
  const latest = salary?.payrollHistory?.[0];

  return (
    <KeyCard
      id="emp-home-pay-title"
      label="Latest payslip"
      icon={WalletCards}
      loading={loading}
      links={<CardLink to="/my-payslip">View payslips</CardLink>}
    >
      {latest ? (
        <>
          <p className="hz-emp-home__figure hz-emp-home__figure--money">{formatCurrency(latest.netSalary)}</p>
          <p className="hz-emp-home__note">
            Net pay{latest.periodLabel ? ` · ${latest.periodLabel}` : ''}
          </p>
          <p className="hz-emp-home__note">
            {latest.paymentDate ? `Paid ${new Date(latest.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Payment pending'}
          </p>
        </>
      ) : structure ? (
        <>
          <p className="hz-emp-home__figure hz-emp-home__figure--money">{formatCurrency(structure.netSalary)}</p>
          <p className="hz-emp-home__note">Monthly net salary · no payslips yet</p>
          <p className="hz-emp-home__note">Earnings {formatCurrency(structure.grossSalary)} · Deductions {formatCurrency(structure.totalDeductions)}</p>
        </>
      ) : (
        <CardEmpty title="No pay details yet" description="Your payslips appear here once HR runs payroll. Contact HR for details." />
      )}
    </KeyCard>
  );
}

/** Requests waiting for this person's decision, counted from the home to-do feed. */
export function ApprovalsCard({ todos, loading, error }) {
  const queues = (todos || []).filter((todo) => APPROVAL_TODO_KEYS.includes(todo.key) && todo.count > 0);
  const total = queues.reduce((sum, todo) => sum + todo.count, 0);

  return (
    <KeyCard
      id="emp-home-approvals-title"
      label="Pending approvals"
      icon={ClipboardCheck}
      loading={loading}
      links={<CardLink to="/approvals">Open approvals</CardLink>}
    >
      {error ? (
        <CardEmpty title="Couldn't load approvals" description="Open the approvals inbox to see what's waiting." />
      ) : total === 0 ? (
        <CardEmpty title="You're all caught up" description="Requests from your team will show here." />
      ) : (
        <>
          <p className="hz-emp-home__figure">{total}<span>waiting</span></p>
          <ul className="hz-emp-home__types">
            {queues.slice(0, 3).map((todo) => (
              <li key={todo.key}><span>{todo.title}</span><strong>{todo.count}</strong></li>
            ))}
          </ul>
        </>
      )}
    </KeyCard>
  );
}

// ------------------------------------------------------------------ panels

/** The next few company holidays, from the holiday calendar. */
export function HolidaysPanel({ holidays, loading, error, today }) {
  const upcoming = holidays
    .filter((holiday) => typeof holiday.date === 'string' && holiday.date >= today)
    .sort((first, second) => first.date.localeCompare(second.date));

  return (
    <section className="hz-emp-home__panel" aria-labelledby="emp-home-holidays-title">
      <div className="hz-emp-home__panel-head">
        <h2 id="emp-home-holidays-title">Upcoming holidays</h2>
        <CardLink to="/my-holidays">Holiday calendar</CardLink>
      </div>
      {loading ? <SkeletonText lines={3} /> : error ? (
        <CardEmpty title="Holidays couldn't load" description="Refresh the page to try again." />
      ) : upcoming.length === 0 ? (
        <CardEmpty title="No upcoming holidays" description="Holidays added to the company calendar appear here." />
      ) : (
        <ul className="hz-emp-home__holidays">
          {upcoming.slice(0, 4).map((holiday) => (
            <li key={holiday.id || `${holiday.name}-${holiday.date}`}>
              <span className="hz-emp-home__date-chip" aria-hidden="true">
                <small>{dayLabel(holiday.date, { month: 'short' })}</small>
                <strong>{Number(holiday.date.slice(8, 10))}</strong>
              </span>
              <span className="hz-emp-home__holiday-copy">
                <strong>{holiday.name}</strong>
                <small>
                  <time dateTime={holiday.date}>{dayLabel(holiday.date, { weekday: 'long', day: 'numeric', month: 'long' })}</time>
                  {holiday.type || holiday.holidayType ? ` · ${holiday.type || holiday.holidayType}` : ''}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Shortcuts to the self-service pages, plus the HR helpdesk for anything else. */
export function QuickLinksPanel({ canViewPayslip }) {
  const links = [
    { to: '/my-profile', icon: UserRound, label: 'My profile', detail: 'Personal, job and bank details' },
    { to: '/my-attendance', icon: Clock3, label: 'My attendance', detail: 'Check in, timings and regularisation' },
    { to: '/my-leave', icon: CalendarDays, label: 'My leave', detail: 'Balances, requests and history' },
    canViewPayslip && { to: '/my-payslip', icon: WalletCards, label: 'My payslips', detail: 'Salary and payslip downloads' },
    { to: '/helpdesk', icon: LifeBuoy, label: 'Ask HR', detail: 'Questions about pay, leave or your record' },
    { to: '/company', icon: Building2, label: 'Company', detail: 'Policies, people and announcements' },
  ].filter(Boolean);

  return (
    <section className="hz-emp-home__panel" aria-labelledby="emp-home-links-title">
      <div className="hz-emp-home__panel-head">
        <h2 id="emp-home-links-title">Quick links</h2>
      </div>
      <ul className="hz-emp-home__quick">
        {links.map(({ to, icon: Icon, label, detail }) => (
          <li key={to}>
            <Link to={to}>
              <Icon size={17} aria-hidden="true" />
              <span><strong>{label}</strong><small>{detail}</small></span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
