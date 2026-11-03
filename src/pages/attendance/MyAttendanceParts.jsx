import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, CheckCircle2, MoreHorizontal, Timer } from 'lucide-react';
import { dailyAttendanceApi } from '../../api/endpoints/shifts';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { addDays, istToday, weekStart } from './shiftUtils';

/*
 * Pieces of the employee "My Attendance" page, laid out like a calm attendance dashboard:
 * stats for a period, this week's timings, and a day-by-day log / calendar built from the
 * shift-aware daily attendance (status, first in, last out, worked and late minutes).
 */

const DAY_START_MINUTES = 6 * 60; // the log's time track runs 06:00 - 24:00
const DAY_SPAN_MINUTES = 18 * 60;
const METHOD_LABEL = { HYBRID: 'Hybrid', BIOMETRIC_ONLY: 'Biometric only', WEB_APP_ONLY: 'Web / App only' };
const STATUS_LABEL = { PRESENT: 'Present', HALF_DAY: 'Half day', ABSENT: 'Absent', WEEK_OFF: 'Weekly off', HOLIDAY: 'Holiday', LEAVE: 'On leave' };

export function minutesLabel(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

/** "0:41 late" style, as clocks read it. */
function lateLabel(minutes) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} late`;
}

export function clockLabel(value, use24h) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: !use24h }).format(new Date(value));
}

/** "10:00" / "10:00:00" shift times as "10:00 AM" (or 24-hour). */
export function shiftTimeLabel(value, use24h) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (use24h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function shiftMinutes(value) {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes after IST midnight of the record's day; next-day times count past 24:00. */
function minutesOfDay(value, dayIso) {
  if (!value) return null;
  const ist = new Date(new Date(value).getTime() + 330 * 60000);
  const sameDay = ist.toISOString().slice(0, 10) === dayIso;
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() + (sameDay ? 0 : 24 * 60);
}

function grossMinutes(day) {
  if (!day.firstIn || !day.lastOut) return null;
  return Math.max(0, Math.round((new Date(day.lastOut) - new Date(day.firstIn)) / 60000));
}

/** Time between first in and last out that was not counted as work. */
function breakMinutes(day) {
  const gross = grossMinutes(day);
  return gross == null ? null : Math.max(0, gross - (day.workedMinutes || 0));
}

const worked = (day) => day.status === 'PRESENT' || day.status === 'HALF_DAY' || day.workedMinutes > 0;

function dayLabel(iso, options) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', { timeZone: 'UTC', ...options });
}

function useDaily(from, to, enabled = true) {
  return useQuery({
    queryKey: ['attendance-daily-me', from, to],
    queryFn: () => dailyAttendanceApi.mine(from, to),
    enabled: enabled && !!from && !!to && from <= to,
    retry: false,
  });
}

// ------------------------------------------------------------------ stats

const PERIODS = [
  { key: 'this-week', label: 'This week' },
  { key: 'last-week', label: 'Last week' },
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
];

function periodRange(key, today) {
  const monday = weekStart(today);
  if (key === 'this-week') return { from: monday, to: today };
  if (key === 'last-week') return { from: addDays(monday, -7), to: addDays(monday, -1) };
  const firstThisMonth = `${today.slice(0, 7)}-01`;
  if (key === 'this-month') return { from: firstThisMonth, to: today };
  const lastPrev = addDays(firstThisMonth, -1);
  return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
}

export function AttendanceStats() {
  const [period, setPeriod] = useState('last-week');
  const range = periodRange(period, istToday());
  const daily = useDaily(range.from, range.to);
  const days = (daily.data || []).filter(worked);
  const totalWorked = days.reduce((sum, day) => sum + (day.workedMinutes || 0), 0);
  const onTime = days.filter((day) => !day.late).length;
  const late = days.length - onTime;

  return (
    <div className="hz-my-att__panel hz-my-att__stats">
      <div className="hz-my-att__panel-head">
        <select className="form-select form-select-sm hz-my-att__period" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Stats period">
          {PERIODS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>
      {daily.isLoading && <SkeletonText lines={3} />}
      {daily.isError && <p className="hz-my-att__muted">Stats are not available right now.</p>}
      {!daily.isLoading && !daily.isError && (
        <dl className="hz-my-att__figures">
          <div><dt>Avg hrs / day</dt><dd>{days.length ? minutesLabel(totalWorked / days.length) : '—'}</dd></div>
          <div><dt>On-time arrival</dt><dd>{days.length ? `${Math.round((onTime / days.length) * 100)}%` : '—'}</dd></div>
          <div><dt>Days present</dt><dd>{days.length}</dd></div>
          <div><dt>Late arrivals</dt><dd>{late}</dd></div>
        </dl>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ this week + today's timings

export function WeekTimings({ shiftToday, use24h }) {
  const today = istToday();
  const monday = weekStart(today);
  const week = useDaily(monday, today);
  const byDate = new Map((week.data || []).map((day) => [day.date, day]));
  const start = shiftMinutes(shiftToday?.shiftStart);
  let end = shiftMinutes(shiftToday?.shiftEnd);
  if (start != null && end != null && end <= start) end += 24 * 60;
  const span = start != null && end != null ? end - start : null;
  const workedToday = shiftToday?.workedMinutes || 0;
  const firstIn = minutesOfDay(shiftToday?.firstIn, today);
  const offset = span && firstIn != null ? Math.max(0, Math.min(100, ((firstIn - start) / span) * 100)) : 0;
  const width = span ? Math.max(0, Math.min(100 - offset, (workedToday / span) * 100)) : 0;

  return (
    <div className="hz-my-att__panel hz-my-att__timings">
      <ol className="hz-my-att__week" aria-label="This week">
        {Array.from({ length: 7 }, (_, index) => {
          const iso = addDays(monday, index);
          const day = byDate.get(iso);
          const state = iso > today ? 'future' : !day ? 'none' : day.weekOff || day.holiday ? 'off' : day.leave ? 'leave' : worked(day) ? (day.late ? 'late' : 'ok') : 'absent';
          return (
            <li key={iso} className={`is-${state}${iso === today ? ' is-today' : ''}`} title={`${dayLabel(iso, { weekday: 'long', day: 'numeric', month: 'short' })}${day ? ` · ${STATUS_LABEL[day.status] || day.status}` : ''}`}>
              {dayLabel(iso, { weekday: 'narrow' })}
            </li>
          );
        })}
      </ol>
      <div className="hz-my-att__today">
        <strong>{shiftToday?.weekOff ? 'Today is a weekly off' : shiftToday?.holiday ? 'Today is a holiday' : shiftToday?.leave ? `On leave today (${shiftToday.leave})` : span ? `Today (${shiftTimeLabel(shiftToday.shiftStart, use24h)} – ${shiftTimeLabel(shiftToday.shiftEnd, use24h)})` : 'No shift assigned for today'}</strong>
        {span ? (
          <>
            <div className="hz-my-att__shift-bar" role="img" aria-label={`Worked ${minutesLabel(workedToday)} of a ${minutesLabel(span)} shift`}>
              <span style={{ left: `${offset}%`, width: `${width}%` }} />
            </div>
            <div className="hz-my-att__shift-meta">
              <span>Duration: {minutesLabel(span)}</span>
              <span>{shiftToday?.firstIn ? `Worked ${minutesLabel(workedToday)}${shiftToday.late ? ` · ${lateLabel(shiftToday.lateInMinutes)}` : ''}` : 'Not checked in yet'}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ live clock

export function LiveClock({ use24h }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="hz-my-att__clock">
      <strong>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !use24h }).format(now)}</strong>
      <span>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(now)}</span>
    </div>
  );
}

// ------------------------------------------------------------------ log + calendar

/** "30 days" plus the six previous months, newest first. */
export function logPeriods(today) {
  const periods = [{ key: '30', label: '30 days', from: addDays(today, -29), to: today }];
  let cursor = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < 6; i += 1) {
    const last = addDays(cursor, -1);
    cursor = `${last.slice(0, 7)}-01`;
    periods.push({ key: cursor.slice(0, 7), label: dayLabel(cursor, { month: 'short' }).toUpperCase(), from: cursor, to: last });
  }
  return periods;
}

function ArrivalCell({ day }) {
  if (!day.firstIn) return <span className="hz-my-att__muted">—</span>;
  if (day.late) return <span className="hz-my-att__late"><Timer size={15} aria-hidden="true" /> {lateLabel(day.lateInMinutes)}</span>;
  return <span className="hz-my-att__ontime"><CheckCircle2 size={15} aria-hidden="true" /> On time</span>;
}

function StatusIcon({ day }) {
  if (day.missingOut) return <span className="hz-my-att__status is-warn" title="No check-out recorded"><AlertCircle size={18} /></span>;
  if (day.status === 'ABSENT') return <span className="hz-my-att__status is-bad" title="Absent">A</span>;
  if (day.status === 'HALF_DAY') return <span className="hz-my-att__status is-warn" title="Half day">½</span>;
  return <span className="hz-my-att__status is-ok" title={STATUS_LABEL[day.status] || 'Present'}><CheckCircle2 size={18} /></span>;
}

function TimeTrack({ day }) {
  const start = shiftMinutes(day.shiftStart);
  let end = shiftMinutes(day.shiftEnd);
  if (start != null && end != null && end <= start) end += 24 * 60;
  const inAt = minutesOfDay(day.firstIn, day.date);
  const outAt = day.lastOut ? minutesOfDay(day.lastOut, day.date) : inAt != null && day.date === istToday() ? minutesOfDay(new Date().toISOString(), day.date) : null;
  const pos = (minutes) => Math.max(0, Math.min(100, ((minutes - DAY_START_MINUTES) / DAY_SPAN_MINUTES) * 100));
  return (
    <div className="hz-my-att__track" aria-hidden="true">
      {start != null && <i className="hz-my-att__tick" style={{ left: `${pos(start)}%` }} />}
      {end != null && <i className="hz-my-att__tick" style={{ left: `${pos(end)}%` }} />}
      {inAt != null && outAt != null && <span className={day.late ? 'is-late' : ''} style={{ left: `${pos(inAt)}%`, width: `${Math.max(1.5, pos(outAt) - pos(inAt))}%` }} />}
    </div>
  );
}

export function AttendanceLog({ period, use24h, sessionsByDate, onRegularize, canRegularize }) {
  const daily = useDaily(period.from, period.to);
  const [menuFor, setMenuFor] = useState(null);
  const today = istToday();
  const rows = useMemo(() => [...(daily.data || [])].filter((day) => day.date <= today).sort((a, b) => b.date.localeCompare(a.date)), [daily.data, today]);

  useEffect(() => {
    if (!menuFor) return undefined;
    const onPointer = (event) => { if (!event.target.closest('.hz-my-att__menu')) setMenuFor(null); };
    const onKey = (event) => { if (event.key === 'Escape') setMenuFor(null); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [menuFor]);

  if (daily.isLoading) return <div className="p-3"><SkeletonText lines={6} /></div>;
  if (daily.isError) return <ErrorState description="Couldn’t load your attendance log." onRetry={() => daily.refetch()} />;
  if (!rows.length) return <EmptyState icon={CalendarDays} title="No attendance in this period" />;

  return (
    <div className="hz-my-att__table-wrap">
      <table className="hz-my-att__table" aria-label="Attendance log">
        <thead>
          <tr><th>Date</th><th>Attendance visual</th><th>Effective hours</th><th>Break taken</th><th>Gross hours</th><th>Arrival</th><th>Log</th><th aria-label="Actions" /></tr>
        </thead>
        <tbody>
          {rows.map((day) => {
            const session = sessionsByDate.get(day.date);
            const nonWorking = !day.firstIn && (day.weekOff || day.holiday || day.leave);
            const chip = day.weekOff ? 'W-OFF' : day.holiday ? 'HOLIDAY' : day.leave ? 'LEAVE' : session?.wfh ? 'WFH' : null;
            return (
              <tr key={day.date} className={nonWorking ? 'is-off' : ''}>
                <td className="hz-my-att__date">
                  {dayLabel(day.date, { weekday: 'short', day: '2-digit', month: 'short' })}
                  {chip && <span className={`hz-my-att__chip is-${chip.toLowerCase()}`}>{chip}</span>}
                </td>
                {nonWorking ? (
                  <td colSpan={6} className="hz-my-att__off-label">{day.weekOff ? 'Full day weekly-off' : day.holiday ? 'Holiday' : `On leave · ${day.leave}`}</td>
                ) : (
                  <>
                    <td><TimeTrack day={day} /><small className="hz-my-att__times">{day.firstIn ? `${clockLabel(day.firstIn, use24h)} – ${day.lastOut ? clockLabel(day.lastOut, use24h) : 'now'}` : 'No punches'}</small></td>
                    <td className="hz-my-att__num">{day.firstIn ? minutesLabel(day.workedMinutes) : '—'}</td>
                    <td className="hz-my-att__num">{breakMinutes(day) == null ? '—' : minutesLabel(breakMinutes(day))}</td>
                    <td className="hz-my-att__num">{minutesLabel(grossMinutes(day))}</td>
                    <td><ArrivalCell day={day} /></td>
                    <td><StatusIcon day={day} /></td>
                  </>
                )}
                <td className="hz-my-att__row-actions">
                  <div className="hz-my-att__menu">
                    <button type="button" className="hz-my-att__menu-button" aria-label={`Actions for ${day.date}`} aria-expanded={menuFor === day.date} onClick={() => setMenuFor(menuFor === day.date ? null : day.date)}>
                      <MoreHorizontal size={16} />
                    </button>
                    {menuFor === day.date && (
                      <div className="hz-my-att__menu-list" role="menu">
                        {canRegularize && <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onRegularize(day.date); }}>Regularize attendance</button>}
                        <Link role="menuitem" to="/my-leave?apply=leave" onClick={() => setMenuFor(null)}>Request leave</Link>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceCalendar({ month }) {
  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const today = istToday();
  const daily = useDaily(from, to <= today ? to : today, from <= today);
  const byDate = new Map((daily.data || []).map((day) => [day.date, day]));
  const leading = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const total = Number(to.slice(8));

  return (
    <div className="hz-my-att__calendar">
      <div className="hz-my-att__calendar-grid" role="grid" aria-label={`Attendance calendar ${month}`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => <div key={name} className="hz-my-att__calendar-head" role="columnheader">{name}</div>)}
        {Array.from({ length: leading }, (_, index) => <div key={`blank-${index}`} />)}
        {Array.from({ length: total }, (_, index) => {
          const iso = `${month}-${String(index + 1).padStart(2, '0')}`;
          const day = byDate.get(iso);
          const state = iso > today ? 'future' : !day ? 'none' : day.weekOff ? 'off' : day.holiday ? 'holiday' : day.leave ? 'leave' : worked(day) ? (day.late ? 'late' : 'ok') : 'absent';
          return (
            <div key={iso} role="gridcell" className={`hz-my-att__calendar-day is-${state}${iso === today ? ' is-today' : ''}`}>
              <span>{index + 1}</span>
              {day && iso <= today && <small>{day.firstIn ? minutesLabel(day.workedMinutes) : day.weekOff ? 'W-off' : day.holiday ? 'Holiday' : day.leave ? 'Leave' : 'Absent'}</small>}
            </div>
          );
        })}
      </div>
      <ul className="hz-my-att__legend">
        <li className="is-ok">On time</li><li className="is-late">Late</li><li className="is-absent">Absent</li><li className="is-leave">Leave</li><li className="is-holiday">Holiday</li><li className="is-off">Weekly off</li>
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ policy

export function policyFacts(policy) {
  if (!policy) return [];
  const facts = [`Attendance is recorded by: ${METHOD_LABEL[policy.attendanceMethod] || policy.attendanceMethod}.`];
  facts.push(policy.gracePeriodMinutes ? `Arriving up to ${policy.gracePeriodMinutes} minutes after your shift starts still counts as on time.` : 'Any arrival after your shift start counts as late.');
  if (policy.remoteCheckInEnabled) facts.push('You can check in remotely on days your work from home is approved.');
  if (policy.requireSelfieAtCheckIn) facts.push('A selfie is taken when you check in through Vettri.');
  if (policy.manualRegularizationEnabled) facts.push(policy.regularizationApprovalRequired ? 'Missed or wrong punches can be regularized; your manager approves the request.' : 'Missed or wrong punches can be regularized and apply straight away.');
  else facts.push('Ask HR if a punch is missing; self-service regularization is turned off.');
  return facts;
}

export function AttendancePolicyDialog({ open, onClose, policy, shiftToday, use24h }) {
  return (
    <Dialog open={open} onClose={onClose} title="Attendance policy" description="How your attendance is recorded" footer={<Button onClick={onClose}>Done</Button>}>
      <ul className="hz-my-att__policy">
        {shiftToday?.shiftName && <li>Your shift today: {shiftToday.shiftName}{shiftToday.shiftStart ? ` (${shiftTimeLabel(shiftToday.shiftStart, use24h)} – ${shiftTimeLabel(shiftToday.shiftEnd, use24h)})` : ''}.</li>}
        {policyFacts(policy).map((fact) => <li key={fact}>{fact}</li>)}
      </ul>
    </Dialog>
  );
}
