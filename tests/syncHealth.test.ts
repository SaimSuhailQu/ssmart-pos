// Unit tests for src/core/syncHealth.ts (header sync-health state).
// Run with: npm test  (node --test, no extra dependencies)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyncHealth } from '../src/core/syncHealth.ts';

test('starts with no successful sync and zero failed writes', () => {
  const h = createSyncHealth();
  assert.deepEqual(h.snapshot(), { lastSuccessfulSyncAt: null, failedWrites: 0 });
});

test('recordSuccess stamps the given time and leaves failedWrites alone', () => {
  const h = createSyncHealth();
  h.recordFailedWrite();
  h.recordSuccess(1700000000000);
  assert.deepEqual(h.snapshot(), { lastSuccessfulSyncAt: 1700000000000, failedWrites: 1 });
});

test('recordFailedWrite increments once per call', () => {
  const h = createSyncHealth();
  h.recordFailedWrite();
  h.recordFailedWrite();
  assert.equal(h.snapshot().failedWrites, 2);
  assert.equal(h.snapshot().lastSuccessfulSyncAt, null);
});

test('snapshot returns a copy: mutating it does not corrupt internal state', () => {
  const h = createSyncHealth();
  h.recordSuccess(1000);
  const snap = h.snapshot();
  (snap as { failedWrites: number }).failedWrites = 99;
  (snap as { lastSuccessfulSyncAt: number | null }).lastSuccessfulSyncAt = 5;
  assert.deepEqual(h.snapshot(), { lastSuccessfulSyncAt: 1000, failedWrites: 0 });
});
