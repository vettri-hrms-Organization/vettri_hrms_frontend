import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNotificationsByDay, isNotificationRead } from './notificationDisplay.js';

test('notifications are grouped by local calendar day', () => {
  const now = new Date(2026, 5, 15, 12);
  const grouped = groupNotificationsByDay([
    { id: 1, created_at: new Date(2026, 5, 15, 8).toISOString() },
    { id: 2, created_at: new Date(2026, 5, 14, 8).toISOString() },
    { id: 3, created_at: new Date(2026, 5, 10, 8).toISOString() },
  ], now);

  assert.deepEqual(grouped.map((group) => group.label), ['Today', 'Yesterday', new Date(2026, 5, 10).toLocaleDateString()]);
  assert.deepEqual(grouped.map((group) => group.items.length), [1, 1, 1]);
});

test('read status comes from the persisted read timestamp', () => {
  assert.equal(isNotificationRead({ read_at: null }), false);
  assert.equal(isNotificationRead({ read_at: '2026-06-15T10:00:00' }), true);
});
