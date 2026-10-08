import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAssistantWelcome,
  getDisplayName,
  getWelcomeGreeting,
  vettriMicrocopy,
} from './vettriMicrocopy.js';

test('display names are taken from authenticated user data and fall back safely', () => {
  assert.equal(getDisplayName({ fullName: '  Avery Employee  ' }), 'Avery Employee');
  assert.equal(getDisplayName({ firstName: 'Avery', lastName: 'Employee' }), 'Avery Employee');
  assert.equal(getDisplayName({ name: 'Avery' }), 'Avery');
  assert.equal(getDisplayName({ fullName: '  ' }, 'You'), 'You');
});

test('dashboard greetings use the time of day and real display name', () => {
  assert.equal(
    getWelcomeGreeting({ fullName: 'Avery Employee' }, new Date(2026, 0, 1, 9)),
    '☀️ Good morning, Avery Employee.'
  );
  assert.equal(
    getWelcomeGreeting({ fullName: 'Avery Employee' }, new Date(2026, 0, 1, 14)),
    '👋 Good afternoon, Avery Employee.'
  );
  assert.equal(
    getWelcomeGreeting({ fullName: 'Avery Employee' }, new Date(2026, 0, 1, 20)),
    '🌙 Good evening, Avery Employee.'
  );
  assert.equal(
    getWelcomeGreeting({}, new Date(2026, 0, 1, 9)),
    '👋 Welcome back.'
  );
});

test('Ask Vettri greeting is personalized without assuming a name', () => {
  assert.equal(getAssistantWelcome({ fullName: 'Avery Employee' }), '👋 Hey Avery Employee. What can I help you with today?');
  assert.equal(getAssistantWelcome(null), '👋 Hi there. What can I help you with today?');
});

test('microcopy categories remain available as a centralized catalog', () => {
  for (const category of ['welcome', 'loading', 'success', 'empty', 'error', 'permission', 'assistant']) {
    assert.equal(typeof vettriMicrocopy[category], 'object');
  }
  assert.equal(vettriMicrocopy.error.generic.includes('SQL'), false);
  assert.equal(vettriMicrocopy.permission.generic.includes('Contact your Admin team'), true);
});
