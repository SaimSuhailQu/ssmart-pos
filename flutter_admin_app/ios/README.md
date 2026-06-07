# iOS Platform Files

This directory contains the iOS-specific files for the SSmart POS Admin Flutter app.

## Two Build Options

### 1. Unsigned (Development) - No Apple Account Needed ⭐

Perfect for development and testing without Apple Developer account.

**Quick start:**
```bash
cd ..  # Go to flutter_admin_app directory
flutter build ios --simulator

# Or use Fastlane
cd ios
bundle exec fastlane build_unsigned
```

**See:** [../UNSIGNED_BUILD_GUIDE.md](../UNSIGNED_BUILD_GUIDE.md)

### 2. Signed (Production) - Requires Apple Developer

For TestFlight and App Store distribution.

**See:** [../IOS_BUILD_SETUP.md](../IOS_BUILD_SETUP.md)

---

## What's Here

### Xcode Project
- `Runner.xcodeproj/` - Xcode project configuration
- `Runner.xcworkspace/` - Xcode workspace (use this to open the project)
- `Podfile` - CocoaPods dependency management

### App Files
- `Runner/` - Main app directory
  - `AppDelegate.swift` - iOS app delegate
  - `Info.plist` - App metadata and configuration
  - `Assets.xcassets/` - App icons and launch images
  - `Base.lproj/` - Storyboards for launch screen

### Build Configuration
- `ExportOptions.plist` - IPA export configuration for App Store
- `.gitignore` - Git ignore rules for iOS build artifacts

### Fastlane (Build Automation)
- `fastlane/Gemfile` - Ruby dependencies for Fastlane
- `fastlane/Appfile` - App identifier and Apple ID configuration
- `fastlane/Fastfile` - Build lanes (beta, release, build_only)
- `fastlane/Matchfile` - Code signing configuration
- `fastlane/.env.default` - Environment variable template

## Opening the Project

**Always use the workspace:**

```bash
cd ios
open Runner.xcworkspace  # ✅ Correct
# NOT: open Runner.xcodeproj  # ❌ Wrong
```

## Bundle Configuration

- **Bundle Identifier:** `com.ssmartpos.admin`
- **Display Name:** SSmart POS Admin
- **Version:** 1.0.0 (from pubspec.yaml)
- **Minimum iOS Version:** 12.0

## Before Building

1. **Install CocoaPods dependencies:**
   ```bash
   cd ios
   pod install
   ```

2. **Configure code signing in Xcode:**
   - Open `Runner.xcworkspace`
   - Select Runner target
   - Go to Signing & Capabilities
   - Select your development team

## Automated Builds

This project is configured for automated builds using:
- **GitHub Actions** - CI/CD workflow
- **Fastlane** - Build automation
- **TestFlight** - Beta distribution

See the main setup guide: [../IOS_BUILD_SETUP.md](../IOS_BUILD_SETUP.md)

## Important Notes

1. **Use .xcworkspace, not .xcodeproj** - Required when using CocoaPods
2. **Don't commit build artifacts** - They're in .gitignore
3. **Never commit certificates** - Use Fastlane Match instead
4. **Update Team ID** - In ExportOptions.plist and Fastlane config

## Common Commands

### Unsigned (Development)
```bash
# Build for simulator
cd ..
flutter build ios --simulator

# Or with Fastlane
bundle exec fastlane build_unsigned
```

### Signed (Production)
```bash
# Install dependencies
bundle install
pod install

# Build with Fastlane
bundle exec fastlane build_only    # Build IPA only
bundle exec fastlane beta          # Upload to TestFlight
```

## Need Help?

- **Unsigned Builds (No Apple Account):** [../UNSIGNED_BUILD_GUIDE.md](../UNSIGNED_BUILD_GUIDE.md)
- **Signed Builds (Complete Setup):** [../IOS_BUILD_SETUP.md](../IOS_BUILD_SETUP.md)
- **Main README:** [../README.md](../README.md)
- **Fastlane Docs:** https://docs.fastlane.tools
