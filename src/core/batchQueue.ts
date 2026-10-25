// Batched per-child ingest queue (extracted verbatim from src/syncEngine.ts,
// v2.6.2 inline implementation, so it can be unit-tested without Firebase).
//
// Semantics, preserved exactly:
// - Child-event snapshots ARE the data: the debounced handler runs on ONLY
//   the children that changed in the window — no full-node fetch.
// - The debounce timer RESETS on every new change for that node, so a burst
//   collapses into a single handler run.
// - Removals are tracked only to avoid upserting a child deleted inside the
//   window; whether a removed key is deleted locally is the CALLER's choice
//   (it receives the `removed` set). Most handlers do not delete records
//   absent from input, same as full-node ingest.
// - The pending batch is snapshotted and cleared BEFORE the handler runs,
//   so changes arriving during a handler run start a fresh batch (never lost).
// - onFlushed fires only on handler success; onError fires instead on failure.
// - A null key is ignored (child events always carry a key; defensive only).

export type BatchRecords = Record<string, unknown>;

export interface BatchFlush {
  name: string;
  records: BatchRecords;
  removed: Set<string>;
}

export interface BatchQueueOptions {
  debounceMs?: number;
  onFlush: (flush: BatchFlush) => Promise<void> | void;
  onFlushed?: (flush: BatchFlush) => void;
  onError?: (flush: BatchFlush, err: unknown) => void;
}

export interface BatchQueue {
  enqueue(name: string, key: string | null, value: unknown, isRemoval: boolean): void;
}

export function createBatchQueue(options: BatchQueueOptions): BatchQueue {
  const debounceMs = options.debounceMs ?? 1000;
  const pending = new Map<string, { records: BatchRecords; removed: Set<string> }>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const enqueue = (name: string, key: string | null, value: unknown, isRemoval: boolean): void => {
    if (key === null) return;
    let batch = pending.get(name);
    if (!batch) {
      batch = { records: {}, removed: new Set<string>() };
      pending.set(name, batch);
    }
    if (isRemoval) {
      delete batch.records[key];
      batch.removed.add(key);
    } else {
      batch.records[key] = value;
      batch.removed.delete(key);
    }
    const existing = timers.get(name);
    if (existing) clearTimeout(existing);
    timers.set(name, setTimeout(() => {
      timers.delete(name);
      const ready = pending.get(name);
      pending.delete(name);
      if (!ready) return;
      const flush: BatchFlush = { name, records: ready.records, removed: ready.removed };
      Promise.resolve()
        .then(() => options.onFlush(flush))
        .then(() => options.onFlushed?.(flush))
        .catch((err: unknown) => options.onError?.(flush, err));
    }, debounceMs));
  };

  return { enqueue };
}
