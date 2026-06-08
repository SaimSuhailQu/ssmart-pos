# Setup Checklist

Use this checklist to verify your Flutter Admin App setup is complete and working correctly.

## Prerequisites

- [ ] Flutter SDK installed (version 3.0.0 or higher)
  ```bash
  flutter --version
  ```

- [ ] Xcode installed (macOS only, for iOS development)
  ```bash
  xcodebuild -version
  ```

- [ ] Git installed
  ```bash
  git --version
  ```

## Firebase Setup

- [ ] Firebase project created or existing project identified
- [ ] Firebase Realtime Database enabled
  - Go to Firebase Console → Realtime Database → Create Database

- [ ] Firebase Authentication enabled with Email/Password provider
  - Go to Firebase Console → Authentication → Sign-in method
  - Enable "Email/Password"

- [ ] Admin user created in Firebase Authentication
  - Go to Firebase Console → Authentication → Users → Add user
  - Save credentials for login

- [ ] Database security rules configured
  ```json
  {
    "rules": {
      "sales": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
  ```

## Local Environment Setup

### Option A: Automated Setup (Recommended)

- [ ] Run quick start script
  ```bash
  ./quickstart.sh
  ```

- [ ] Follow interactive prompts
- [ ] Enter Firebase credentials when prompted
- [ ] Validation passes successfully

### Option B: Manual Setup

- [ ] Dependencies installed
  ```bash
  flutter pub get
  ```

- [ ] `.env` file created from template
  ```bash
  cp .env.example .env
  ```

- [ ] Firebase credentials added to `.env` file
  - [ ] FIREBASE_API_KEY
  - [ ] FIREBASE_AUTH_DOMAIN
  - [ ] FIREBASE_DATABASE_URL
  - [ ] FIREBASE_PROJECT_ID
  - [ ] FIREBASE_STORAGE_BUCKET
  - [ ] FIREBASE_MESSAGING_SENDER_ID
  - [ ] FIREBASE_APP_ID
  - [ ] FIREBASE_MEASUREMENT_ID

- [ ] No placeholder values remain in `.env`
  - Check for "your_api_key_here" or similar

- [ ] Configuration validated
  ```bash
  dart run scripts/validate_firebase.dart
  ```

## Testing

### Environment Tests

- [ ] Flutter doctor shows no critical errors
  ```bash
  flutter doctor
  ```

- [ ] Can run Flutter app
  ```bash
  flutter run --dry-run
  ```

### App Functionality Tests

- [ ] App launches successfully
  ```bash
  flutter run
  ```

- [ ] Login screen appears
- [ ] Can enter credentials
- [ ] Login succeeds with Firebase admin credentials
- [ ] Dashboard loads
- [ ] "Online" status shows in app bar (green indicator)
- [ ] No error messages in console

### Data Sync Tests (Optional)

- [ ] Electron POS app is running and syncing
- [ ] Sales data appears in Firebase Console → Realtime Database
- [ ] Sales data appears in Flutter admin app dashboard
- [ ] Transaction list shows sales
- [ ] Can view transaction details
- [ ] Pull-to-refresh updates data

## Build Tests (Optional)

### Simulator Build

- [ ] Can build for iOS simulator
  ```bash
  flutter build ios --simulator
  ```

- [ ] Build completes without errors

### Device Build (requires Apple Developer account)

- [ ] Can build for physical device
  ```bash
  flutter build ios
  ```

- [ ] Can run on physical device
  ```bash
  flutter run -d <device-id>
  ```

## Documentation Review

- [ ] README.md reviewed
- [ ] ENV_SETUP.md reviewed for Firebase setup
- [ ] IOS_BUILD_SETUP.md reviewed (if planning to build)
- [ ] Understand troubleshooting steps

## Common Issues Resolved

Check off issues you've encountered and resolved:

- [ ] "Flutter not found" → Installed Flutter
- [ ] ".env file not found" → Created from template
- [ ] "Invalid API key" → Corrected in .env
- [ ] "Authentication failed" → Created Firebase user
- [ ] "Permission denied" → Updated database rules
- [ ] "Offline status" → Fixed Firebase credentials

## Final Verification

- [ ] All setup steps completed
- [ ] All tests passed
- [ ] App runs without errors
- [ ] Can log in and view dashboard
- [ ] Firebase connection working (online status)
- [ ] Documentation understood
- [ ] Ready to develop/use the app

## Next Steps

Once all items are checked:

1. **Start using the app:**
   ```bash
   flutter run
   ```

2. **Explore features:**
   - Dashboard analytics
   - Transaction list
   - Search and filters
   - Real-time updates

3. **Build for production** (optional):
   - See IOS_BUILD_SETUP.md
   - Set up code signing
   - Build with Fastlane

4. **Customize the app:**
   - Update branding
   - Add new features
   - Configure for your needs

## Getting Help

If you're stuck on any item:

1. **Check documentation:**
   - ENV_SETUP.md for Firebase issues
   - README.md for general setup
   - IOS_BUILD_SETUP.md for build issues

2. **Run diagnostics:**
   ```bash
   flutter doctor -v
   dart run scripts/validate_firebase.dart
   ```

3. **Review common issues:**
   - ENV_SETUP.md has troubleshooting section
   - README.md has troubleshooting section

4. **Check error messages:**
   - Look for specific error codes
   - Search Firebase documentation
   - Check Flutter documentation

---

**Setup complete?** Start coding! 🚀

**Still having issues?** Review the troubleshooting sections in ENV_SETUP.md and README.md.
