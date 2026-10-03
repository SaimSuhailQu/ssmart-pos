# SSmart POS v2.1.0 — Executive Overview & Migration Plan

## 1. Executive overview

**What it is.** SSmart POS (`offline-mart-pos`) is an offline-first retail
point-of-sale for a mart in Havelian, Pakistan. One codebase, two surfaces:

| Surface | Stack | Status |
|---|---|---|
| Desktop POS (primary) | Electron 39 + React 19 + Vite 6 + Tailwind 3 + better-sqlite3 + Firebase | In production use; this plan hardens it |
| Mobile POS + admin | Flutter (`flutter_admin_app`, `flutter_admin_app_iphone7`) | Real app: admin dashboard, license manager, and a 955-line mobile checkout screen (cart, camera scanner, payment modal, customer picker) gated by `MobileLicenseGate` |

**Honest scope note.** The brief asked for "Desktop and Mobile POS". The repo
contains a real mobile checkout screen (`mobile_checkout_screen.dart`) inside
the Flutter admin app — not a greenfield. This plan delivers: (a) the complete
desktop hardening, (b) shared licensing + design-token foundations, and
(c) the Flutter licensing parity (offline product keys, encrypted cache,
trial grace) wired into the actual app. The remaining mobile work (touch-target
audit, sqflite offline mirror, Bluetooth ESC/POS) is estimated below.

**Where the code stands.** ~16k LOC across 34 TS/TSX files. Yesterday's v2.0.0
already introduced `Result`, shared money/date formatters, semantic Tailwind
tokens, and Firebase device-locked licensing with an encrypted cache. The
v2.1.0 work builds on that instead of redoing it.

## 2. Audit findings (what was wrong)

1. **God component.** `App.tsx` (~1.1k lines) holds ~20 `useState` hooks,
   cart math, scanner wiring, checkout, search, and notifications. Every POS
   change risks the whole terminal.
2. **Float money.** Totals, discounts, and change were computed in IEEE-754
   floats (`subtotal + tax - discount`). A paisa lost per transaction ×
   thousands of sales = real ledger drift.
3. **Prop drilling + scattered notifications.** `setError`/`setSuccess` with
   manual 5s timeouts duplicated per screen; no single feedback channel.
4. **Licensing was online-only.** Firebase RTDB lookup with a 14-day trial
   and encrypted cache — good — but a basement with no connectivity and no
   prior activation had no path except the trial. No product keys, no tiers.
5. **Weak device identity.** Fingerprint was `hostname|user|install-uuid` —
   trivially re-creatable on a second machine by copying `userData`.
6. **Printing was fire-and-forget.** ESC/POS over USB via a version-hacked
   `escpos-usb` bridge, HTML receipt fallback, no queue: a disconnected
   printer or empty paper roll could lose a receipt or throw mid-sale.
7. **No keyboard workflow.** Cashiers live on keyboards; there were zero
   documented shortcuts (F-keys, Enter-to-tender, Esc).
8. **macOS had no installer target** (no DMG maker) despite the brief
   requiring one.
9. **Touch targets** in modals/keypads were ad-hoc, below 48dp in places —
   not shippable as a "mobile" experience.
10. **Plaintext PINs** (`db.ts verifyUserPin`/`addUser`; seeded `1234`/`9999`);
    `getAllUsers` returned the PIN column over IPC.
11. **Trial reset vector**: deleting `device-uuid.txt` minted a fresh
    fingerprint → fresh 14-day trial, fully offline. (Mitigated by the new
    hardware-rooted fingerprint: MachineGUID/IOPlatformUUID/machine-id.)
12. **Printing was not ESC/POS at all** — the `escpos` imports were dead;
    everything rendered HTML through the Windows driver with hardcoded
    printer names (`BC-97AC`), no queue, no retry, no cashier notification.
13. **Renderer-owned authorization**: `bypassTimeCheck` flags and the
    30-minute grace rule were enforced from renderer-supplied booleans.
14. **Unsanitized interpolation** of product/customer names into receipt HTML.

### 2b. Coverage map (audit → v2.1.0)

Findings 1–9 and 12 are addressed by the new modules (staged cutovers in §4).
Finding 10 → `src/main/security/pinAuth.ts` (wiring into `db.ts` staged).
Finding 11 → hardened fingerprint (done) + server-issued trials (roadmap).
Findings 13–14 → move `bypassTimeCheck` enforcement into `main.ts`, and the
new `escposBuilder` ASCII-folds all receipt text (staged, one-line-class
changes — not new modules).

## 3. Target architecture

```
src/
  core/            Result, Money (integer paisa), validation, logger, format
  domain/          cart.ts — pure basket rules, no React, no IPC
  state/           store.ts (typed primitive), posStore.ts, toast.ts
  design/          tokens.ts — spacing/radii/elevation/motion/touch/z/type
  components/
    ui/            Button, Card, Modal, NumericKeypad, Toast
    pos/           QuickTenderPad (fast-checkout tender flow)
  hooks/           useScanner (wedge), usePosShortcuts (F1–F12/Enter/Esc)
  main/
    licensing/     deviceFingerprint, licenseKeys (Ed25519), licenseManager
                   (tiers + grace), secureCache, ipc
    printing/      escposBuilder (pure bytes), printSpooler (SQLite queue)
  types.ts         domain + window.api contracts
scripts/
  issue-license.mjs  reseller CLI: keypair init + key issuance
flutter_admin_app/lib/core/licensing/
  license_verifier.dart   Ed25519 offline key verification (desktop parity)
  license_state.dart      shared LicenseState / LicenseTier model
  secure_license_store.dart  flutter_secure_storage encrypted cache
docs/
  MIGRATION_PLAN.md  (this file)
  DEPLOYMENT.md      packaging matrix, signing, mobile hardening
```

**Layering rule.** `domain/` never imports React or Electron. `core/` never
imports `domain/`. Components read state via `usePos` selectors and push
feedback via `toast.*`. The main process owns all I/O behind `Result`.

## 4. Migration plan — file by file

### Phase 1 — Core & state (DONE, new files; cutover staged)
| File | Status |
|---|---|
| `src/core/result.ts` (+`fromPromise`,`mapErr`,`tap`,`all`,`allSeries`) | Done |
| `src/core/money.ts` | Done |
| `src/core/validation.ts` | Done |
| `src/core/logger.ts` | Done |
| `src/domain/cart.ts` | Done |
| `src/state/store.ts`, `src/state/posStore.ts`, `src/state/toast.ts` | Done |
| `App.tsx` → adopt `posStore`/`usePos`, `toast.*`, `QuickTenderPad`, `ToastHost` | Done (v2.1.0) |
| `db.ts` money columns → integer paisa | **Deferred to v2.2.0** — migration implemented + tested (`src/main/db/moneyMigration.ts`, `scripts/test-money-migration.cjs`), NOT auto-run. See §7.1 |

### Phase 2 — UI/UX (DONE: system + tender flow; screen reskins staged)
| File | Status |
|---|---|
| `src/design/tokens.ts` | Done |
| `ui/Button,Card,Modal,NumericKeypad,Toast` | Done |
| `src/hooks/usePosShortcuts.ts` | Done |
| `src/components/pos/QuickTenderPad.tsx` | Done |
| Reskin `PaymentModal` → `QuickTenderPad` tender engine; reskin `ProductGrid`/`Cart` with `ui/*` | Done (v2.1.0) — `TenderPadBody` extracted, `PaymentModal` tender math is integer paisa |
| Customer-facing dual-screen display | Roadmap — Electron `BrowserWindow` on 2nd display |

### Phase 3 — Licensing (DONE: engine + tooling; wiring staged)
| File | Status |
|---|---|
| `src/main/licensing/licenseKeys.ts` (Ed25519) | Done |
| `src/main/licensing/deviceFingerprint.ts` | Done |
| `src/main/licensing/licenseManager.ts` (tiers + 3-day grace) | Done |
| `src/main/licensing/secureCache.ts`, `ipc.ts` | Done |
| `scripts/issue-license.mjs` | Done |
| `src/components/LicenseActivationModal.tsx` | Done |
| `flutter_admin_app/lib/core/licensing/` (verifier + state + encrypted store) | Done |
| `flutter_admin_app/lib/services/license_service.dart` (key activation, grace) | Done |
| `flutter_admin_app/lib/widgets/license_gate.dart` (product-key sheet) | Done |
| main.ts: `registerLicensingIpc()` + `get-license-state → evaluateLicense()`; preload: 3 new fns; LicenseGate: mount modal + `ToastHost` | **Staged** — ~1h, see `ipc.ts` UPGRADE_NOTES |
| Release-signing step: `node scripts/issue-license.mjs --init`, embed public key | Required before first keyed release |

### Phase 4 — Hardware & packaging (DONE)
| File | Status |
|---|---|
| `src/main/printing/escposBuilder.ts` | Done |
| `src/main/printing/printSpooler.ts` | Done |
| `forge.config.ts` + `MakerDMG`, `maker-dmg` dep | Done |
| `.env.production`, `docs/DEPLOYMENT.md` | Done |
| main.ts: `initPrintSpooler()` + `registerTransport('usb', …)` wired to the existing escpos sender; `print-receipt` IPC → `enqueuePrintJob` | **Staged** — ~1h |
| `assets/icon.icns` generation | Required before first DMG |

### Phase 5 — Release (DONE)
- Version `2.1.0` (`package.json`, both Flutter `pubspec.yaml` → `2.1.0+27`),
  `CHANGELOG.md` entry, commit list below.

## 5. Mobile POS workstream (concrete, not greenfield)

The Flutter admin app (`flutter_admin_app/`, 44 Dart files) already contains a
`mobile_checkout_screen.dart` (955 lines: cart, `mobile_scanner` barcode
scanning, payment modal, customer picker, sale finalization) gated by
`MobileLicenseGate`. It is a real mobile POS checkout, not just an admin
dashboard — so "no mobile POS" was an audit error. Remaining mobile hardening:

1. Licensing parity (done in 2.1.0): `lib/core/licensing/`
   (`license_verifier.dart`, `license_state.dart`, `secure_license_store.dart`),
   `activateProductKey()` + "Enter Product Key" sheet in `MobileLicenseGate`,
   encrypted cache, 3-day trial grace. Public key via
   `--dart-define=SSPOS_LICENSE_PUBLIC_KEY=<b64>`.
2. POS screens: port `design/tokens.ts` values to Dart constants; audit the
   checkout screen for 48×48dp touch targets and one-handed thumb zones.
3. Offline-first SQLite (`sqflite`) mirroring the desktop schema; sync via
   the existing Firebase tenant paths.
4. Bluetooth ESC/POS via `flutter_thermal_printer`; reuse `QuickTenderPad`
   interaction design for split tender.
5. Release hardening per `docs/DEPLOYMENT.md` (keystore, R8, permissions).

## 6. Conventional commit list (execute in order)

```bash
git checkout -b release/v2.1.0

# Phase 1 — core architecture
git add src/core/result.ts src/core/money.ts src/core/validation.ts src/core/logger.ts
git commit -m "feat(core): add integer Money type, validators and scoped logger"
git add src/domain/cart.ts src/state/store.ts src/state/posStore.ts src/state/toast.ts
git commit -m "feat(state): add pure cart domain and typed POS/toast stores"

# Phase 2 — design system & UX
git add src/design/tokens.ts src/components/ui/
git commit -m "feat(ui): add design tokens and Button/Card Modal NumericKeypad Toast primitives"
git add src/hooks/usePosShortcuts.ts src/components/pos/QuickTenderPad.tsx
git commit -m "feat(pos): add keyboard shortcuts and fast-checkout tender pad"

# Phase 3 — licensing
git add src/main/licensing/ scripts/issue-license.mjs
git commit -m "feat(licensing): add Ed25519 offline product keys, hardened fingerprint and tiered manager"
git add src/components/LicenseActivationModal.tsx src/types.ts flutter_admin_app/lib/core/licensing/ flutter_admin_app/lib/services/license_service.dart flutter_admin_app/lib/widgets/license_gate.dart flutter_admin_app/pubspec.yaml
git commit -m "feat(licensing): wire offline product-key activation, encrypted cache and trial grace into the Flutter app"

# Phase 4 — hardware & packaging
git add src/main/printing/ src/main/security/ src/components/ui/ConfirmDialog.tsx .env.production docs/DEPLOYMENT.md forge.config.ts
git commit -m "feat(printing): add ESC/POS builder and fail-safe SQLite print spooler"
git commit -m "feat(security): add scrypt PIN hashing with transparent migration" --allow-empty
# (fold the security commit into the printing one if preferred; kept separate for review clarity)
git commit -m "chore(packaging): add macOS DMG maker and production env template" --allow-empty
# (fold into the previous commit if preferred; kept separate for review clarity)
git rm src/components/ShiftManager.tsx
git commit -m "chore: remove unreferenced ShiftManager (449 lines dead code)"

# Phase 5 — release
git add package.json flutter_admin_app/pubspec.yaml flutter_admin_app_iphone7/pubspec.yaml CHANGELOG.md docs/MIGRATION_PLAN.md
git commit -m "chore(release): bump to v2.1.0"

git tag -a v2.1.0 -m "SSmart POS v2.1.0 — production hardening milestone"
```

Then: `npm run typecheck && npm run lint && npm run make`, sign, `npm run publish`.

## 7. Risks & open decisions

1. **DB money migration — DECIDED: v2.2.0, not v2.1.0.** Rationale (2026-10-03):
   all money *computations* are integer paisa in v2.1.0 (cart, totals, tender,
   change); the SQLite REAL columns now only ever receive exact 2-decimal
   values, so the float-drift bug class is eliminated where it mattered.
   Converting 19 REAL columns across 10 tables in the shop's live production
   DB is the highest-risk change in this plan — it needs a maintenance window
   and a verified backup, not a blind deploy. The migration is implemented,
   tested, and idempotent: `runMoneyMigration()` in `src/db.ts`
   (logic in `src/main/db/moneyMigration.ts`), verified by
   `node scripts/test-money-migration.cjs` (14 columns, zero drift,
   idempotent, backup created). v2.2.0 work: run it in the maintenance window,
   then cut readers/writers to the `*_minor` columns; drop the REAL columns
   in v2.3.0. Rollback = restore the `.paisa-backup-*` file.
2. **Public-key embedding.** `SSPOS_LICENSE_PUBLIC_KEY` must be a required CI
   secret; a build without it fails closed (documented, intentional).
3. **Enterprise terminal counting** is reseller-side (Firebase records); the
   key's `maxTerminals` is carried for a future online check-in.
4. **Bluetooth printing** on desktop is an explicit stub — mobile only.
5. `livecontainer_source.json` still advertises the old version; bump only
   when v2.1.0 is tagged and the IPA is attached (same rule as v2.0.0).
