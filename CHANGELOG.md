# Changelog

All notable changes to SSmart POS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/).

## [2.4.1] — 2026-10-07

Semantic color system for the mobile admin app: green means good, red means bad — across the whole app. Reverts the v2.4.0 all-text-red direction; Noir Graphite stays.

### Fixed (mobile admin app)
- **Red accent no longer works against the theme:** `AppTheme` / `GraphiteTheme` text styles are monochrome again (platinum/ink/slate); the `textRed` family consts are removed.
- **Green = good, red = bad:** revenue/collection hero numerals render green when money is in (platinum at zero); dues, payables, udhaar, expenses out, and negative deltas render red; neutral chrome stays platinum.
- **Dashboard delta indicators:** new `DeltaDirection` (up/down/flat/none) — positive deltas green ▲, negative red ▼, exactly 0.0% neutral gray •, and plain captions (e.g. "completed today") no longer show a fake arrow. Fixed a double-arrow rendering bug on the revenue card.
- **Currency unified:** dashboard hero, metric card, sales chart, and khata hero all use PKR.

### Release engineering
- Bumped version to 2.4.1 (desktop `package.json`), 2.4.1+38 (mobile `pubspec.yaml`), and updated LiveContainer source feed to v2.4.1.

## [2.4.0] — 2026-10-07

Crimson editorial theme, Customer Khata correctness fixes, and record delete/edit reliability pass.

### Fixed (mobile admin app)
- **Khata shop-wide total no longer goes negative:** the hero total now sums only positive customer balances. Individual negative balances (customer overpaid / advance credit) no longer drag the shop-wide udhaar total below zero (PKR -7808 case). Overpaid customers are labelled **Advance / Credit**.
- **Customer / Vendor / Khata record delete & edit bug fixed:** desktop-created records use RTDB push keys (`-NxYz…`) while the model `id` could be a legacy numeric id, so deletes silently missed and edits duplicated. Models now carry the RTDB node `key` (`dbKey`), and delete/edit resolve the correct path — deleting both legacy and keyed nodes.
- **Clipped action icons fixed:** the customer card action row uses a `Wrap` layout with compact icon buttons, so the delete (trash) icon is no longer clipped at the card's right edge on narrow screens.

### Changed (mobile admin app)
- **Crimson editorial theme:** all white text retargeted to the red family (`AppTheme.textRed` / `textSecondaryRed` / `textTertiaryRed`, `GraphiteTheme.redAccent` / `redBright` / `redSoft`) across Dashboard hero, Khata screen & details sheet, Vendors & PO details, Mobile checkout, Daily closings, Catalog, Expenses, Transactions, License gate, and error/loading widgets. Functional colors (success green, WhatsApp brand green) and on-red button content remain as designed.
- **Unified typography:** Inter remains the single app-wide font.
- **Last amber/purple stragglers removed:** vendor PO header avatar and PDF export action, and checkout customer icons now use the red accent system.

### Added (mobile admin app)
- **"Today's Collection" hero redesign:** crimson-tinted gradient surface with dual radial glows, animated shimmer sweep, red hairline top highlight, glowing PKR numerals, shield eyebrow badge, and red-tinted meta dividers.

### Stability
- **CRUD error surfacing:** Khata create/update/delete operations are wrapped in a `_runCrud` helper that surfaces failures with a red error snackbar instead of failing silently, and mutations complete before navigation (pop-before-await removed).
- **Khata balance cache clamp:** per-customer cached balances are clamped to ≥ 0 so legacy negative nodes cannot skew aggregates.

### Release engineering
- Bumped version to 2.4.0 (desktop `package.json`), 2.4.0+37 (mobile `pubspec.yaml`), and updated LiveContainer source feed to v2.4.0.

## [2.3.6] — 2026-10-06

Surface depth, ambient mesh lighting, elevated empty states & design polish for the mobile admin app.

### Changed (mobile admin app)
- **Ambient Lighting Mesh:** Enabled `graphiteAmbience` across all `LiquidScaffold` instances by default for smooth platinum lighting.
- **Card Surface Depth & Highlights:** Added layered drop shadows, specular top edge hairline bevels (`specularCardDecoration`, `cardSpecularHighlight`), and soft luminous platinum edge glow.
- **Elevated Empty States:** Added reusable `GraphiteEmptyState` with ambient glowing orbs, curated typography, and one-tap action buttons across Catalog, Transactions, Expenses, and Customers Khata screens.
- **System Harmonization:** Aligned `AppErrorWidget` and `AppLoadingIndicator` with the Noir Graphite & Platinum theme.

### Release engineering
- Bumped version to 2.3.6 (desktop `package.json`), 2.3.6+36 (mobile `pubspec.yaml`), and updated LiveContainer source feed to v2.3.6.

## [2.3.5] — 2026-10-06

Comprehensive app-wide visual unification into the **Noir Graphite & Platinum** identity.

### Changed (mobile admin app)
- **App-wide Visual Unification:** Replaced legacy mismatched cyber/rainbow colors (bright amber headers in Khata, purple indicators in Vendors, red action cards in Expenses, teal FABs in Catalog) with the sleek **Noir Graphite & Platinum** design language (`GraphiteTheme`).
- **Customer Khata Screen & Sheet:** Replaced yellow/amber header card with `GraphiteTheme.platinumCardDecoration`, subtle slate typography, and consistent platinum primary buttons. Status colors (debt vs cleared) remain strictly functional for tags and balances.
- **Expenses Screen:** Wrapped in `LiquidScaffold(graphiteAmbience: true)` with graphite header card and platinum action buttons, reserving functional red strictly for expense amounts and delete actions.
- **Vendors Screen:** Updated TabBar and PO listing to use platinum indicators, graphite card surfaces, and platinum primary action buttons.
- **Catalog & Transactions Screens:** Replaced legacy teal and cyan controls with graphite filter chips, platinum buttons, and clean hairline card borders.

## [2.3.4] — 2026-10-06

Dashboard declutter pass for the mobile admin app.

### Changed (mobile admin app)
- **Recent transactions moved off the dashboard:** the home screen no longer
  shows the recent-transactions card. The full ledger — including the recent
  history — lives in the Transactions page, now a semi-hidden destination:
  **long-press the Revenue or Orders performance card** to open it. A plain
  tap no longer navigates, matching the request that the ledger be reachable
  only via long-press.
- **Stock alerts moved into stock management:** the stock-alert card and
  today's-expenses tile are gone from the home screen. Out-of-stock and
  low-stock monitoring now lives in the **Items Catalog**: a "Stock Alerts"
  filter chip (amber, top of the screen) shows only problem items with
  counts, sorted most-urgent first (out-of-stock before low stock); it hides
  itself while inventory is healthy.

### Removed (mobile admin app)
- Dashboard sections: recent transactions, stock alerts card, today's
  expenses card (`recent_transactions.dart` and `store_ops_strip.dart`
  widgets deleted).

### Release engineering
- Version bump to 2.3.4 (desktop `package.json`) and 2.3.4+34 (mobile
  `pubspec.yaml`); LiveContainer source updated to v2.3.4.

## [2.3.3] — 2026-10-06

Dashboard layout polish for the mobile admin app: every action is now docked
at the bottom of the screen, and the clipped/overflowing text seen on small
devices is fixed.

### Fixed (mobile admin app)
- **Bottom-docked action bar:** the floating "Make Bill / POS" pill no longer
  hovers mid-screen over the Performance cards. It now sits in a permanent
  action bar at the bottom, next to one-tap Khata, Expenses, and Vendors
  shortcuts — always within thumb reach and never covering content.
- **Header clipping:** the dashboard app bar is now opaque graphite with a
  hairline rule, so scrolled content is masked cleanly under the header
  instead of being chopped mid-glyph ("Here's your store today · Tue, 6 Oct").
- **Hero numeral:** "RS 0" revenue numeral gets an explicit line height and a
  scale-down guard, so Playfair's tall ascenders are never sliced and very
  large amounts can no longer overflow the card.
- **Metric cards:** removed the duplicated delta marker ("▲ ▲ 0.0% vs
  yesterday" → single arrow from the card), roomier padding, taller tiles, and
  ellipsis on labels.
- **Khata detail sheet:** the WhatsApp / PDF / Add buttons in the balance bar
  shrink to fit and can no longer push the amber "+" button off the right
  edge; ledger titles stay on one line (payment method moved to a compact
  chip) and the screen title no longer ellipsizes.

### Changed (desktop + mobile)
- Version bump to 2.3.3 (desktop `package.json`) and 2.3.3+33 (mobile
  `pubspec.yaml`); LiveContainer source updated to v2.3.3.

## [2.3.2] — 2026-10-06

Maintenance and autoupdate release for desktop POS and mobile admin app.

### Changed
- **Mobile Admin:** Google Sign-In and Email authentication for master admin app (`saim.suhail.5@gmail.com`).
- **Mobile Admin:** Code quality enhancements and trailing comma linter compliance across screens.
- **Desktop POS:** Synchronized release artifacts for desktop autoupdate engine.

## [2.3.1] — 2026-10-06

Server-side access control: every sync device now identifies itself to
Firebase, and shop data is no longer world-readable. Owner guide added.

### Security (desktop + mobile)
- **Silent device identity:** the desktop sync engine performs an anonymous
  Firebase Auth sign-in at startup (one hidden identity per install, with
  bounded retries and self-healing listeners). No UI, no login prompt.
- **Rules hardened:** all business paths (root + `tenants/`) now require
  `auth != null` — a script that only knows the public web config gets
  permission denied. Licensing lookups stay public so device-code activation
  keeps working.
- Requires the **Anonymous** provider enabled in the Firebase console (the
  app logs precise instructions if it is off). See the new
  `docs/SECURITY_AND_ACCESS.md` — a plain-language owner guide with the
  console checklist, zone model, and troubleshooting table.

### Documentation
- `docs/SECURITY_AND_ACCESS.md`: who can access what, the three-zone data
  model, the mobile app's three gates (owner allowlist → master license →
  Google sign-in), the once-only Firebase console checklist (Google provider,
  Anonymous provider, rules paste), and honest limitations.

### Release engineering
- LiveContainer/AltStore source bumped to 2.3.1; versions aligned
  (desktop 2.3.1, mobile 2.3.1+31).

## [2.3.0] — 2026-10-05

Owner/master mobile release: Google Sign-In for the admin app, guaranteed
master licensing (never a trial), and sync rules hardening.

### Mobile admin app (flutter_admin_app) — 2.3.0+30
- **Google Sign-In** on the login screen: official Google "G" button, v7
  `google_sign_in` flow (`initialize()` → `authenticate()` → Firebase
  `id_token` credential). iOS OAuth client + reversed client ID are injected
  at build time by CI from the existing `GOOGLE_SERVICE_INFO_PLIST` secret.
- **Master app licensing**: the admin app is the OWNER app — any signed-in
  account is treated as the seller's master device. It never shows the trial
  banner, never enters grace/lockout (even offline or if the remote record is
  revoked), and self-provisions its `licenses/<fingerprint>` record with
  `role: "master"` so the desktop and the reseller license dashboard agree.
- New friendly auth errors for `operation-not-allowed` (Google provider
  disabled) and `account-exists-with-different-credential`.

### Sync / rules (desktop + mobile)
- `database.rules.json` rewritten so every root business path the master
  devices actually use (sales, products, customers, customer_khata,
  deleted_khata_entries, expenses, vendors, purchase_orders, daily_closings,
  cashier_sessions, users, print_requests) is explicitly public — the previous
  draft relied on RTDB's deny-by-default fallback for them, which would have
  broken master sync the moment it was published. Per-Google-account tenant
  isolation (`tenants/` + `tenantOwners/`) is preserved, and the previously
  missing `tenant_map` rule is added (mobile reseller flow writes it).

### Release engineering
- iOS workflow now substitutes `CLIENT_ID` / `REVERSED_CLIENT_ID` from the
  plist secret into `Info.plist` placeholders at build time.
- LiveContainer/AltStore source bumped to 2.3.0.

## [2.1.0] — 2026-10-03

Production-hardening milestone: layered architecture, integer money math,
offline Ed25519 product-key licensing, fail-safe print spooling, and a
documented mobile licensing path.

### Architecture
- New layered layout: `src/core/` (Result, Money, validation, logger, format),
  `src/domain/` (pure cart/receipt rules), `src/state/` (typed stores),
  `src/design/` (tokens), `src/components/ui/` + `src/components/pos/`,
  `src/main/licensing/`, `src/main/printing/`.
- `src/core/result.ts` extended: `fromPromise`, `mapErr`, `tap`, `all`,
  `allSeries` alongside the existing `tryCatch`/`ok`/`err`.
- `src/core/money.ts` — **all money math is now integer paisa.** `Money` is an
  opaque branded type; `computeTotals` is the single source of truth for
  subtotal → discount → tax. Eliminates float drift in tender/change math.
- `src/domain/cart.ts` — pure cart rules (stock caps, integer qty, totals)
  with zero React/IPC; returns `Result` for user-friendly errors.
- `src/state/store.ts` + `src/state/posStore.ts` — tiny typed store
  (`useSyncExternalStore` selectors) replacing ~20 `useState` hooks and
  prop-drilling in `App.tsx`; `src/state/toast.ts` replaces the scattered
  `setError`/`setSuccess` timeout pattern.
- `src/core/validation.ts` — typed validators (product, tender/split,
  PIN, phone, discount) returning `Result<T, FieldError[]>`.
- `src/core/logger.ts` — scoped structured logging with secret redaction;
  `debug` compiled out of production.

### UI/UX Overhaul
- `src/design/tokens.ts` — design-token contract: 4/8pt spacing, radii,
  elevation, motion, z-index scale, 48/56px touch targets, POS type scale.
- New primitives: `Button` (48px+ touch sizes, active-state press),
  `Card`, `Modal` (portal, Esc, focus), `NumericKeypad` (thumb-zone tender
  input), `ToastHost`.
- `src/hooks/usePosShortcuts.ts` — desktop keyboard map matching the
  on-screen shortcut bar: F1/Space tender, F2 hold/resume, F3 custom item,
  F4 catalog, F5 refresh, Esc close. **Enter is deliberately unmapped** —
  hardware barcode scanners terminate every scan with Enter.
- `src/components/pos/QuickTenderPad.tsx` — fast-checkout tender flow:
  big till total, exact-amount chips, split payments across Cash/Card/
  Easypaisa/JazzCash/Bank, live integer tendered/change math. `TenderPadBody`
  extracted for embedding; now drives `PaymentModal`'s tender engine.

### Security / Licensing
- **Offline Ed25519 product keys** (`src/main/licensing/licenseKeys.ts`):
  `SSM1-` base32 keys, 49-byte payload (tier, expiry, maxTerminals,
  device binding) + 64-byte signature. Verified fully offline with the
  embedded public key (`SSPOS_LICENSE_PUBLIC_KEY`); fails closed when
  unconfigured. No new dependencies (Node `crypto`).
- Hardened device fingerprint (`deviceFingerprint.ts`): Windows MachineGUID,
  macOS IOPlatformUUID, Linux machine-id, with the previous
  hostname|user|install-UUID fallback. Short `a1b2-c3d4-e5f6` device codes.
- Tiered manager (`licenseManager.ts`): offline key → Firebase remote →
  14-day trial → **3-day grace** → lockout. Tiers: Trial, Standard
  (single-terminal), Enterprise (multi-terminal).
- `scripts/issue-license.mjs` — reseller CLI: `--init` keypair generation,
  key issuance with `--tier/--days/--perpetual/--terminals/--bind`.
- `src/components/LicenseActivationModal.tsx` — "Enter Product Key /
  Activate Online" recovery modal (product-key tab + device-code tab).
### Mobile (Flutter admin app, `flutter_admin_app/`)
- **Offline product-key licensing, fully wired.** `lib/core/licensing/` now
  holds `license_verifier.dart` (Ed25519 verifier, byte-identical semantics
  to the desktop key format — one key activates both), `license_state.dart`
  (shared `LicenseState` + `LicenseTier` model) and `secure_license_store.dart`
  (encrypted persistence via `flutter_secure_storage`: Android keystore /
  iOS keychain). The old plaintext `ssmart_license_cache.json` is imported
  once and deleted.
- `LicenseService.activateProductKey()` — offline key activation with
  signature, expiry and device-binding checks; `checkLicense()` evaluates
  the activated key first, then the existing Firebase device-code flow,
  then trial. Tiers propagate from keys and the Firebase `role` field.
- **3-day trial grace** on mobile, matching desktop: full function with a
  red warning banner before the hard lockout.
- `MobileLicenseGate` — the Activation Required screen gains an "Enter
  Product Key" sheet for offline activation (previously device-code /
  recheck only).
- Public key compiled in via `--dart-define=SSPOS_LICENSE_PUBLIC_KEY=<b64>`;
  activation fails closed when unset. New deps: `cryptography ^2.7.0`,
  `flutter_secure_storage ^9.2.2`.
- License cache encryption unified in `src/main/licensing/secureCache.ts`
  (AES-256-GCM, fingerprint-keyed).
- **PINs are now scrypt-hashed** (`src/main/security/pinAuth.ts`), fully
  wired into `db.ts`: `users.pin` was plaintext (seeded `1234`/`9999`) and
  `getAllUsers` even returned the PIN column over IPC. New hashes use scrypt
  N=16384 with per-PIN salts and constant-time comparison; correct legacy
  PINs are transparently re-hashed on first successful login; `toSafeUser`
  strips secrets before IPC. Seeded defaults are hashed at rest and force
  rotation via a new `PinLogin` screen (`must_change_pin` flag).
- Removed 449 lines of dead code: `src/components/ShiftManager.tsx` was
  unreferenced by every screen (recoverable from trash for 30 days).
- `src/components/ui/ConfirmDialog.tsx` — design-system replacement for the
  26 `window.confirm`/`alert` sites (non-blocking, Esc-aware).

### Hardware / Production
- `src/main/printing/escposBuilder.ts` — pure ESC/POS byte builder
  (receipt layout, CODE128 barcode, cut) with zero side effects.
- `src/main/printing/printSpooler.ts` — SQLite-persisted print queue with
  retry backoff, pluggable transports (network TCP 9100, Bluetooth stub
  that fails with a clear message), crash recovery, and
  `print-queue-changed` renderer events. Wired into `checkout` /
  `print-receipt` IPC: ESC/POS spooler when a network printer is configured
  (`printer.transport` setting), legacy OS-driver HTML path otherwise.
  `PrintQueueBadge` in the POS header shows queued/failed jobs with retry.
- `forge.config.ts` — added `MakerDMG` (macOS disk image) and
  `@electron-forge/maker-dmg` devDependency.
- `.env.production.example` template (Firebase, licensing project, Ed25519
  public key). Real `.env.production` is git-ignored.
- `docs/DEPLOYMENT.md` — packaging matrix, macOS notarization + `.icns`
  generation, Windows signing, mobile keystore/ProGuard/R8 + permissions.

### Integration (this release)
- `App.tsx` fully refactored onto `posStore`/`usePos` (cart, user, view,
  discount, totals), `toast`, `usePosShortcuts`, and `QuickTenderPad`
  (via `TenderPadBody` in `PaymentModal`); `Cart`/`PaymentModal` consume the
  domain `CartState` with a `CheckoutItem` bridge at the IPC boundary.
- Licensing: `get-license-state` delegates to `evaluateLicense()`; product-key
  activation IPC + `LicenseActivationModal` mounted in the license gate.
- PINs: scrypt hashing wired into `verifyUserPin`/`addUser`/`updateUser`;
  `getAllUsers` no longer returns PIN material; seeded default PINs are
  hashed and force rotation via a new `PinLogin` screen.
- IPC hardening: `bypassTimeCheck` removed from the renderer contract —
  the main process tracks the login session and grants the Admin-only
  30-minute bypass server-side; ~30 handlers validate arguments via
  `src/main/validate.ts`; receipt HTML interpolation is escaped.
- 26 native `confirm`/`alert` call sites replaced with `ConfirmDialog`
  and `toast`.
- Money: all computations integer paisa; the 19-column SQLite migration is
  **deferred to v2.2.0** — implemented, tested and idempotent
  (`src/main/db/moneyMigration.ts`, `scripts/test-money-migration.cjs`),
  runbook in `docs/MIGRATION_PLAN.md` §7.1.

### Changed
- Version bumped to **2.1.0** (desktop `package.json`, both Flutter
  `pubspec.yaml` → `2.1.0+27`).
- `window.api` types extended: `activateProductKey`, `getDeviceCode`,
  `deactivateProductKey`, `changeUserPin`, `logout`, print-spooler APIs.
- Existing Firebase device-code flow untouched — the tiered manager layers
  the offline key on top with an identical renderer contract.

### Notes
- `assets/icon.icns` + `assets/dmg-background.png` must be generated before
  the first DMG build (commands in `docs/DEPLOYMENT.md`).
- Enterprise terminal-count enforcement is reseller-side (Firebase
  `licenses/<fp>` records); the key carries `maxTerminals` for the future
  online check-in.
- Flutter: `flutter analyze` / builds must run on a machine with the SDK
  (none on the hardening workstation); Dart changes are carefully reviewed
  but uncompiled.

## [2.0.0] — 2026-10-02

Production-readiness milestone: centralized error handling and formatting,
license cache encryption, and a documented path for the multi-app redesign.

### Security / Licensing
- **License cache is now encrypted at rest.** The offline grace cache is stored
  as AES-256-GCM ciphertext (`license-cache.bin`), keyed from the device
  fingerprint via scrypt, so the file cannot be read off-device and copying an
  activated cache to a second machine fails to decrypt. The legacy plaintext
  `license-cache.json` is still readable for existing installs and is deleted
  automatically on the next cache write (seamless migration).
- Documented the correct Firebase RTDB rules for the licensing database in
  `docs/LICENSING_AND_CLOUD_PLAN.md`. The previous snippet (`read: false`)
  would have made every client activation fail silently; the app reads
  licences with the Firebase web SDK, so per-fingerprint read must stay open
  while parent-level enumeration stays closed.

### Added
- `src/core/result.ts` — `Result<T, E>` type with `tryCatch`, `unwrapOr`,
  `mapResult` and type guards, for non-throwing error handling at I/O
  boundaries (files, Firebase, printers, HTTP).
- `src/core/format.ts` — the single source of truth for money and date
  formatting (`money`, `moneyCompact`, `moneyWithPrefix`, `dateTime`,
  `isoDate`), replacing 133 hand-rolled `toLocaleString` call sites.
- `content` color tokens in `tailwind.config.js` (`content-primary` through
  `content-faint`) giving text a semantic scale that mirrors the `--text-*`
  CSS variables.

### Changed
- **Design-system tokens are now actually used.** The `canvas.*`, `status.*`
  and new `content.*` tokens in `tailwind.config.js` existed but had zero
  adoption — components hardcoded ~1,100 raw Tailwind palette classes
  (`bg-slate-900`, `text-emerald-400`, `bg-red-500`, …). All mapped families
  (`slate` surfaces, `emerald`/`amber`/`red`/`rose` semantics, `neutral`
  text) now resolve through the semantic tokens, so retheming is a config
  edit instead of a 19-file hunt. Intentional exclusions: gradient stops
  (decorative) and the thermal-receipt preview's paper-white surface in
  `PaymentModal` (gray utilities kept deliberately for print fidelity).
- Migrated the highest-traffic money surfaces to the shared formatters:
  `AnalyticsDashboard` (revenue, refunds, expenses, profit, report timestamp),
  `PaymentModal` (customer balances, new total due) and `SalesRecordManager`
  (the WhatsApp daily-closing message). Output is byte-identical to before.
- Version bumped to 2.0.0 across the desktop app and both Flutter admin apps
  (`2.0.0+26`, keeping the monotonic build number).

### Notes
- ~~The mobile admin app still has **no licensing gate** — licensing is
  desktop-only (see `docs/LICENSING_AND_CLOUD_PLAN.md` §5). Do not sell mobile
  access until it is wired.~~ **Superseded in 2.1.0:** the Flutter admin app
  now has `MobileLicenseGate`, offline Ed25519 product-key activation and
  encrypted license storage (see the 2.1.0 Mobile section above).
- `livecontainer_source.json` still advertises 1.0.25 and should be bumped
  only when v2.0.0 is actually tagged and the IPA is attached.

## [1.0.25] — 2026-10-02

### Features
- Device-locked licensing with 14-day trial, remote kill switch, 12-hour
  background revalidation and offline grace.
- Multi-tenant cloud routing: master devices keep the legacy root paths, sold
  copies sync under `tenants/<id>/`. Master Access badge in the desktop app.
- PDF khata/vendor statements with WhatsApp sharing, CSV exports, faster delta
  cloud sync.
- Working desktop auto-update feed (non-draft releases visible to
  `update.electronjs.org`) and a LiveContainer/AltStore source.

### Fixed
- `flutter analyze` build failures in both admin apps: `pw.Font.bold` →
  `pw.FontWeight.bold`, table cell alignments `pw.TextAlign` →
  `pw.Alignment`, bare `PdfPageFormat.a4`, non-const `BoxDecoration`, missing
  `dart:async` import, and `share_plus` bumped to ^11.0.0.
- Missing `crypto` dependency declared in both Flutter `pubspec.yaml` files.
