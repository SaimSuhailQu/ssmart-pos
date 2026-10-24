# SSmart POS — Architecture & Sync Map

Read this before touching sync, keys, or releases. It records what is true
in code as of v2.6.0, including the traps.

## The three pieces

| Piece | Local store | Cloud access |
| --- | --- | --- |
| Desktop POS (Electron, shop laptop) | SQLite (`mart-pos.db` in userData) via better-sqlite3 | Delta sync engine (`src/syncEngine.ts`): 60s push + realtime pull + full pass on connect |
| Mobile admin (Flutter, Android + iOS) | None (Firebase offline persistence cache only) | Direct RTDB reads/writes (`flutter_admin_app/lib/services/firebase_service.dart`) |
| Firebase RTDB (`ssmart-c6e43`) | — | The meeting point. There is no other backend. |

## Nodes: who writes, who reads, what is truth

| Node | Desktop | Mobile | Source of truth |
| --- | --- | --- | --- |
| `customers` | Push (keyed by SQLite numeric id) + pull | Read + write | The row itself; no derived fields except `balance` (see below) |
| `customer_khata/<cid>/<entry>` | Push + pull | Read + write | **The entries.** Balances are derived, never authoritative |
| `customers/<id>/balance` | Recomputed from local khata, pushed | Written after entry (optimistic, then corrected by recompute) | Derived from `customer_khata` — never edit it by hand |
| `vendors`, `purchase_orders` (incl. `payments[]`, `paid_amount`) | Push + pull | Read + write (vendor payments are RTDB transactions) | The PO record itself |
| `sales`, `products`, `expenses` | Push + pull | Sales read; products read | The record itself |
| `deleted_khata_entries` | Push (tombstones) + pull | Read (filters resurrected entries) | Tombstone wins over re-upload |
| `daily_closings`, `items_to_bring` | **Not synced** (desktop has no such tables/UI) | Read + write | Mobile only, by design gap — see below |
| `tenants/<id>/…` | Sold copies only, via `setTenant()` | Never (owner app uses root paths) | Per-tenant isolation, gated by `tenantOwners` |
| `licenses/<fp>`, `tenant_map/<fp>` | Read at startup via an **unauthenticated** app instance | Owner app reads `licenses` | See security note |

## Key schemes (the historical confusion, settled)

- Desktop customers: SQLite numeric id, pushed as `customers/<numericId>`.
- Mobile-created customers: millisecond-timestamp strings as node key and id.
- Legacy push-key customers may exist from older versions. Desktop ingest
  maps non-numeric customer keys to fresh numeric rows (losing the link)
  and drops non-numeric khata keys with a warning. Current writers never
  produce push keys, so this is a legacy edge case, not a live flow. Do
  not "fix" it with a migration without a verified backup and a window.

## Sync mechanics that must not be broken

- Desktop push is **delta by content hash** (`pushDelta`): unchanged keys
  cost nothing. Do not replace it with full-node writes.
- Desktop pull is **realtime + debounced ingest** (1s) plus a full
  bidirectional pass on connect. Ingest order matters: customers before
  khata (so placeholder customers exist when entries land).
- Mobile khata list balances come from an **in-memory cache keyed by the
  `customer_khata` node key**, maintained incrementally by child events.
  The stored `customers/<id>/balance` is only a fallback.
- Mobile vendor payments use RTDB **transactions** (`_transactPurchaseOrder`).
  Do not downgrade them to get-then-set: that was the Oct 2026 lost-update
  bug class.
- Auth: desktop sync uses **anonymous Firebase Auth**; the rules require
  `auth != null` on business nodes. The header dot reports `AUTH_BLOCKED`
  (not just socket state) when sign-in fails terminally. If it ever says
  "Sync blocked", check Firebase Console → Authentication → Anonymous
  provider first.

## Failover: the laptop is down

1. Keep billing from the mobile checkout. Mobile sales write straight to
   RTDB, so nothing is lost while the laptop is off.
2. Receipt printing needs the laptop (`print_requests` queue) — paper
   receipts pause; billing does not.
3. When the laptop returns, its sync worker ingests cloud sales on
   connect. Verify the day's totals match before resuming normal billing.
4. If the laptop's database is corrupt or the disk dies: stop the app,
   copy the newest file from `<userData>/backups/` over `mart-pos.db`,
   restart. Backups are automatic (daily, kept 30 days) since v2.6.0.

## Download model: why usage blew past 10 GB (Oct 2026) and what stops it

Realtime Database bills by GB downloaded, and an `onValue` listener
re-downloads its WHOLE node on every change, to every subscriber. The
shop DB is only ~33 MB, but every app start, reconnect, screen rebuild,
and single-field change re-pulled whole collections — ~300 full copies
in one month (10.47 GB vs the 10 GB free cap). The vendors screen alone
held four simultaneous purchase-order subscriptions.

Since v2.6.1 the mobile app uses ONE shared child-event subscription per
collection (`core/utils/incremental_collection.dart`): `onChildAdded` /
`onChildChanged` / `onChildRemoved` download only the changed child, the
emitted list is rebuilt from local state, new UI listeners replay the
current list instead of re-downloading, and the subscription detaches
5 s after the last listener leaves. A change now costs one child, not
the node — but the FIRST sight of a collection still downloads it in
full, which is unavoidable. The desktop's pull triggers use child events
the same way (its debounced full-node ingest still runs once per change,
so desktop per-change cost halves rather than vanishing).

Deliberately NOT done in v2.6.1: server-side date scoping for sales
("today" views still receive full history on first attach). It is unsafe
until sale timestamps are normalized — mobile writes ISO strings,
desktop writes space-separated SQLite datetimes, and lexicographic
`orderByChild` range queries would silently drop one writer's rows.
Normalizing sale timestamps to epoch millis is the precondition. The
per-customer khata stream stays on `onValue`: it is one small node, and
its tombstone check already costs a read per event.

v2.6.2: the desktop's debounced ingest no longer re-fetches the full node
per change — child events are batched over 1 s and the EXISTING handlers
run on the batch only (handlers already upsert record by record, so no
handler logic changed; the full pass on connect still runs as the offline
safety net). New sales carry `ts` (epoch millis) from both writers, so
date queries can filter on `ts` later. Timestamp semantics, recorded here
because they are a landmine: mobile ISO strings without offset are shop
local wall-clock (PKT); desktop space-separated strings are UTC wall-clock
(SQLite CURRENT_TIMESTAMP); ISO with offset/Z is exact. The parsers
(`parseSaleTimestampToEpochMs` in src/syncEngine.ts, mirrored in
scripts/sale-timestamp.mjs) encode exactly these rules and return null
rather than guess. `scripts/backfill-sale-ts.mjs` (dry-run by default,
--apply writes, idempotent/resumable) adds `ts` to old sales — it is
WRITTEN, not run: it needs a verified backup + quiet shop window + the
owner's go-ahead, and the Anonymous provider enabled. Corner case:
manual daily-closing sales stamped `${date} 23:59:59` from a local date
get a `ts` ~5 h off (space strings parse as UTC); one record per day,
only future ts-based views affected.

## Money migration (integer paisa)

Implemented and tested (`src/main/db/moneyMigration.ts`, idempotent,
takes its own VACUUM INTO backup). **Not yet run on the live shop DB.**
It needs a maintenance window + a verified backup first, and the shop
closed while it runs. Do not run it casually; do not run it from this
chat's machine (the live DB is not here).

## Release process (enforced, not just documented)

Every release bumps **three** version sources together, or the iOS tag
build fails: `flutter_admin_app/pubspec.yaml`, `package.json`, and
`livecontainer_source.json` (version + downloadURL + news item). Then
CHANGELOG entry, commit, push, tag `vX.Y.Z`, push tag, verify all three
workflows (Electron, APK, iOS) and the release assets. `flutter test`
runs in the APK workflow and blocks the release on failure. The
SideStore feed went stale at v2.5.5 for ten releases before this guard
existed — that is why the guard exists.

## Known accepted gaps (do not "discover" them again)

- `daily_closings` and `items_to_bring` have no desktop sync: the desktop
  app does not implement those features. Adding sync means adding the
  tables and UI first.
- `licenses/<fp>` and `tenant_map/<fp>` are publicly readable **on
  purpose**: the desktop licensing flow reads them before any sign-in
  exists. Tightening them breaks activation. The real fix (authenticated
  license reads) is a startup-flow change, not a rules edit.
- The mobile owner allowlist (`OwnerConfig`) is client-side only. True
  server-side owner enforcement is not achievable with anonymous desktop
  auth in RTDB rules alone; the deployed rules + anonymous-provider
  requirement are the current hardening.
- `database.rules.json` must be deployed (`firebase deploy --only
  database`, wired via `firebase.json`) and the Anonymous provider
  enabled. Until then, live rules are whatever the console holds, and
  this file is only a promise.
