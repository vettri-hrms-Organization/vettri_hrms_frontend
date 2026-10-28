import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGstin, normalizeGstin } from './gstin.js';

test('accepts GSTINs with a valid check digit', () => {
  assert.equal(isValidGstin('27AAPFU0939F1ZV'), true);
  assert.equal(isValidGstin(' 29aagcb7383j1z4 '), true);
});

test('rejects malformed or tampered GSTINs', () => {
  assert.equal(isValidGstin('27AAPFU0939F1ZA'), false);
  assert.equal(isValidGstin('27AAPFU0939F1Z'), false);
  assert.equal(isValidGstin(''), false);
  assert.equal(normalizeGstin(' ab c '), 'ABC');
});
