# iOS Quick Entry Widget

Home-screen widget for one-tap shop accounting. Works with SideStore (real
install) — **not** with LiveContainer (it can't install app extensions).

## What it is

- **Widget (SwiftUI/WidgetKit):** small (Loan, Wasool) and medium
  (Loan, Wasool, Order, Kharcha) button layouts in Noir Graphite styling.
- Tapping a button opens the app via `ssmartpos://quick-entry?action=<loan|wasool|order|expense>`
  straight into Quick Entry with that action pre-selected.
- The widget is a **launcher only** — it never writes to the ledger. The user
  still types name + amount and taps **Confirm** inside the app.

## In-app pieces (work everywhere, incl. LiveContainer)

- `lib/core/commands/command_parser.dart` — rule-based NL parser
  (English + Roman Urdu keywords, fuzzy name matching). Pure Dart, unit-tested
  (`test/command_parser_test.dart`).
- `lib/core/commands/ai_interpreter.dart` — Gemini free-tier fallback, used
  only when the rule parser isn't confident and the user saved an API key.
  Key lives in the iOS keychain via flutter_secure_storage.
- `lib/features/quick_entry/screens/quick_entry_screen.dart` — command input
  + live preview + disambiguation chips + Confirm → writes via the same
  `FirebaseService` paths as the manual screens.
- `lib/features/quick_entry/screens/quick_entry_settings_screen.dart` —
  Gemini API key management (get a free key at aistudio.google.com/apikey).
- `lib/core/deep_link/deep_link_handler.dart` — handles
  `ssmartpos://quick-entry`, placed inside the authenticated branch so widget
  taps while logged out are ignored.
- Dashboard app-bar bolt icon opens Quick Entry in-app.

## Xcode project

- New `QuickEntryWidget` app-extension target (`ios/QuickEntryWidget/`):
  `QuickEntryWidget.swift`, `QuickEntryWidgetBundle.swift`, `Info.plist`.
- Bundle id `com.ssmartpos.QuickEntryWidget`, embedded via
  "Embed App Extensions" (dstSubfolderSpec 13) in the Runner target.
- URL scheme `ssmartpos` registered in `ios/Runner/Info.plist`.

## Build & install (on your Mac)

1. `flutter pub get`
2. Open `ios/Runner.xcworkspace` in Xcode.
3. Select the **Runner** scheme → build & archive as usual for SideStore.
   The widget extension builds automatically (target dependency) and is
   embedded in the IPA — SideStore installs both.
4. On the iPhone: long-press home screen → + → **SSmart Quick Entry**.

## Notes & limits

- Widget v1 is buttons-only: no live stats. The extension can't read the
  app's Firebase session without an App Group or re-auth; adding that is
  future work (App Group entitlement status on free Apple IDs is uncertain).
- `flutter analyze` and a real device/SideStore install test are required —
  this machine compiles neither Dart nor Swift.
- Gemini calls need internet and take ~1–2s; rules handle the common
  patterns instantly offline.
