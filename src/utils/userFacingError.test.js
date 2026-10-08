import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLoginError, mapIdentifierError, mapPasswordError } from './errorMapping.js';
import { notifyableStatus, userFacingError } from './userFacingError.js';
import { vettriMicrocopy } from './vettriMicrocopy.js';

function apiError(status, message, config = {}) {
  return {
    response: { status, data: { message } },
    config,
  };
}

test('network and server errors map to short Vettri messages, not raw technical details', () => {
  assert.equal(userFacingError({ code: 'ERR_NETWORK' }), vettriMicrocopy.error.network);
  assert.equal(
    userFacingError(apiError(500, 'org.postgresql.DatabaseException: internal details')),
    vettriMicrocopy.error.generic
  );
  assert.equal(
    userFacingError({ response: { status: 500 }, message: 'Request failed with status code 500' }),
    vettriMicrocopy.error.generic
  );
});

test('validation keeps readable user guidance and hides technical or structured server messages', () => {
  assert.equal(
    userFacingError(apiError(422, 'Please select an employee before continuing.')),
    'Please select an employee before continuing.'
  );
  assert.equal(
    userFacingError(apiError(400, 'SQL syntax error near SELECT * FROM employee')),
    vettriMicrocopy.error.validation
  );
  assert.equal(
    userFacingError(apiError(422, '{"exception":"secret implementation detail"}')),
    vettriMicrocopy.error.validation
  );
});

test('permission and not-found messages do not reveal internal details', () => {
  assert.equal(
    userFacingError(apiError(403, 'Access denied: DEVICE_MANAGE permission is required')),
    vettriMicrocopy.permission.generic
  );
  assert.equal(
    userFacingError(apiError(404, 'Employee record was removed from PostgreSQL')),
    vettriMicrocopy.error.notFound
  );
});

test('safe business messages are retained for conflict and validation cases', () => {
  assert.equal(userFacingError(apiError(409, 'Employee already exists.')), 'Employee already exists.');
  assert.equal(userFacingError(apiError(400, 'The invitation has expired.')), 'The invitation has expired.');
  assert.equal(notifyableStatus(apiError(403, 'permission denied')), true);
});

test('authentication error mapping uses consistent, non-technical copy', () => {
  assert.equal(mapLoginError({ message: 'Network Error' }), vettriMicrocopy.error.network);
  assert.equal(
    mapLoginError(apiError(403, 'Unknown authorization detail')),
    vettriMicrocopy.permission.generic
  );
  assert.equal(mapIdentifierError({ message: 'Network Error' }), vettriMicrocopy.error.network);
  assert.equal(mapPasswordError({ message: 'Network Error' }), vettriMicrocopy.error.network);
  assert.equal(mapLoginError(apiError(500, 'Java stack trace')), vettriMicrocopy.error.generic);
});
