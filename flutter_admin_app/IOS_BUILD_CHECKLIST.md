# iOS Build Setup Checklist

Use this checklist to verify your iOS build setup is complete.

## Phase 1: Prerequisites ✓

- [ ] Apple Developer account created ($99/year)
- [ ] Mac with Xcode installed (for local setup)
- [ ] Flutter SDK installed (3.24.0+)
- [ ] GitHub repository access
- [ ] Basic understanding of iOS development

## Phase 2: Apple Developer Portal ✓

- [ ] Logged into developer.apple.com
- [ ] Created App ID: `com.ssmartpos.admin`
- [ ] Created app in App Store Connect
- [ ] App name: "SSmart POS Admin"
- [ ] Generated app-specific password
- [ ] Saved Team ID from membership page

## Phase 3: Local Development Setup ✓

- [ ] Cloned repository
- [ ] Ran `flutter pub get`
- [ ] Created `.env` file from `.env.example`
- [ ] Added Firebase credentials to `.env`
- [ ] Navigated to `ios/` directory
- [ ] Ran `bundle install`
- [ ] Ran `pod install`
- [ ] Opened `Runner.xcworkspace` in Xcode
- [ ] Selected development team in Xcode
- [ ] Built app successfully on simulator

## Phase 4: Fastlane Match Setup ✓

- [ ] Created private GitHub repo for certificates
  - Name: `ssmart-pos-certificates` (or similar)
  - Visibility: Private
- [ ] Generated GitHub Personal Access Token
  - Scope: `repo` (full control)
  - Expiration: 90+ days
  - Token saved securely
- [ ] Ran `bundle exec fastlane match init`
- [ ] Created strong `MATCH_PASSWORD`
- [ ] Ran `bundle exec fastlane match development`
- [ ] Ran `bundle exec fastlane match appstore`
- [ ] Verified certificates in private repo
- [ ] Created Base64 Git credentials:
  ```bash
  echo -n "USERNAME:TOKEN" | base64
  ```

## Phase 5: GitHub Secrets Configuration ✓

### Apple Developer Secrets
- [ ] `FASTLANE_USER` - Your Apple ID email
- [ ] `FASTLANE_TEAM_ID` - Your Team ID
- [ ] `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` - App-specific password

### Fastlane Match Secrets
- [ ] `MATCH_PASSWORD` - Encryption password
- [ ] `MATCH_GIT_URL` - Private repo URL
- [ ] `MATCH_GIT_BASIC_AUTH` - Base64 credentials
- [ ] `MATCH_KEYCHAIN_NAME` - `fastlane_keychain`
- [ ] `MATCH_KEYCHAIN_PASSWORD` - Random password

### Firebase Secrets
- [ ] `FIREBASE_API_KEY`
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_DATABASE_URL`

### Optional
- [ ] `FASTLANE_SESSION` - Pre-authenticated session (skips 2FA)

## Phase 6: Testing ✓

### Local Test
- [ ] Built IPA locally:
  ```bash
  cd ios
  bundle exec fastlane build_only
  ```
- [ ] IPA created successfully in `build/` directory
- [ ] No code signing errors

### GitHub Actions Test
- [ ] Went to Actions tab
- [ ] Selected "Build Flutter iOS Admin App"
- [ ] Clicked "Run workflow"
- [ ] Selected branch: `main`
- [ ] Deploy to TestFlight: `No` (first test)
- [ ] Workflow completed successfully
- [ ] IPA artifact available for download
- [ ] No errors in workflow logs

### TestFlight Test (Optional)
- [ ] Ran workflow with TestFlight upload
- [ ] Build appeared in App Store Connect
- [ ] TestFlight processing completed
- [ ] Added internal testers
- [ ] Testers received invitation
- [ ] App installed successfully via TestFlight

## Phase 7: Tag-Based Release ✓

- [ ] Updated version in `pubspec.yaml`
- [ ] Committed changes
- [ ] Created tag: `git tag flutter-v1.0.0`
- [ ] Pushed tag: `git push origin flutter-v1.0.0`
- [ ] Workflow triggered automatically
- [ ] Build completed successfully
- [ ] GitHub release created
- [ ] IPA uploaded to release
- [ ] (If enabled) TestFlight received build

## Phase 8: Documentation Review ✓

- [ ] Read `IOS_BUILD_SETUP.md`
- [ ] Understood troubleshooting section
- [ ] Bookmarked for future reference
- [ ] Team members have access
- [ ] `README.md` reviewed for iOS section

## Troubleshooting Verification ✓

If you encounter issues, verify:

### Code Signing Issues
- [ ] Certificates exist in Match repo
- [ ] `MATCH_PASSWORD` is correct
- [ ] `MATCH_GIT_BASIC_AUTH` is valid Base64
- [ ] Personal Access Token hasn't expired
- [ ] Bundle ID matches: `com.ssmartpos.admin`

### Authentication Issues
- [ ] `FASTLANE_USER` is correct Apple ID
- [ ] App-specific password is valid
- [ ] Not using main Apple ID password
- [ ] Team ID is correct
- [ ] Apple Developer account is active

### Build Failures
- [ ] Flutter version matches (3.24.0)
- [ ] All dependencies installed (`flutter pub get`)
- [ ] CocoaPods installed (`pod install`)
- [ ] Xcode Command Line Tools installed
- [ ] `.env` file exists and is valid

### Workflow Failures
- [ ] All GitHub Secrets configured
- [ ] Secret names exactly match (case-sensitive)
- [ ] Secrets don't have extra spaces
- [ ] Workflow file syntax is valid (YAML)
- [ ] macOS runner available (not self-hosted)

## Maintenance Checklist ✓

### Monthly
- [ ] Check GitHub Personal Access Token expiration
- [ ] Review GitHub Actions usage (free tier: 2,000 min/month)
- [ ] Update app version for new releases

### Yearly
- [ ] Renew Apple Developer account ($99/year)
- [ ] Review and rotate `MATCH_PASSWORD`
- [ ] Update certificates before expiration
- [ ] Review and update documentation

### As Needed
- [ ] Add new test devices (`fastlane register_devices`)
- [ ] Update Fastlane (`bundle update fastlane`)
- [ ] Update Flutter SDK
- [ ] Update Xcode when required by Apple

## Success Criteria ✓

Your setup is complete when:

- [x] iOS platform files exist and are configured
- [x] Fastlane setup is complete
- [x] GitHub Actions workflow exists
- [x] All GitHub Secrets are configured
- [x] Local build succeeds
- [x] GitHub Actions build succeeds
- [x] IPA file is generated
- [x] (Optional) TestFlight upload works
- [x] Documentation is accessible

## Quick Reference

### Create a Release
```bash
# Update version in pubspec.yaml first
git add .
git commit -m "feat: version X.Y.Z"
git tag flutter-vX.Y.Z
git push origin flutter-vX.Y.Z
```

### Local Build
```bash
cd flutter_admin_app/ios
bundle exec fastlane build_only
```

### Upload to TestFlight
```bash
cd flutter_admin_app/ios
bundle exec fastlane beta
```

### Sync Certificates
```bash
cd flutter_admin_app/ios
bundle exec fastlane sync_code_signing
```

## Support

- **Setup Guide**: `IOS_BUILD_SETUP.md`
- **Implementation Summary**: `IOS_BUILD_IMPLEMENTATION_SUMMARY.md`
- **iOS Platform Docs**: `ios/README.md`
- **Main README**: `README.md`

## Notes

- Keep this checklist updated as you complete steps
- Share with team members for onboarding
- Use as reference for future projects
- Update if Apple changes requirements

---

**Last Updated**: 2026-06-07

**Setup Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete
