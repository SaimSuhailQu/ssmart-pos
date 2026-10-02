# Changelog

All notable changes to SSmart POS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/).

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
- The mobile admin app still has **no licensing gate** — licensing is
  desktop-only (see `docs/LICENSING_AND_CLOUD_PLAN.md` §5). Do not sell mobile
  access until it is wired.
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
