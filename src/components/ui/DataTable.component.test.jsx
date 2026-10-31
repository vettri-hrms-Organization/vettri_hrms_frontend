import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DataTable from './DataTable.jsx';

const { exportToCsv } = vi.hoisted(() => ({ exportToCsv: vi.fn() }));
vi.mock('../../utils/exportToCsv', () => ({ exportToCsv }));

const PEOPLE = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  team: i % 2 ? 'Sales' : 'Engineering',
  days: (i * 7) % 11,
}));

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'team', label: 'Team' },
  { key: 'days', label: 'Days', align: 'right' },
  { key: 'actions', label: '', hideable: false, export: false, render: (row) => <button type="button">Open {row.name}</button> },
];

const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent);

beforeEach(() => {
  exportToCsv.mockReset();
  try { window.localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => cleanup());

describe('DataTable', () => {
  it('pages the rows and moves between pages', async () => {
    render(<DataTable columns={COLUMNS} rows={PEOPLE} />);
    expect(names()).toHaveLength(25);
    expect(screen.getByText('1–25 of 30')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(names()).toEqual(['Person 26', 'Person 27', 'Person 28', 'Person 29', 'Person 30']);
  });

  it('searches across columns and says when nothing matches', async () => {
    render(<DataTable columns={COLUMNS} rows={PEOPLE} searchPlaceholder="Search people" emptyTitle="No people" />);
    await userEvent.type(screen.getByLabelText('Search people'), 'person 3');
    expect(names()).toEqual(['Person 3', 'Person 30']);
    await userEvent.clear(screen.getByLabelText('Search people'));
    await userEvent.type(screen.getByLabelText('Search people'), 'nobody');
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('sorts numbers by size and text naturally, then turns sorting off', async () => {
    render(<DataTable columns={COLUMNS} rows={PEOPLE.slice(0, 12)} />);
    const nameHeader = screen.getByRole('button', { name: /Name/ });
    await userEvent.click(nameHeader);
    expect(names().slice(0, 3)).toEqual(['Person 1', 'Person 2', 'Person 3']);
    await userEvent.click(nameHeader);
    expect(names()[0]).toBe('Person 12');
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe('descending');
    await userEvent.click(nameHeader);
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe('none');

    await userEvent.click(screen.getByRole('button', { name: /Days/ }));
    const days = screen.getAllByRole('row').slice(1).map((row) => Number(within(row).getAllByRole('cell')[2].textContent));
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it('hides a column and remembers it', async () => {
    const { unmount } = render(<DataTable columns={COLUMNS} rows={PEOPLE} storageKey="people" />);
    await userEvent.click(screen.getByRole('button', { name: /Columns/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Team' }));
    expect(screen.queryByRole('columnheader', { name: /Team/ })).toBeNull();
    unmount();
    render(<DataTable columns={COLUMNS} rows={PEOPLE} storageKey="people" />);
    expect(screen.queryByRole('columnheader', { name: /Team/ })).toBeNull();
  });

  it('exports every matching row with the visible columns only', async () => {
    render(<DataTable columns={COLUMNS} rows={PEOPLE} exportFileName="people" />);
    await userEvent.type(screen.getByRole('searchbox'), 'sales');
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Export CSV/ }));
    const [file, rows] = exportToCsv.mock.calls[0];
    expect(file).toBe('people');
    expect(rows).toHaveLength(15);
    expect(Object.keys(rows[0])).toEqual(['Name', 'Team', 'Days']);
  });
});
