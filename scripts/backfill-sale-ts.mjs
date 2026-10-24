// Backfill `ts` (epoch millis) onto existing cloud sales.
//
// WHY: v2.6.2 writes `ts` on every NEW sale, but old sales only carry the
// ambiguous `timestamp` string (mobile ISO local wall-clock vs desktop
// SQLite UTC strings). Future server-side date queries filter on `ts`, so
// old sales need it too — otherwise range queries silently drop them.
//
// DO NOT RUN CASUALLY. Prerequisites, in order:
//   1. A verified backup of the shop laptop database (v2.6.0+ auto-backups
//      live in <userData>/backups/) AND a copy of the cloud sales node.
//   2. A quiet shop window (no billing during the run).
//   3. The Firebase Anonymous sign-in provider enabled in console (the
//      script signs in anonymously, like the desktop sync).
//   4. The user's explicit go-ahead.
//
// SAFETY: dry-run is the DEFAULT — it only reads and reports. Pass --apply
// to actually write. The run is idempotent and resumable: sales that
// already have a valid `ts` are skipped, so re-running after an
// interruption only processes the remainder. Unparseable timestamps are
// reported and SKIPPED, never guessed.
//
// Config via environment (same names as the desktop .env):
//   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN,
//   FIREBASE_DATABASE_URL (default: https://ssmart-c6e43-default-rtdb.firebaseio.com),
//   FIREBASE_PROJECT_ID
//
// Usage:
//   node scripts/backfill-sale-ts.mjs            # dry run (report only)
//   node scripts/backfill-sale-ts.mjs --apply    # actually write
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';
import { parseSaleTimestampToEpochMs } from './sale-timestamp.mjs';

const APPLY = process.argv.includes('--apply');
const CHUNK_SIZE = 200;

const apiKey = process.env.FIREBASE_API_KEY;
const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://ssmart-c6e43-default-rtdb.firebaseio.com';
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!apiKey || !authDomain || !projectId) {
  console.error(
    'Missing Firebase config. Set FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN and ' +
      'FIREBASE_PROJECT_ID (FIREBASE_DATABASE_URL optional).',
  );
  process.exit(2);
}

if (!APPLY) {
  console.log('DRY RUN — nothing will be written. Pass --apply to write.\n');
}

const app = initializeApp({ apiKey, authDomain, databaseURL, projectId });
await signInAnonymously(getAuth(app));
const db = getDatabase(app);

const snap = await get(ref(db, 'sales'));
if (!snap.exists()) {
  console.log('No sales node found. Nothing to do.');
  process.exit(0);
}

const sales = snap.val();
const keys = Object.keys(sales);
let already = 0;
let queued = 0;
const unparseable = [];
const updates = {};

for (const key of keys) {
  const sale = sales[key];
  if (!sale || typeof sale !== 'object') continue;
  if (typeof sale.ts === 'number' && Number.isFinite(sale.ts)) {
    already++;
    continue;
  }
  const ts = parseSaleTimestampToEpochMs(sale.timestamp);
  if (ts === null) {
    unparseable.push({ key, timestamp: sale.timestamp ?? null });
    continue;
  }
  updates[`sales/${key}/ts`] = ts;
  queued++;
}

console.log(`Sales scanned: ${keys.length}`);
console.log(`Already have ts: ${already}`);
console.log(`To backfill:    ${queued}`);
console.log(`Unparseable (skipped): ${unparseable.length}`);
if (unparseable.length > 0) {
  console.log('First 20 unparseable:');
  for (const u of unparseable.slice(0, 20)) console.log(' ', u);
}

if (queued === 0) {
  console.log('Nothing to write.');
  process.exit(0);
}
if (!APPLY) {
  console.log('\nDry run complete. Re-run with --apply to write.');
  process.exit(0);
}

const entries = Object.entries(updates);
for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
  const chunk = Object.fromEntries(entries.slice(i, i + CHUNK_SIZE));
  await update(ref(db), chunk);
  console.log(`Wrote ${Math.min(i + CHUNK_SIZE, entries.length)}/${entries.length}`);
}
console.log('Backfill complete. Re-run anytime to verify (all should report as already having ts).');
