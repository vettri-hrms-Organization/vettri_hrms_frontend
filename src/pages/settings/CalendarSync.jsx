import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Copy, RefreshCw } from 'lucide-react';
import { calendarApi, absoluteApiUrl } from '../../api/endpoints/platform';
import { errorText, when } from '../../api/endpoints/workflows';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

/** Subscribe to holidays, leave, 1:1s and trips from Google Calendar, Outlook or Apple Calendar. */
export default function CalendarSync() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['calendar-link'], queryFn: calendarApi.link });
  const reset = useMutation({
    mutationFn: calendarApi.reset,
    onSuccess: (v) => { queryClient.setQueryData(['calendar-link'], v); toast.success('Your calendar link is ready.'); },
    onError: (e) => toast.error(errorText(e, 'Could not create the link.')),
  });
  const remove = useMutation({ mutationFn: calendarApi.remove, onSuccess: () => { queryClient.setQueryData(['calendar-link'], null); toast.success('Link turned off.'); } });
  const url = data?.path ? absoluteApiUrl(data.path) : null;
  const webcal = url ? url.replace(/^https?:/, 'webcal:') : null;
  const copy = () => navigator.clipboard?.writeText(url).then(() => toast.success('Link copied.'), () => toast.error('Copy failed - select and copy it manually.'));
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Me" title="Calendar sync" description="See holidays, your leave, your team's leave, 1:1s and trips in the calendar you already use" />
      <Card title="Your calendar link">
        {isLoading ? <SkeletonText lines={2} /> : !url ? (
          <>
            <p style={{ fontSize: 14 }}>Create a private link and add it to Google Calendar, Outlook or Apple Calendar. It updates automatically every few hours.</p>
            <Button icon={CalendarPlus} loading={reset.isPending} onClick={() => reset.mutate()}>Create my link</Button>
          </>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{url}</code>
              <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>Copy</Button>
              <a className="btn btn-sm btn-outline-secondary" href={webcal}>Open in calendar app</a>
            </div>
            <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
              Anyone with this link can see these entries - don't share it. {data.lastFetchedAt ? `Last synced ${when(data.lastFetchedAt)}.` : 'Not synced yet.'}
            </p>
            <div className="d-flex gap-2">
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={async () => { if (await confirm({ title: 'Reset the link?', description: 'The old link stops working; add the new one to your calendar.', confirmLabel: 'Reset' })) reset.mutate(); }}>Reset link</Button>
              <Button size="sm" variant="secondary" onClick={async () => { if (await confirm({ title: 'Turn off calendar sync?', confirmLabel: 'Turn off' })) remove.mutate(); }}>Turn off</Button>
            </div>
          </>
        )}
      </Card>
      <Card title="How to add it">
        <ul className="mb-0" style={{ fontSize: 14 }}>
          <li><strong>Google Calendar:</strong> Other calendars → + → From URL → paste the link.</li>
          <li><strong>Outlook:</strong> Add calendar → Subscribe from web → paste the link.</li>
          <li><strong>Apple Calendar / iPhone:</strong> tap “Open in calendar app”, or File → New Calendar Subscription.</li>
        </ul>
      </Card>
    </div>
  );
}
