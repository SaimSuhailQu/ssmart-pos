// Sync-health state machine for the desktop header (pure, no imports, so it
// can be unit-tested without Firebase or Electron).
//
// - lastSuccessfulSyncAt: epoch ms of the last sync cycle that completed
//   without error (full pass, batched ingest flush, or push). Null until
//   the first success. A no-op cycle that confirms "nothing to do" still
//   counts: if cycles start failing, the timestamp freezes at the last
//   good one, which is exactly the diagnostic value.
// - failedWrites: count of genuine cloud-WRITE failures since launch.
//   It increments ONLY when a Firebase set/update call throws while the
//   engine is running. It deliberately does NOT increment for:
//   - offline-only mode / no Firebase configured (early return, no attempt),
//   - normal offline queueing (writes never attempted),
//   - auth failures (reported separately as AUTH_BLOCKED),
//   - ingest/read failures (reads, not writes),
//   - print-job failures (not sync).
// The count is per failed operation call, not per key, so a failed chunked
// push counts once.

export interface SyncHealthSnapshot {
  lastSuccessfulSyncAt: number | null;
  failedWrites: number;
}

export interface SyncHealth {
  recordSuccess(nowMs?: number): void;
  recordFailedWrite(): void;
  snapshot(): SyncHealthSnapshot;
}

export function createSyncHealth(): SyncHealth {
  let lastSuccessfulSyncAt: number | null = null;
  let failedWrites = 0;
  return {
    recordSuccess(nowMs: number = Date.now()): void {
      lastSuccessfulSyncAt = nowMs;
    },
    recordFailedWrite(): void {
      failedWrites += 1;
    },
    snapshot(): SyncHealthSnapshot {
      return { lastSuccessfulSyncAt, failedWrites };
    },
  };
}
