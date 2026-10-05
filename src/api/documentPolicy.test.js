import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReviewDocuments,
  canUploadOwnDocuments,
  getExpiryPresentation,
} from './documentPolicy.js';

test('employees can upload only their own documents', () => {
  const employee = { employeeId: 4268, roles: ['EMPLOYEE'], permissions: ['EMPLOYEE_VIEW'] };

  assert.equal(canUploadOwnDocuments(employee, 4268), true);
  assert.equal(canUploadOwnDocuments(employee, 4269), false);
});

test('HR reviewers cannot upload documents and can review with the existing manage permission', () => {
  const hr = { employeeId: 100, roles: ['HR_ADMIN'], permissions: ['EMPLOYEE_MANAGE'] };
  const customHr = { employeeId: 101, roles: ['CUSTOM_HR'], permissions: ['EMPLOYEE_MANAGE'] };

  assert.equal(canUploadOwnDocuments(hr, 100), false);
  assert.equal(canUploadOwnDocuments(customHr, 101), false);
  assert.equal(canReviewDocuments(hr), true);
  assert.equal(canReviewDocuments(customHr), true);
});

test('Aadhaar and PAN always display expiry as not applicable', () => {
  for (const documentType of ['AADHAAR', 'PAN']) {
    assert.equal(getExpiryPresentation({
      documentType,
      expiryDate: '1970-01-01',
    }).date, 'Not applicable');
    assert.equal(getExpiryPresentation({ documentType, expiryDate: null }).label, null);
  }
});

test('a null expiry date is not interpreted as the Unix epoch', () => {
  assert.deepEqual(getExpiryPresentation({ documentType: 'PASSPORT', expiryDate: null }), {
    date: '—',
    label: null,
    color: 'var(--hz-text-secondary)',
  });
});

test('applicable document expiry still receives expiry status', () => {
  const expired = getExpiryPresentation(
    { documentType: 'PASSPORT', expiryDate: '2026-01-01' },
    new Date(2026, 0, 2)
  );

  assert.equal(expired.date, new Date(2026, 0, 1).toLocaleDateString());
  assert.equal(expired.label, 'Expired');
});
