# Quick Start: Unsigned iOS Builds

**No Apple Developer account? No problem!** This guide shows you how to build and test the SSmart POS Admin iOS app without an Apple Developer account.

## What Are Unsigned Builds?

Unsigned builds are development builds that:
- ✅ Work on iOS Simulator
- ✅ Can be built without code signing certificates
- ✅ Don't require Apple Developer Program membership
- ✅ Are perfect for development and testing
- ❌ Cannot be distributed via TestFlight or App Store
- ❌ Cannot be easily shared with non-developers

## Quick Start

### Option 1: Local Build (Recommended)

**Requirements:**
- macOS with Xcode installed
- Flutter SDK installed

**Steps:**

```bash
# Navigate to the Flutter app
cd flutter_admin_app

# Install dependencies
flutter pub get

# Build for simulator
flutter build ios --simulator

# Or run directly on simulator
flutter run
```

The build output will be at:
```
build/ios/Debug-iphonesimulator/Runner.app
```

### Option 2: GitHub Actions Build

**Requirements:**
- GitHub account (free)
- Repository access

**Steps:**

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Build Flutter iOS Admin App** workflow
4. Click **Run workflow**
5. Configure:
   - Branch: `main` (or your branch)
   - Build type: `unsigned`
6. Click **Run workflow**
7. Wait ~10-15 minutes for build to complete
8. Download artifact: `SSmart-POS-Admin-iOS-Unsigned-XXXXX.zip`

**No GitHub Secrets needed!** Unsigned builds work out of the box.

### Option 3: Fastlane (Advanced)

```bash
cd flutter_admin_app/ios

# Install dependencies (first time only)
bundle install

# Build unsigned app
bundle exec fastlane build_unsigned
```

## Installing on Simulator

### Method 1: Drag and Drop
1. Open iOS Simulator: `open -a Simulator`
2. Drag the `.app` file to the simulator window

### Method 2: Command Line
```bash
# List available simulators
xcrun simctl list devices

# Boot a simulator (if not already running)
open -a Simulator

# Install the app
xcrun simctl install booted build/ios/Debug-iphonesimulator/Runner.app

# Launch the app
xcrun simctl launch booted com.ssmartpos.admin
```

## Testing on Physical Device (Free Apple ID)

You can test on a **real iOS device** using a free Apple ID:

1. Open `ios/Runner.xcworkspace` in Xcode
2. Connect your iPhone/iPad via USB
3. In Xcode, select your device from the device dropdown
4. Go to **Signing & Capabilities** tab
5. Check **Automatically manage signing**
6. Select your **Team** (your free Apple ID email)
7. Xcode will create a free development provisioning profile
8. Click **Run** (▶️) button

**Limitations:**
- App expires after 7 days (must rebuild/reinstall)
- Limited to 3 devices
- Some features may not work (Push Notifications, In-App Purchases, etc.)

**This is perfect for:**
- Personal testing
- Development
- Showing the app to someone in person

## Upgrading to Signed Builds

When you're ready for production distribution, upgrade to signed builds:

**What you get with Apple Developer Program ($99/year):**
- ✅ TestFlight distribution (beta testing)
- ✅ App Store publishing
- ✅ Apps that don't expire
- ✅ Full feature support
- ✅ Professional distribution

**See:** [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md) for complete setup instructions.

## Troubleshooting

### "No iOS Simulators found"

**Solution:**
```bash
# Open Xcode and install simulators
xcode-select --install

# Open Xcode > Preferences > Components
# Download iOS simulators
```

### "Command not found: flutter"

**Solution:**
Install Flutter SDK: https://flutter.dev/docs/get-started/install

### Build fails with "pod install" error

**Solution:**
```bash
cd ios
pod repo update
pod install
```

### "Unable to install Runner.app"

**Solution:**
```bash
# Reset the simulator
xcrun simctl erase all

# Try installing again
xcrun simctl install booted build/ios/Debug-iphonesimulator/Runner.app
```

## Comparison: Unsigned vs Signed

| Feature | Unsigned (Free) | Signed ($99/year) |
|---------|----------------|-------------------|
| iOS Simulator | ✅ Yes | ✅ Yes |
| Physical Device (Free ID) | ⚠️ Yes (7-day expiry) | ✅ Yes (permanent) |
| TestFlight Distribution | ❌ No | ✅ Yes |
| App Store Publishing | ❌ No | ✅ Yes |
| Share with Non-Developers | ❌ No | ✅ Yes |
| Setup Complexity | 🟢 Easy | 🟡 Moderate |
| Build Time | 🟢 Fast | 🟡 Moderate |
| Best For | Development, Testing | Production, Distribution |

## Next Steps

1. **Start developing:** Use unsigned builds for daily development
2. **Test locally:** Use simulator or free Apple ID for device testing
3. **When ready:** Upgrade to Apple Developer Program for distribution
4. **Read more:** Check [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md) for full guide

## Resources

- [Flutter iOS Documentation](https://flutter.dev/docs/deployment/ios)
- [Xcode Documentation](https://developer.apple.com/xcode/)
- [Complete Build Setup Guide](./IOS_BUILD_SETUP.md)

---

**Questions?** Open an issue in the GitHub repository or check the troubleshooting section in [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md).
