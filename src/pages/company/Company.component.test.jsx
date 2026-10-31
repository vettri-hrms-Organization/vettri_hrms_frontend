import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Company from './Company.jsx';

vi.mock('../announcements/AnnouncementsFeed', () => ({ default: ({ embedded }) => <p>feed embedded={String(embedded)}</p> }));
vi.mock('../leave/MyHolidays', () => ({ default: ({ embedded }) => <p>holidays embedded={String(embedded)}</p> }));
vi.mock('../surveys/Surveys', () => ({ default: ({ embedded }) => <p>surveys embedded={String(embedded)}</p> }));

function renderAt(url) {
  return render(<MemoryRouter initialEntries={[url]}><Company /></MemoryRouter>);
}

afterEach(() => cleanup());

describe('Company', () => {
  it('opens on announcements and shows each section without its own page title', async () => {
    renderAt('/company');
    expect(screen.getByText('feed embedded=true')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Holidays/ }));
    expect(screen.getByText('holidays embedded=true')).toBeTruthy();
  });

  it('opens the tab named in the link', () => {
    renderAt('/company?tab=surveys');
    expect(screen.getByText('surveys embedded=true')).toBeTruthy();
  });
});
