import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarHeart, CheckCircle2, Clock, Sparkles, Sun } from 'lucide-react';
import { holidayCalendarApi } from '../../api/endpoints/settlement';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value) => new Date(`${value}T00:00:00`);
const todayStart = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); };
const weekday = (date) => toDate(date).toLocaleDateString('en-IN', { weekday: 'long' });
const daysUntil = (date) => Math.round((toDate(date) - todayStart()) / DAY_MS);
/** Monday or Friday holidays sit next to the weekend - a natural long break. */
const nextToWeekend = (date) => [1, 5].includes(toDate(date).getDay());
/** A holiday "counts" for the employee when it is mandatory or an optional one they picked. */
const counts = (holiday) => holiday.holidayType !== 'OPTIONAL' || holiday.picked;

function countdown(days) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`;
  if (days < 7) return `In ${days} days`;
  const weeks = Math.round(days / 7);
  return days < 60 ? `In ${weeks} week${weeks === 1 ? '' : 's'}` : `In ${Math.round(days / 30)} months`;
}

/** Big calendar-page style date tile. */
function DateTile({ date, tone = 'upcoming', size = 64 }) {
  const day = toDate(date);
  const palette = {
    upcoming: { head: 'var(--hz-primary-500)', body: 'var(--hz-primary-50)', text: 'var(--hz-primary-800, #1B2850)' },
    today: { head: 'var(--hz-warning-500, #E09A1A)', body: 'var(--hz-warning-50)', text: 'var(--hz-warning-600)' },
    optional: { head: 'var(--hz-brand-indigo-500, #6558F5)', body: 'var(--hz-accent-50)', text: 'var(--hz-accent-700)' },
    past: { head: 'var(--hz-gray-400)', body: 'var(--hz-gray-100)', text: 'var(--hz-text-muted)' },
  }[tone];
  return (
    <div aria-hidden="true" style={{ width: size, flexShrink: 0, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 12px rgba(16,23,42,0.08)', textAlign: 'center', background: palette.body }}>
      <div style={{ background: palette.head, color: '#fff', fontSize: size * 0.17, fontWeight: 700, letterSpacing: 1, padding: '3px 0' }}>
        {MONTHS[day.getMonth()].slice(0, 3).toUpperCase()}
      </div>
      <div style={{ fontSize: size * 0.42, fontWeight: 800, lineHeight: 1.15, color: palette.text, padding: '2px 0 4px' }}>{day.getDate()}</div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, detail, color, children }) {
  return (
    <div className="h-100 d-flex flex-column gap-2 p-3" style={{ background: 'var(--hz-bg-surface)', border: '1px solid var(--hz-border)', borderRadius: 16, boxShadow: 'var(--hz-shadow-sm)' }}>
      <div className="d-flex align-items-center gap-2" style={{ color: 'var(--hz-text-muted)', fontSize: 13, fontWeight: 600 }}>
        <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 30, height: 30, borderRadius: 9, background: `${color}1A`, color }}><Icon size={16} aria-hidden="true" /></span>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--hz-text-primary)' }}>{value}</div>
      {detail && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{detail}</div>}
      {children}
    </div>
  );
}

/** Twelve small month grids; holiday days are filled (mandatory blue, picked optional indigo, other optional outlined). */
function YearCalendar({ year, holidays }) {
  const byDate = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);
  const todayKey = (() => { const t = todayStart(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
  return (
    <div className="row g-3">
      {MONTHS.map((month, monthIndex) => {
        const first = new Date(year, monthIndex, 1);
        const length = new Date(year, monthIndex + 1, 0).getDate();
        const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
        return (
          <div key={month} className="col-6 col-md-4 col-xl-3">
            <div className="h-100 p-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{month}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontSize: 11 }}>
                {WEEKDAYS.map((label, i) => <span key={`${month}-h${i}`} style={{ color: 'var(--hz-text-muted)', fontWeight: 600 }}>{label}</span>)}
                {cells.map((day, i) => {
                  if (!day) return <span key={`${month}-e${i}`} />;
                  const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const holiday = byDate.get(key);
                  const optionalOpen = holiday && holiday.holidayType === 'OPTIONAL' && !holiday.picked;
                  const fill = holiday && !optionalOpen ? (holiday.holidayType === 'OPTIONAL' ? 'var(--hz-brand-indigo-500, #6558F5)' : 'var(--hz-primary-500)') : 'transparent';
                  const weekend = (first.getDay() + day - 1) % 7 === 0;
                  return (
                    <span
                      key={key}
                      title={holiday ? `${holiday.name}${optionalOpen ? ' (optional)' : ''}` : undefined}
                      aria-label={holiday ? `${day} ${month}: holiday` : undefined}
                      style={{
                        lineHeight: '22px', borderRadius: 6, background: fill,
                        color: holiday && !optionalOpen ? '#fff' : weekend ? 'var(--hz-text-muted)' : 'inherit',
                        fontWeight: holiday ? 700 : 400,
                        border: optionalOpen ? '1.5px dashed var(--hz-brand-indigo-500, #6558F5)' : key === todayKey ? '1.5px solid var(--hz-warning-500, #E09A1A)' : '1.5px solid transparent',
                      }}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
      <div className="col-12 d-flex flex-wrap gap-3" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--hz-primary-500)' }} /> Holiday</span>
        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--hz-brand-indigo-500, #6558F5)' }} /> Optional (picked)</span>
        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px dashed var(--hz-brand-indigo-500, #6558F5)' }} /> Optional (not picked)</span>
        <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px solid var(--hz-warning-500, #E09A1A)' }} /> Today</span>
      </div>
    </div>
  );
}

/** Employee self-service: holidays for my location, and picking optional (restricted) holidays. */
export default function MyHolidays() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [view, setView] = useState('list');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-holidays', year],
    queryFn: () => holidayCalendarApi.mine(year),
  });

  const onDone = (message) => (result) => {
    queryClient.setQueryData(['my-holidays', year], result);
    toast.success(message);
  };
  const onFail = (err) => toast.error(err.response?.data?.message || 'Could not update your optional holiday. Please try again.');
  const pick = useMutation({ mutationFn: holidayCalendarApi.pick, onSuccess: onDone('Optional holiday added to your calendar'), onError: onFail });
  const unpick = useMutation({ mutationFn: holidayCalendarApi.unpick, onSuccess: onDone('Optional holiday removed from your calendar'), onError: onFail });

  if (isError) return <ErrorState description="Couldn't load your holidays." onRetry={refetch} />;

  const rows = [...(data?.holidays || [])].sort((a, b) => a.date.localeCompare(b.date));
  const mandatory = rows.filter((h) => h.holidayType !== 'OPTIONAL');
  const optional = rows.filter((h) => h.holidayType === 'OPTIONAL');
  const busy = pick.isPending || unpick.isPending;
  const counted = rows.filter(counts);
  const upcoming = counted.filter((h) => daysUntil(h.date) >= 0);
  const next = upcoming[0];
  const weekendBreaks = counted.filter((h) => nextToWeekend(h.date)).length;
  const maxOptional = data?.maxOptionalHolidays || 0;
  const picked = data?.optionalPicked || 0;
  const pickable = optional.filter((h) => h.canPick).length;

  const byMonth = MONTHS.map((month, index) => ({ month, holidays: mandatory.filter((h) => toDate(h.date).getMonth() === index) }))
    .filter((group) => group.holidays.length > 0);

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="My workspace"
        title="Holidays"
        description={data?.officeLocationName ? `Holidays for ${data.officeLocationName}` : 'Company holidays that apply to you'}
        actions={(
          <select className="form-select" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      />

      {isLoading && <Card><SkeletonText lines={5} /></Card>}

      {!isLoading && data && (
        <>
          {/* Next holiday banner */}
          <section
            aria-label="Next holiday"
            className="d-flex align-items-center gap-4 flex-wrap p-4"
            style={{ borderRadius: 20, color: '#F6F7FB', background: 'linear-gradient(120deg, #1B2850 0%, #3457C9 55%, #6558F5 100%)', boxShadow: '0 18px 40px rgba(65,105,225,0.25)', position: 'relative', overflow: 'hidden' }}
          >
            <span aria-hidden="true" style={{ position: 'absolute', right: -40, top: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <span aria-hidden="true" style={{ position: 'absolute', right: 90, bottom: -90, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,176,0,0.18)' }} />
            {next ? (
              <>
                <DateTile date={next.date} tone={daysUntil(next.date) === 0 ? 'today' : 'upcoming'} size={92} />
                <div style={{ position: 'relative', minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#FFD66B' }}>
                    <Sparkles size={15} aria-hidden="true" /> {daysUntil(next.date) === 0 ? 'HOLIDAY TODAY' : 'NEXT HOLIDAY'}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, marginTop: 4 }}>{next.name}</div>
                  <div style={{ fontSize: 15, opacity: 0.85, marginTop: 4 }}>
                    {weekday(next.date)} · {countdown(daysUntil(next.date))}{nextToWeekend(next.date) ? ' · next to the weekend' : ''}
                  </div>
                </div>
              </>
            ) : (
              <div className="d-flex align-items-center gap-3" style={{ position: 'relative' }}>
                <CalendarHeart size={40} aria-hidden="true" />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{year < thisYear ? `Holidays in ${year}` : 'No more holidays this year'}</div>
                  <div style={{ fontSize: 14, opacity: 0.85 }}>{year < thisYear ? 'This year has passed.' : pickable > 0 ? `You can still pick ${pickable === 1 ? 'an optional holiday' : `from ${pickable} optional holidays`} below.` : `Switch to ${year + 1} above to see next year's holidays once they're published.`}</div>
                </div>
              </div>
            )}
          </section>

          {/* Summary tiles */}
          <div className="row g-3">
            <div className="col-6 col-lg-3"><StatTile icon={CalendarDays} label="Holidays" value={mandatory.length} detail={`in ${year}`} color="#4169E1" /></div>
            <div className="col-6 col-lg-3"><StatTile icon={Clock} label="Still to come" value={upcoming.length} detail={upcoming.length ? `next ${countdown(daysUntil(upcoming[0].date)).toLowerCase()}` : 'none left'} color="#12735A" /></div>
            <div className="col-6 col-lg-3"><StatTile icon={Sun} label="Next to a weekend" value={weekendBreaks} detail="Monday or Friday holidays" color="#9A6519" /></div>
            <div className="col-6 col-lg-3">
              <StatTile icon={CheckCircle2} label="Optional chosen" value={optional.length === 0 ? '—' : `${picked} / ${maxOptional}`} detail={!maxOptional || optional.length === 0 ? 'None offered this year' : `${Math.max(0, maxOptional - picked)} left to pick`} color="#6558F5">
                {maxOptional > 0 && optional.length > 0 && (
                  <div role="progressbar" aria-label="Optional holidays picked" aria-valuenow={picked} aria-valuemin={0} aria-valuemax={maxOptional} style={{ height: 6, borderRadius: 99, background: 'var(--hz-gray-100, #f2f4f7)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (picked / maxOptional) * 100)}%`, height: '100%', background: '#6558F5' }} />
                  </div>
                )}
              </StatTile>
            </div>
          </div>

          <Card
            title="Holidays"
            subtitle={`${mandatory.length} ${mandatory.length === 1 ? 'holiday' : 'holidays'} in ${year}`}
            actions={(
              <div className="btn-group" role="group" aria-label="Holiday view">
                <button type="button" className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
                <button type="button" className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
              </div>
            )}
          >
            {mandatory.length === 0 && view === 'list' && <EmptyState icon={CalendarDays} title="No holidays" description={`No holidays are set up for your location in ${year} yet.`} />}
            {view === 'calendar' && <YearCalendar year={year} holidays={rows} />}
            {view === 'list' && byMonth.map(({ month, holidays }) => (
              <div key={month} className="mb-3">
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--hz-text-muted)', margin: '8px 0' }}>{month.toUpperCase()}</div>
                <div className="d-flex flex-column gap-2">
                  {holidays.map((h) => {
                    const days = daysUntil(h.date);
                    const past = days < 0;
                    return (
                      <div key={h.id} className="d-flex align-items-center gap-3 p-2 pe-3" style={{ borderRadius: 14, border: '1px solid var(--hz-border)', opacity: past ? 0.6 : 1, background: days === 0 ? 'var(--hz-warning-50)' : 'transparent' }}>
                        <DateTile date={h.date} tone={past ? 'past' : days === 0 ? 'today' : 'upcoming'} size={56} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{h.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{weekday(h.date)} · {past ? 'Passed' : countdown(days)}</div>
                        </div>
                        <div className="d-flex flex-wrap gap-1 justify-content-end">
                          {!past && nextToWeekend(h.date) && <Badge variant="warning">Next to weekend</Badge>}
                          {h.locationNames?.length > 0 && <Badge variant="neutral">{h.locationNames.join(', ')}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>

          <Card
            title="Optional holidays"
            subtitle={optional.length === 0 ? 'Extra holidays you can choose to take, when your company offers them.' : `Choose up to ${maxOptional} a year · ${picked} picked. You can change your choice until the day itself.`}
          >
            {optional.length === 0 && <EmptyState icon={CalendarDays} title="No optional holidays" description={`Your company hasn't listed optional holidays for ${year}.`} />}
            <div className="row g-3">
              {optional.map((h) => {
                const past = daysUntil(h.date) < 0;
                return (
                  <div key={h.id} className="col-12 col-md-6 col-xl-4">
                    <div className="h-100 d-flex align-items-center gap-3 p-3" style={{ borderRadius: 16, border: `1.5px ${h.picked ? 'solid' : 'dashed'} ${h.picked ? 'var(--hz-brand-indigo-500, #6558F5)' : 'var(--hz-border-strong, #d0d5dd)'}`, background: h.picked ? 'var(--hz-accent-50)' : 'transparent', opacity: past ? 0.6 : 1 }}>
                      <DateTile date={h.date} tone={past ? 'past' : 'optional'} size={56} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>
                          {h.name} {h.picked && <Badge variant="success">Picked</Badge>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--hz-text-muted)' }}>{weekday(h.date)} · {past ? 'Passed' : countdown(daysUntil(h.date))}</div>
                      </div>
                      {h.canPick && (
                        <Button size="sm" disabled={busy} onClick={() => pick.mutate(h.id)} aria-label={`Pick ${h.name}`}>Pick</Button>
                      )}
                      {h.canUnpick && (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => unpick.mutate(h.id)} aria-label={`Drop ${h.name}`}>Drop</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
