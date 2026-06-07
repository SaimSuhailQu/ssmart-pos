# iOS Build Setup Guide - SSmart POS Admin

This guide walks you through setting up iOS builds for the SSmart POS Admin Flutter app. Whether you have an Apple Developer account or not, there's a build option for you!

## 🎯 Quick Decision Guide

**Don't have an Apple Developer account yet?**
→ Start with [Building Without Apple Developer Account](#building-without-apple-developer-account)

**Have an Apple Developer account?**
→ Jump to [Production Builds with Code Signing](#production-builds-with-code-signing)

---

## Table of Contents

1. [Building Without Apple Developer Account](#building-without-apple-developer-account) ⭐ START HERE
2. [Production Builds with Code Signing](#production-builds-with-code-signing)
   - [Prerequisites](#prerequisites)
   - [Apple Developer Account Setup](#apple-developer-account-setup)
   - [Local Development Setup](#local-development-setup)
   - [Fastlane Match Configuration](#fastlane-match-configuration)
   - [GitHub Secrets Configuration](#github-secrets-configuration)
   - [Triggering Builds](#triggering-builds)
3. [Troubleshooting](#troubleshooting)
4. [Cost Breakdown](#cost-breakdown)

---

## Building Without Apple Developer Account

**Perfect for:** Development, testing, learning Flutter, prototyping

**What you can do:**
- ✅ Build and run on iOS Simulator
- ✅ Test the app locally
- ✅ CI/CD builds with GitHub Actions
- ✅ Share .app bundles with developers (who have Xcode)

**What you can't do:**
- ❌ Install on physical iOS devices (except with free Apple ID + Xcode workaround)
- ❌ Distribute via TestFlight
- ❌ Publish to App Store
- ❌ Share with non-technical users

### Local Unsigned Builds

#### Method 1: Using Flutter (Recommended for Development)

```bash
cd flutter_admin_app

# Build for simulator (Debug mode)
flutter build ios --simulator

# The .app bundle will be at:
# build/ios/Debug-iphonesimulator/Runner.app

# Run directly on simulator
flutter run
```

#### Method 2: Using Fastlane

```bash
cd flutter_admin_app/ios

# Install Fastlane dependencies (first time only)
bundle install

# Build unsigned app for simulator
bundle exec fastlane build_unsigned
```

### Installing on iOS Simulator

After building, install on a running simulator:

```bash
# List available simulators
xcrun simctl list devices

# Boot a simulator (if not running)
open -a Simulator

# Install the app
xcrun simctl install booted build/ios/Debug-iphonesimulator/Runner.app

# Or simply drag the .app file to the simulator window
```

### GitHub Actions Unsigned Builds

Perfect for CI/CD testing without code signing setup!

**Trigger an unsigned build:**

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Build Flutter iOS Admin App**
4. Click **Run workflow**
5. Select:
   - **Branch:** main (or your branch)
   - **Build type:** unsigned
6. Click **Run workflow**

**Download the build:**

1. Wait for the workflow to complete (~10-15 minutes)
2. Click on the completed workflow run
3. Scroll to **Artifacts** section
4. Download `SSmart-POS-Admin-iOS-Unsigned-XXXXX.zip`
5. Extract and use the .app bundle with a simulator

**No secrets required!** The unsigned workflow runs without any GitHub Secrets configuration.

### Installing on Physical Device (Free Apple ID)

You can test on a physical device using Xcode with a **free Apple ID** (not Apple Developer):

1. Open `Runner.xcworkspace` in Xcode
2. Connect your iOS device
3. In Xcode, go to **Signing & Capabilities**
4. Check **Automatically manage signing**
5. Select your **Team** (your free Apple ID)
6. Xcode will create a free development certificate
7. Click **Run** (▶️) to install on your device

**Limitations with free Apple ID:**
- App expires after 7 days (need to re-install)
- Limited to 3 devices
- Cannot use certain capabilities (e.g., Push Notifications, In-App Purchases)
- Cannot distribute to others

**This is perfect for:**
- Personal testing
- Local development
- Learning iOS app development

### When to Upgrade to Paid Apple Developer

Consider upgrading to Apple Developer Program ($99/year) when:

- ✅ You need to distribute to beta testers via TestFlight
- ✅ You want to publish to the App Store
- ✅ You need apps that don't expire after 7 days
- ✅ You need advanced capabilities (Push Notifications, etc.)
- ✅ You're ready for production deployment

---

## Production Builds with Code Signing

**Requirements:** Apple Developer Program account ($99/year)

This section covers setting up signed builds for TestFlight and App Store distribution.

### Prerequisites

### Required Accounts & Tools

- **Apple Developer Account** ($99/year)
  - Sign up at: https://developer.apple.com
  - Required for code signing and TestFlight distribution

- **GitHub Account** (Free or Pro)
  - Repository access to this project
  - Ability to configure GitHub Actions and Secrets

- **Development Machine** (Mac required for local builds)
  - macOS 12.0 or later
  - Xcode 15.0 or later
  - Flutter 3.24.0 or later
  - Ruby 3.0 or later (for Fastlane)

### Installation Checklist

```bash
# Install Flutter
# Download from: https://flutter.dev/docs/get-started/install

# Verify Flutter installation
flutter doctor -v

# Install Ruby (if not already installed)
# macOS comes with Ruby, but you may want a newer version
brew install ruby

# Install Bundler (Ruby package manager)
gem install bundler

# Install CocoaPods
sudo gem install cocoapods
```

---

## Apple Developer Account Setup

### Step 1: Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (Add button)
4. Select **App IDs** → **Continue**
5. Configure:
   - **Description:** SSmart POS Admin
   - **Bundle ID:** `com.ssmartpos.admin` (Explicit)
   - **Capabilities:** Enable as needed (e.g., Push Notifications)
6. Click **Continue** → **Register**

### Step 2: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** SSmart POS Admin
   - **Primary Language:** English
   - **Bundle ID:** Select `com.ssmartpos.admin`
   - **SKU:** `ssmart-pos-admin` (unique identifier)
4. Click **Create**

### Step 3: Generate App-Specific Password

Required for automated uploads to TestFlight:

1. Go to [Apple ID Account](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **Security** → **App-Specific Passwords**
4. Click **Generate Password**
5. Label it: `GitHub Actions - SSmart POS`
6. **Save this password** - you'll need it for GitHub Secrets

---

## Local Development Setup

### Step 1: Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ssmart-pos.git
cd ssmart-pos/flutter_admin_app

# Install Flutter dependencies
flutter pub get

# Navigate to iOS directory
cd ios

# Install Ruby dependencies (Fastlane, etc.)
bundle install

# Install CocoaPods dependencies
pod install
```

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cd flutter_admin_app
cp .env.example .env

# Edit .env and add your Firebase credentials
# (See FIREBASE_INTEGRATION.md for details)
```

### Step 3: Open in Xcode

```bash
cd ios
open Runner.xcworkspace  # Must use .xcworkspace, not .xcodeproj
```

In Xcode:

1. Select **Runner** target in the project navigator
2. Go to **Signing & Capabilities** tab
3. Configure:
   - **Team:** Select your Apple Developer Team
   - **Bundle Identifier:** `com.ssmartpos.admin`
   - **Signing Certificate:** Apple Development (for local builds)
4. Build and run to verify setup:
   - Select a simulator or connected device
   - Press **Cmd+R** to build and run

---

## Fastlane Match Configuration

Fastlane Match stores your code signing certificates and provisioning profiles in a private Git repository, making it easy to share across team members and CI/CD systems.

### Step 1: Create Private Certificates Repository

1. Go to GitHub and create a **new private repository**
2. Name it: `ssmart-pos-certificates` (or any name you prefer)
3. Initialize with a README
4. **Important:** Keep this repository PRIVATE - it will contain sensitive data

### Step 2: Generate Personal Access Token

1. Go to GitHub **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Configure:
   - **Note:** `Fastlane Match - SSmart POS`
   - **Expiration:** 90 days (or longer)
   - **Scopes:** Check `repo` (full control of private repositories)
4. Click **Generate token**
5. **Copy the token** - you won't see it again!

### Step 3: Initialize Fastlane Match

```bash
cd flutter_admin_app/ios

# Initialize Match (first-time setup)
bundle exec fastlane match init

# When prompted:
# 1. Choose storage mode: git
# 2. Enter Git URL: https://github.com/YOUR_USERNAME/ssmart-pos-certificates.git
```

This creates a `Matchfile` in `ios/fastlane/` directory.

### Step 4: Generate Certificates and Profiles

```bash
# Set required environment variables
export MATCH_PASSWORD="your-secure-encryption-password"  # Create a strong password
export FASTLANE_USER="your-apple-id@example.com"
export FASTLANE_TEAM_ID="YOUR_TEAM_ID"  # Find in Apple Developer Portal

# Generate development certificates and profiles
bundle exec fastlane match development

# Generate App Store certificates and profiles
bundle exec fastlane match appstore
```

**Important Notes:**

- The `MATCH_PASSWORD` encrypts your certificates - **save it securely!**
- You'll be prompted to sign in to your Apple Developer account
- This process may take several minutes
- Certificates are uploaded to your private Git repository

### Step 5: Encode Git Credentials

For GitHub Actions to access your certificates repository, you need to create a Base64-encoded authentication string:

```bash
# Create Base64-encoded "username:token" string
echo -n "YOUR_GITHUB_USERNAME:YOUR_PERSONAL_ACCESS_TOKEN" | base64

# Example output:
# eW91ci11c2VybmFtZTp5b3VyLXRva2Vu

# Save this output - you'll need it for MATCH_GIT_BASIC_AUTH secret
```

---

## GitHub Secrets Configuration

GitHub Secrets store sensitive information needed for the automated build process.

### Step 1: Navigate to Repository Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Step 2: Add Required Secrets

Add each of these secrets one by one:

#### Apple Developer Account Secrets

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `FASTLANE_USER` | Your Apple ID email | The email you use for Apple Developer |
| `FASTLANE_TEAM_ID` | Your Team ID | [Find in Apple Developer Portal](https://developer.apple.com/account/#/membership) - look for "Team ID" |
| `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` | App-specific password | Generated in Step 3 of Apple Developer Account Setup |
| `FASTLANE_SESSION` | (Optional) Pre-authenticated session | See "Advanced: Session Cookie" below |

#### Fastlane Match Secrets

| Secret Name | Description | Example/How to Get |
|------------|-------------|-------------------|
| `MATCH_PASSWORD` | Encryption password for certificates | The password you created in Step 4 of Fastlane Match setup |
| `MATCH_GIT_URL` | URL of certificates repository | `https://github.com/YOUR_USERNAME/ssmart-pos-certificates.git` |
| `MATCH_GIT_BASIC_AUTH` | Base64-encoded credentials | From Step 5 of Fastlane Match setup |
| `MATCH_KEYCHAIN_NAME` | Temporary keychain name | `fastlane_keychain` (can be any name) |
| `MATCH_KEYCHAIN_PASSWORD` | Temporary keychain password | Create a random password, e.g., `TempKeychain123!` |

#### Firebase Configuration Secrets

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `FIREBASE_API_KEY` | Firebase API key | From Firebase Console → Project Settings |
| `FIREBASE_PROJECT_ID` | Firebase project ID | From Firebase Console → Project Settings |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | From Firebase Console → Realtime Database |

### Advanced: Session Cookie (Optional)

To avoid 2FA prompts during automated builds, you can pre-authenticate and save the session:

```bash
# On your local Mac, run:
fastlane spaceauth -u your-apple-id@example.com

# Follow the prompts (including 2FA)
# Copy the output starting with "---" and ending with "---"
# Paste it as the FASTLANE_SESSION secret
```

**Note:** Sessions expire periodically and need to be regenerated.

---

## Triggering Builds

### Signed Production Builds

#### Method 1: Git Tag (Automated Signed Build)

Pushing a tag starting with `flutter-v` automatically triggers a **SIGNED** production build:

```bash
# Create and push a tag
git tag flutter-v1.0.0
git push origin flutter-v1.0.0

# The workflow will:
# 1. Build a SIGNED IPA (uses code signing)
# 2. Upload to TestFlight (if configured)
# 3. Create a GitHub release
```

**Note:** Tags always produce signed builds. For unsigned builds, use manual dispatch.

#### Method 2: Manual Dispatch (Choose Build Type)

1. Go to **Actions** tab in your GitHub repository
2. Select **Build Flutter iOS Admin App** workflow
3. Click **Run workflow**
4. Choose options:
   - **Branch:** main (or your working branch)
   - **Build type:**
     - `unsigned` - Development build (no Apple account needed)
     - `signed` - Production build (requires Apple Developer account)
   - **Deploy to TestFlight:** Yes/No (only for signed builds)
   - **Build number override:** (optional)
5. Click **Run workflow**

#### Method 3: Local Build with Fastlane

**Unsigned (Development):**
```bash
cd flutter_admin_app/ios

# Build unsigned for simulator
bundle exec fastlane build_unsigned
```

**Signed (Production):**
```bash
cd flutter_admin_app/ios

# Build only (no upload)
bundle exec fastlane build_only

# Build and upload to TestFlight
bundle exec fastlane beta

# Build and upload to App Store
bundle exec fastlane release
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Code Signing Errors

**Error:** `No certificate for team 'YOUR_TEAM_ID' matching...`

**Solution:**
```bash
# Re-run match to sync certificates
cd flutter_admin_app/ios
bundle exec fastlane match appstore --readonly false

# If that doesn't work, reset and regenerate
bundle exec fastlane match nuke development
bundle exec fastlane match nuke appstore
bundle exec fastlane match development
bundle exec fastlane match appstore
```

#### 2. Authentication Failures

**Error:** `Apple ID authentication failed`

**Solutions:**
- Verify `FASTLANE_USER` is correct (your Apple ID email)
- Verify `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` is valid
- Generate a new session cookie (`fastlane spaceauth`)
- Check if your Apple Developer account is active

#### 3. Match Repository Access Denied

**Error:** `Authentication failed for 'https://github.com/...'`

**Solutions:**
- Verify `MATCH_GIT_URL` is correct
- Check `MATCH_GIT_BASIC_AUTH` is properly Base64-encoded
- Ensure Personal Access Token has `repo` scope
- Verify token hasn't expired

#### 4. Build Failures

**Error:** Various Flutter or iOS build errors

**Solutions:**
```bash
# Clean Flutter build cache
cd flutter_admin_app
flutter clean
flutter pub get

# Clean iOS build cache
cd ios
rm -rf Pods/
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/*
pod deintegrate
pod install

# Try building locally first
flutter build ios --release
```

#### 5. TestFlight Upload Failures

**Error:** `Could not upload to TestFlight`

**Solutions:**
- Verify app exists in App Store Connect
- Check bundle ID matches (`com.ssmartpos.admin`)
- Ensure app version doesn't already exist
- Check for App Store Connect outages

### Viewing Logs

**GitHub Actions Logs:**
1. Go to **Actions** tab
2. Click on the failed workflow run
3. Expand the failed step to view logs

**Local Fastlane Logs:**
```bash
# Logs are in:
~/Library/Logs/fastlane/
```

### Getting Help

- **Fastlane Docs:** https://docs.fastlane.tools
- **Flutter iOS Deployment:** https://flutter.dev/docs/deployment/ios
- **GitHub Actions:** https://docs.github.com/en/actions
- **Apple Developer Forums:** https://developer.apple.com/forums

---

## Cost Breakdown

### Unsigned Development Builds (No Apple Account)

| Item | Cost | Frequency | Notes |
|------|------|-----------|-------|
| **Flutter SDK** | Free | - | Open source |
| **Xcode** | Free | - | Required for Mac users |
| **GitHub Actions** | Free* | Monthly | Free tier: 2,000 minutes/month for private repos |
| **Free Apple ID** | Free | - | Optional, for device testing with 7-day expiry |

**Total Cost: $0** ✨

*Perfect for:*
- Learning Flutter
- Development and testing
- CI/CD testing
- Small projects
- Prototypes

### Signed Production Builds (With Apple Developer Account)

| Item | Cost | Frequency | Notes |
|------|------|-----------|-------|
| **Apple Developer Program** | $99 | Annual | Required for App Store distribution |
| **GitHub Actions** | Free* | Monthly | Free tier: 2,000 minutes/month for private repos |

*Estimated usage: ~30-60 minutes per build. Free tier should cover ~30-60 builds/month.

**Total Cost: $99/year**

### Optional Costs (Both Build Types)

| Item | Cost | Notes |
|------|------|-------|
| GitHub Pro | $4/month | If you need more Actions minutes |
| GitHub Team | $4/user/month | For team collaboration |
| Mac Mini (for local builds) | $599+ | One-time, if you don't have a Mac |

### Summary

- **Development Only (Unsigned):** $0 - Perfect for getting started!
- **Production (Signed):** $99/year - When you're ready to distribute

---

## Next Steps

After completing this setup:

1. **Test the workflow** with a manual dispatch
2. **Verify TestFlight upload** works correctly
3. **Add testers** in App Store Connect
4. **Create release tags** for automated builds
5. **Monitor builds** in GitHub Actions

## Additional Resources

- [Flutter iOS Deployment Guide](https://flutter.dev/docs/deployment/ios)
- [Fastlane Documentation](https://docs.fastlane.tools)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)

---

**Last Updated:** 2026-06-07

For questions or issues, please open a GitHub issue or contact the development team.
