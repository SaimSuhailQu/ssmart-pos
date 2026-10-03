# SSmart POS — Production Deployment Guide

## Desktop packaging matrix

| Platform | Installer | Maker | Notes |
|---|---|---|---|
| Windows | `Setup.exe` (Squirrel) | `MakerSquirrel` | Auto-update via `update.electronjs.org` (GitHub releases, non-draft) |
| Windows | Portable ZIP | `MakerZIP` | No installer; for USB-stick deployment |
| macOS | `.dmg` | `MakerDMG` | Requires `assets/icon.icns` (see below). Notarize with `notarytool` before distribution |
| Linux | `.deb` | `MakerDeb` | Debian/Ubuntu |
| Linux | `.rpm` | `MakerRpm` | Fedora/RHEL |
| Linux | Portable ZIP | `MakerZIP` | AppImage is intentionally not used: Forge has no first-class AppImage maker; the ZIP + `.desktop` file covers kiosk installs |

### Release checklist (desktop)

1. `cp .env.production .env` — fill Firebase + `SSPOS_LICENSE_PUBLIC_KEY`.
2. Embed the license public key: `SSPOS_LICENSE_PUBLIC_KEY` must be set at
   **build time** (Vite inlines it). Without it, product-key activation fails closed.
3. `npm run typecheck && npm run lint` — must be green.
4. `npm run make` — produces all installers under `out/`.
5. macOS: `xcrun notarytool submit out/make/*.dmg --wait`, then staple.
6. Windows: sign the Squirrel `Setup.exe` with your EV cert (SmartScreen).
7. Publish: `npm run publish` pushes a **non-draft** GitHub release so the
   auto-updater feed (`update.electronjs.org`) picks it up.
8. Attach the iOS build to the same release and bump
   `livecontainer_source.json` (it still advertises the old version).

### macOS assets

Generate once on a Mac from the existing PNG:

```bash
mkdir icon.iconset
sips -z 16 16     assets/icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     assets/icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   assets/icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 assets/icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o assets/icon.icns
```

`assets/dmg-background.png` (540×380) is optional — the DMG maker falls back
to a plain background if it is absent.

## Mobile (Flutter) release hardening

The Flutter apps (`flutter_admin_app/`, and the future mobile POS) need:

```yaml
# android/app/build.gradle — release signing
signingConfigs:
  release:
    storeFile: file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
    storePassword: System.getenv("KEYSTORE_PASSWORD")
    keyAlias: System.getenv("KEY_ALIAS")
    keyPassword: System.getenv("KEY_PASSWORD")
buildTypes:
  release:
    signingConfig: signingConfigs.release
    minifyEnabled: true
    shrinkResources: true
    proguardFiles: getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
```

`android/proguard-rules.pro` (keep Flutter + plugins that use reflection):

```proguard
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.**
```

Permissions (`AndroidManifest.xml`) — request only what the POS needs:

```xml
<uses-permission android:name="android.permission.CAMERA" />           <!-- barcode scanning -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" /> <!-- BT printers (Android 12+) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.INTERNET" />
```

Never request `READ_EXTERNAL_STORAGE`/`MANAGE_EXTERNAL_STORAGE` on new
installs — scoped storage via `path_provider` covers receipts/exports.

### Mobile licensing

Wire `mobile/licensing/lib/` into the Flutter app startup:

1. `computeFingerprint()` → show `deviceCode()` on the activation screen.
2. Buyer pastes the `SSM1-…` product key → `verifyLicenseKeyForDevice()`.
3. Cache the key + payload in `flutter_secure_storage` (encrypted
   keystore/keychain) — never plain `SharedPreferences`.
4. Gate the POS screens on the verified state; re-verify the signature on
   every cold start (cheap: one Ed25519 verify, ~1ms).

## Environment & secrets

- `.env.production` is the template; the real file is git-ignored and
  injected via CI secrets (`VITE_*`) and the release-signing step
  (`SSPOS_LICENSE_PUBLIC_KEY`).
- The Ed25519 **private** key (`license-private.key`) never leaves the
  reseller's offline machine. CI only ever sees the public key.
- Firebase RTDB rules for the licensing project are documented in
  `docs/LICENSING_AND_CLOUD_PLAN.md` §2 — per-fingerprint reads only.
