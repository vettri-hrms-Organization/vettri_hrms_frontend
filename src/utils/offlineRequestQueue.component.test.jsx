import { beforeEach, describe, expect, it } from 'vitest';

import { clearQueue, queueRequestForRetry, readQueue } from './offlineRequestQueue.js';

function buildRequest(companyId, overrides = {}) {
  return {
    method: 'GET',
    url: '/api/employee-documents',
    baseURL: '',
    params: { page: 1 },
    data: { employeeId: '123' },
    headers: { 'X-Company-Id': companyId },
    ...overrides,
  };
}

describe('offline queue tenant scoping', () => {
  it('never queues writes, which may already have been applied on the server', () => {
    localStorage.clear();
    clearQueue();
    expect(queueRequestForRetry(buildRequest('company-1', { method: 'POST' }), new Error('timeout'))).toBe(false);
    expect(queueRequestForRetry(buildRequest('company-1', { method: 'patch' }), new Error('timeout'))).toBe(false);
    expect(readQueue()).toHaveLength(0);
  });

  beforeEach(() => {
    localStorage.clear();
    clearQueue();
  });

  it('keeps queued requests distinct across different companies', () => {
    const first = buildRequest('company-1');
    const second = buildRequest('company-2');
    const duplicate = buildRequest('company-1');

    expect(queueRequestForRetry(first, new Error('offline'))).toBe(true);
    expect(queueRequestForRetry(second, new Error('offline'))).toBe(true);
    expect(queueRequestForRetry(duplicate, new Error('offline'))).toBe(false);

    const queue = readQueue();
    expect(queue).toHaveLength(2);
    expect([...new Set(queue.map((item) => item.headers['X-Company-Id']))].sort()).toEqual(['company-1', 'company-2']);
  });

  it('does not persist auth or password reset requests in the offline queue', () => {
    const loginRequest = buildRequest('company-1', {
      url: '/api/auth/login',
      data: { username: 'admin', password: 'secret-pass', remember: true },
      headers: { 'X-Company-Id': 'company-1', Authorization: 'Bearer abc' },
    });

    const resetRequest = buildRequest('company-1', {
      url: '/api/auth/reset-password',
      data: { token: 'abc123', password: 'newPass123!', confirmPassword: 'newPass123!' },
    });

    expect(queueRequestForRetry(loginRequest, new Error('offline'))).toBe(false);
    expect(queueRequestForRetry(resetRequest, new Error('offline'))).toBe(false);
    expect(readQueue()).toHaveLength(0);
  });
});
