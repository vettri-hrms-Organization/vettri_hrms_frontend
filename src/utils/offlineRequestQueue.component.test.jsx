import { beforeEach, describe, expect, it } from 'vitest';

import { clearQueue, queueRequestForRetry, readQueue } from './offlineRequestQueue.js';

function buildRequest(companyId, overrides = {}) {
  return {
    method: 'POST',
    url: '/api/employee-documents',
    baseURL: '',
    params: { page: 1 },
    data: { employeeId: '123' },
    headers: { 'X-Company-Id': companyId },
    ...overrides,
  };
}

describe('offline queue tenant scoping', () => {
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
});
