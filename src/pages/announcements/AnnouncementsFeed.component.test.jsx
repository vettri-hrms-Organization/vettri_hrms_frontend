import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnnouncementsFeed from './AnnouncementsFeed.jsx';
import { linkifyParts } from './AnnouncementBody.jsx';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  auth: { hasPermission: () => false },
  announcementsApi: { feed: vi.fn(), markRead: vi.fn(), acknowledge: vi.fn(), downloadAttachment: vi.fn() },
}));

vi.mock('../../components/ui/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../api/endpoints/announcements', () => ({ announcementsApi: mocks.announcementsApi }));

const POLICY = {
  id: 7, title: 'Updated leave policy', category: 'POLICY', pinned: true, read: false,
  body: 'Please read the new policy at https://intranet.example.com/leave.\n<script>alert(1)</script>',
  publishedAt: '2026-10-27T09:00:00+05:30', requiresAcknowledgement: true, acknowledgementDueDate: '2026-11-05',
  acknowledgedAt: null, hasAttachment: false,
};

function renderFeed() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><AnnouncementsFeed /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AnnouncementsFeed', () => {
  beforeEach(() => {
    mocks.announcementsApi.feed.mockResolvedValue([POLICY]);
    mocks.announcementsApi.markRead.mockResolvedValue({ ...POLICY, read: true });
    mocks.announcementsApi.acknowledge.mockResolvedValue({ ...POLICY, read: true, acknowledgedAt: '2026-10-28T10:00:00+05:30' });
  });

  afterEach(() => cleanup());

  it('renders links safely and never injects markup from the body', async () => {
    const { container } = renderFeed();
    expect(await screen.findByText('Updated leave policy')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'https://intranet.example.com/leave' });
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(container.querySelector('script')).toBeNull();
  });

  it('records an acknowledgement', async () => {
    const user = userEvent.setup();
    renderFeed();
    await user.click(await screen.findByRole('button', { name: /I have read and understood/ }));
    await waitFor(() => expect(mocks.announcementsApi.acknowledge).toHaveBeenCalledWith(7));
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalled());
  });

  it('linkifyParts keeps trailing punctuation out of the URL', () => {
    expect(linkifyParts('See https://a.example/x. Thanks')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://a.example/x' },
      { type: 'text', value: '. Thanks' },
    ]);
  });
});
