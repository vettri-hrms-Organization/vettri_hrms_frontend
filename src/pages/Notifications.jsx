import { useState } from 'react';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { SkeletonText } from '../components/ui/Skeleton';
import PageShell from '../components/ui/PageShell';
import SectionHeader from '../components/ui/SectionHeader';
import { notificationsApi } from '../api/endpoints/notifications';
import { groupNotificationsByDay, isNotificationRead } from '../api/notificationDisplay';
import { useAuth } from '../hooks/useAuth';

const PAGE_SIZE = 20;
const FILTERS = [
  { value: '', label: 'All notifications' },
  { value: 'LEAVE_SUBMITTED', label: 'Leave requests' },
  { value: 'LEAVE_DECISION', label: 'Leave decisions' },
  { value: 'ATTENDANCE_REGULARIZATION_REQUEST', label: 'Attendance' },
  { value: 'ATTENDANCE_REGULARIZATION_DECISION', label: 'Attendance decisions' },
  { value: 'DOCUMENT_UPLOADED', label: 'Documents' },
  { value: 'DOCUMENT_REVIEW', label: 'Document reviews' },
  { value: 'PAYROLL_PAID', label: 'Payroll' },
  { value: 'SOFTWARE_DEPLOYMENT', label: 'Software deployments' },
];

function notificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [type, setType] = useState('');
  const query = useQuery({
    queryKey: ['notifications', 'inbox', page, PAGE_SIZE, type],
    queryFn: () => notificationsApi.inbox({ page, size: PAGE_SIZE, type }),
    enabled: !!user,
  });
  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidateNotifications });
  const markAllRead = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidateNotifications });
  const items = query.data?.items || [];
  const groups = groupNotificationsByDay(items);
  const unreadCount = query.data?.unreadCount || 0;
  const totalPages = query.data?.totalPages || 0;

  return (
    <PageShell className="hz-notifications-page d-flex flex-column gap-4">
      <SectionHeader
        eyebrow="Workspace inbox"
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'Updates and actions related to your workspace account.'}
        actions={unreadCount > 0 && (
          <button type="button" className="btn btn-outline-secondary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            {markAllRead.isPending ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      />
      <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
        <label className="d-flex align-items-center gap-2">
          <span className="text-secondary-hz">Filter</span>
          <select
            className="form-select"
            value={type}
            aria-label="Filter notifications"
            onChange={(event) => { setType(event.target.value); setPage(0); }}
          >
            {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
          </select>
        </label>
        <Link to="/settings/preferences#notifications">Email notification preferences</Link>
      </div>
      {query.isError && <ErrorState description="Couldn't load your notifications." onRetry={query.refetch} />}
      {query.isLoading && <div className="hz-self-service-list p-3"><SkeletonText lines={4} /></div>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={Bell} title="You're all caught up" description="Important updates will appear here when they are available." />
      )}
      {!query.isLoading && !query.isError && items.length > 0 && (
        <>
          <div className="hz-self-service-list" aria-label="Notifications">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="px-3 pt-3 mb-0 fs-6">{group.label}</h2>
                {group.items.map((notification) => {
                  const isRead = isNotificationRead(notification);
                  return (
                    <button
                      type="button"
                      className={`hz-self-service-list__row hz-notification-row ${isRead ? '' : 'is-unread'}`}
                      key={notification.id}
                      onClick={() => !isRead && markRead.mutate(notification.id)}
                      aria-label={`${isRead ? 'Read' : 'Unread'} notification: ${notification.title}`}
                    >
                      <span className="hz-self-service-list__icon"><Bell size={17} /></span>
                      <span className="text-start">
                        <strong>{notification.title}</strong>
                        <small>{notification.message}</small>
                        <small>{notificationTime(notification.created_at)}</small>
                      </span>
                      {isRead ? <CheckCheck size={16} aria-label="Read" /> : <Circle size={10} aria-label="Unread" />}
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
          <nav className="d-flex align-items-center justify-content-between" aria-label="Notification pages">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Previous</button>
            <span>Page {page + 1} of {Math.max(1, totalPages)}</span>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setPage((value) => value + 1)} disabled={page + 1 >= totalPages}>Next</button>
          </nav>
        </>
      )}
    </PageShell>
  );
}
