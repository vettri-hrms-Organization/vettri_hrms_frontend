import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { holidayCalendarApi } from '../../api/endpoints/settlement';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Employee self-service: holidays for my location, and picking optional (restricted) holidays. */
export default function MyHolidays() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-holidays', year],
    queryFn: () => holidayCalendarApi.mine(year),
  });

  const onDone = (message) => (result) => {
    queryClient.setQueryData(['my-holidays', year], result);
    toast.success(message);
  };
  const onFail = (err) => toast.error(err.response?.data?.message || 'Something went wrong');
  const pick = useMutation({ mutationFn: holidayCalendarApi.pick, onSuccess: onDone('Optional holiday picked'), onError: onFail });
  const unpick = useMutation({ mutationFn: holidayCalendarApi.unpick, onSuccess: onDone('Optional holiday dropped'), onError: onFail });

  if (isError) return <ErrorState description="Couldn't load your holidays." onRetry={refetch} />;

  const rows = data?.holidays || [];
  const mandatory = rows.filter((h) => h.holidayType !== 'OPTIONAL');
  const optional = rows.filter((h) => h.holidayType === 'OPTIONAL');
  const busy = pick.isPending || unpick.isPending;

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
          <Card title="Holidays" subtitle={`${mandatory.length} holiday(s) in ${year}`}>
            {mandatory.length === 0 && <EmptyState icon={CalendarDays} title="No holidays" description="No holidays are set up for your location this year." />}
            {mandatory.map((h) => (
              <div key={h.id} className="d-flex align-items-center justify-content-between py-2" style={{ borderBottom: '1px solid var(--hz-border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{formatDay(h.date)}</div>
                </div>
                {h.locationNames?.length > 0 && <Badge variant="neutral">{h.locationNames.join(', ')}</Badge>}
              </div>
            ))}
          </Card>

          <Card
            title="Optional holidays"
            subtitle={`You can pick ${data.maxOptionalHolidays} per year - ${data.optionalPicked} picked. Pick or drop before the date.`}
          >
            {optional.length === 0 && <EmptyState icon={CalendarDays} title="No optional holidays" description="Your company hasn't listed optional holidays for this year." />}
            {optional.map((h) => (
              <div key={h.id} className="d-flex align-items-center justify-content-between py-2 gap-2" style={{ borderBottom: '1px solid var(--hz-border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>
                    {h.name} {h.picked && <Badge variant="success">Picked</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{formatDay(h.date)}</div>
                </div>
                {h.canPick && (
                  <Button size="sm" disabled={busy} onClick={() => pick.mutate(h.id)} aria-label={`Pick ${h.name}`}>Pick</Button>
                )}
                {h.canUnpick && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => unpick.mutate(h.id)} aria-label={`Drop ${h.name}`}>Drop</Button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
