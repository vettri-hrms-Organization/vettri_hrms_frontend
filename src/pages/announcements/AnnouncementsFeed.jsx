import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Paperclip, CheckCircle2, Settings2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { announcementsApi } from '../../api/endpoints/announcements';
import { formatDateIST, formatDateTimeIST } from '../../utils/formatDateTime';
import AnnouncementBody from './AnnouncementBody';
import { categoryMeta } from './announcementMeta';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'ack', label: 'Needs acknowledgement' },
];

export default function AnnouncementsFeed() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['announcements-feed'], queryFn: announcementsApi.feed });
  const items = Array.isArray(data) ? data : [];
  const visible = items.filter((item) => (filter === 'unread' ? !item.read
    : filter === 'ack' ? item.requiresAcknowledgement && !item.acknowledgedAt : true));
  const unread = items.filter((item) => !item.read).length;
  const pendingAck = items.filter((item) => item.requiresAcknowledgement && !item.acknowledgedAt).length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['announcements-feed'] });
    queryClient.invalidateQueries({ queryKey: ['announcements-unread'] });
  };

  const markRead = useMutation({ mutationFn: (id) => announcementsApi.markRead(id), onSuccess: refresh });
  const acknowledge = useMutation({
    mutationFn: (id) => announcementsApi.acknowledge(id),
    onSuccess: () => { refresh(); toast.success('Thanks - your acknowledgement has been recorded.'); },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not record your acknowledgement.'),
  });

  const open = (item) => {
    setExpanded(expanded === item.id ? null : item.id);
    if (!item.read) markRead.mutate(item.id);
  };

  const download = async (id) => {
    try {
      await announcementsApi.downloadAttachment(id);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not download the attachment.');
    }
  };

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Company"
        title="Announcements"
        description={`${unread} unread${pendingAck ? ` · ${pendingAck} awaiting your acknowledgement` : ''}`}
        actions={hasPermission('ANNOUNCEMENT_MANAGE') ? <Link to="/announcements/manage" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"><Settings2 size={16} aria-hidden="true" /> Manage</Link> : null}
      />
      <Tabs items={FILTERS.map((item) => ({ ...item, label: item.key === 'unread' ? `Unread (${unread})` : item.key === 'ack' ? `Needs acknowledgement (${pendingAck})` : item.label }))} value={filter} onChange={setFilter} ariaLabel="Announcement filters" />

      {isLoading && <Card><SkeletonText lines={6} /></Card>}
      {isError && <Card><ErrorState description="Couldn't load announcements." onRetry={refetch} /></Card>}
      {!isLoading && !isError && visible.length === 0 && (
        <Card><EmptyState icon={Megaphone} title={filter === 'all' ? 'No announcements yet' : 'You are all caught up'} description="Company news, policies, and events will appear here." /></Card>
      )}

      {visible.map((item) => {
        const category = categoryMeta(item.category);
        const isOpen = expanded === item.id;
        const needsAck = item.requiresAcknowledgement && !item.acknowledgedAt;
        return (
          <article key={item.id} className="hz-card" aria-labelledby={`announcement-${item.id}-title`} style={!item.read ? { borderLeft: '3px solid var(--hz-primary-500)' } : undefined}>
            <div className="hz-card__body d-flex flex-column gap-2">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {item.pinned && <Pin size={14} aria-label="Pinned" />}
                  <Badge variant={category.variant}>{category.label}</Badge>
                  {!item.read && <Badge variant="info" dot>New</Badge>}
                  {needsAck && <Badge variant="warning">Acknowledge{item.acknowledgementDueDate ? ` by ${formatDateIST(item.acknowledgementDueDate)}` : ''}</Badge>}
                  {item.acknowledgedAt && <Badge variant="success"><CheckCircle2 size={12} aria-hidden="true" /> Acknowledged</Badge>}
                </div>
                <small style={{ color: 'var(--hz-text-muted)' }}>{formatDateTimeIST(item.publishedAt)}{item.authorName ? ` · ${item.authorName}` : ''}</small>
              </div>
              <h2 id={`announcement-${item.id}-title`} className="h6 mb-0">
                <button type="button" className="btn btn-link p-0 text-start text-decoration-none" style={{ fontWeight: 600, color: 'var(--hz-text-primary)' }} onClick={() => open(item)} aria-expanded={isOpen}>
                  {item.title}
                </button>
              </h2>
              <AnnouncementBody text={item.body} clamp={!isOpen} />
              <div className="d-flex gap-2 flex-wrap align-items-center">
                {!isOpen && <Button size="sm" variant="link" className="p-0" onClick={() => open(item)}>Read more</Button>}
                {item.hasAttachment && (
                  <Button size="sm" variant="secondary" icon={Paperclip} onClick={() => download(item.id)}>{item.attachmentFileName || 'Attachment'}</Button>
                )}
                {needsAck && (
                  <Button size="sm" icon={CheckCircle2} loading={acknowledge.isPending && acknowledge.variables === item.id} onClick={() => acknowledge.mutate(item.id)}>
                    I have read and understood
                  </Button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
