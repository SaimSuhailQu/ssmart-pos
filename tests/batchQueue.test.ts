// Unit tests for src/core/batchQueue.ts (the v2.6.2 batched per-child ingest
// queue, extracted so it can run without Firebase or Electron).
// Run with: npm test  (node --test, no extra dependencies)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBatchQueue, type BatchFlush } from '../src/core/batchQueue.ts';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Debounce used by every test: short enough to keep the suite fast, long
// enough that a 15ms gap is unambiguously "inside the window".
const DEBOUNCE = 30;

test('multiple child changes within one window collapse into one handler run', async () => {
  const flushes: BatchFlush[] = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => { flushes.push(f); },
  });
  q.enqueue('sales', '1', { total: 100 }, false);
  q.enqueue('sales', '2', { total: 200 }, false);
  q.enqueue('sales', '1', { total: 150 }, false); // same child changed twice
  await sleep(120);
  assert.equal(flushes.length, 1);
  assert.equal(flushes[0].name, 'sales');
  assert.deepEqual(Object.keys(flushes[0].records).sort(), ['1', '2']);
  // Latest value wins for a child changed twice in the window.
  assert.equal((flushes[0].records['1'] as { total: number }).total, 150);
});

test('debounce timer resets on every new change', async () => {
  const flushes: BatchFlush[] = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => { flushes.push(f); },
  });
  q.enqueue('products', 'a', { name: 'Milk' }, false);
  await sleep(15); // still inside the window
  q.enqueue('products', 'b', { name: 'Bread' }, false); // resets the timer
  await sleep(15); // 30ms after the FIRST change, but only 15 after the last
  assert.equal(flushes.length, 0);
  await sleep(40);
  assert.equal(flushes.length, 1);
  assert.deepEqual(Object.keys(flushes[0].records).sort(), ['a', 'b']);
});

test('removal mid-window drops the record and reports the key as removed', async () => {
  const flushes: BatchFlush[] = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => { flushes.push(f); },
  });
  q.enqueue('items_to_bring', '10', { name: 'Sugar' }, false);
  q.enqueue('items_to_bring', '11', { name: 'Flour' }, false);
  q.enqueue('items_to_bring', '10', null, true); // deleted before the flush
  await sleep(120);
  assert.equal(flushes.length, 1);
  assert.deepEqual(Object.keys(flushes[0].records), ['11']);
  assert.deepEqual([...flushes[0].removed], ['10']);
});

test('a child removed then re-added in the same window survives', async () => {
  const flushes: BatchFlush[] = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => { flushes.push(f); },
  });
  q.enqueue('items_to_bring', '10', null, true);
  q.enqueue('items_to_bring', '10', { name: 'Sugar' }, false);
  await sleep(120);
  assert.equal(flushes.length, 1);
  assert.deepEqual(Object.keys(flushes[0].records), ['10']);
  assert.equal(flushes[0].removed.size, 0);
});

test('separate nodes flush independently with their own records', async () => {
  const flushes: BatchFlush[] = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => { flushes.push(f); },
  });
  q.enqueue('sales', '1', { total: 1 }, false);
  q.enqueue('daily_closings', '9', { total: 9 }, false);
  await sleep(120);
  assert.equal(flushes.length, 2);
  const byName = new Map(flushes.map((f) => [f.name, f]));
  assert.deepEqual(Object.keys(byName.get('sales')!.records), ['1']);
  assert.deepEqual(Object.keys(byName.get('daily_closings')!.records), ['9']);
});

test('null keys are ignored and never schedule a flush', async () => {
  const flushes: BatchFlush[] = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => { flushes.push(f); },
  });
  q.enqueue('sales', null, { total: 1 }, false);
  await sleep(120);
  assert.equal(flushes.length, 0);
});

test('a failing handler reports the error, skips onFlushed, and does not block other nodes', async () => {
  const flushed: BatchFlush[] = [];
  const errors: Array<{ name: string }> = [];
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: (f) => {
      if (f.name === 'bad') throw new Error('boom');
    },
    onFlushed: (f) => { flushed.push(f); },
    onError: (f) => { errors.push({ name: f.name }); },
  });
  q.enqueue('bad', '1', { x: 1 }, false);
  q.enqueue('good', '2', { x: 2 }, false);
  await sleep(120);
  assert.deepEqual(errors.map((e) => e.name), ['bad']);
  assert.deepEqual(flushed.map((f) => f.name), ['good']);
});

test('changes arriving during a handler run start a fresh batch, never lost', async () => {
  const flushes: BatchFlush[] = [];
  let resolveFirst: (() => void) | null = null;
  const firstDone = new Promise<void>((r) => { resolveFirst = r; });
  const q = createBatchQueue({
    debounceMs: DEBOUNCE,
    onFlush: async (f) => {
      flushes.push(f);
      if (flushes.length === 1) {
        // A change lands while this flush is still running.
        q.enqueue('sales', 'late', { total: 999 }, false);
        await firstDone;
      }
    },
  });
  q.enqueue('sales', '1', { total: 1 }, false);
  await sleep(120); // first flush starts (and blocks); the late change's
  // fresh batch flushes independently in the meantime — not dropped,
  // and not merged into the in-flight batch.
  assert.equal(flushes.length, 2);
  assert.deepEqual(Object.keys(flushes[0].records), ['1']);
  assert.deepEqual(Object.keys(flushes[1].records), ['late']);
  resolveFirst!();
  await sleep(50);
  assert.equal(flushes.length, 2); // no duplicate flush once unblocked
});
