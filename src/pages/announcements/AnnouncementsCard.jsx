import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Megaphone, Pin } from 'lucide-react';
import { announcementsApi } from '../../api/endpoints/announcements';
import { formatDateIST } from '../../utils/formatDateTime';
import Badge from '../../components/ui/Badge';
import { categoryMeta } from './announcementMeta';

/**
 * Compact dashboard widget: the latest few announcements with unread and
 * acknowledgement hints. Renders nothing when there is nothing to show or
 * the feed can't be loaded, so it never adds noise to the dashboard.
 */
export default function AnnouncementsCard({ limit = 3 }) {
  const { data, isError } = useQuery({
    queryKey: ['announcements-feed'],
    queryFn: announcementsApi.feed,
    retry: false,
    staleTime: 60_000,
  });
  const items = Array.isArray(data) ? data : [];
  if (isError || items.length === 0) return null;
  const unread = items.filter((item) => !item.read).length;
  const pendingAck = items.filter((item) => item.requiresAcknowledgement && !item.acknowledgedAt).length;

  return (
    <section className="hz-dash__panel" aria-labelledby="dash-announcements-title">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 id="dash-announcements-title" className="h6 mb-0 d-flex align-items-center gap-2">
          <Megaphone size={16} aria-hidden="true" /> Announcements
          {unread > 0 && <Badge variant="info">{unread} new</Badge>}
          {pendingAck > 0 && <Badge variant="warning">{pendingAck} to acknowledge</Badge>}
        </h2>
        <Link to="/announcements" className="hz-dashboard__text-link" style={{ fontSize: 'var(--hz-text-sm)' }}>View all</Link>
      </div>
      <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
        {items.slice(0, limit).map((item) => (
          <li key={item.id}>
            <Link to="/announcements" className="text-decoration-none d-flex justify-content-between gap-2" style={{ color: 'var(--hz-text-primary)' }}>
              <span className="d-flex align-items-center gap-2" style={{ fontWeight: item.read ? 400 : 600, fontSize: 'var(--hz-text-sm)' }}>
                {item.pinned && <Pin size={12} aria-label="Pinned" />}
                <Badge variant={categoryMeta(item.category).variant}>{categoryMeta(item.category).label}</Badge>
                {item.title}
              </span>
              <small style={{ color: 'var(--hz-text-muted)', whiteSpace: 'nowrap' }}>{formatDateIST(item.publishedAt)}</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
