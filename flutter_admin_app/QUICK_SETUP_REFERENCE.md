# Quick Setup Reference Card

Fast reference for setting up the Flutter iOS Admin App.

## One-Line Setup

```bash
./quickstart.sh
```

That's it! Follow the prompts.

## Common Commands

### Setup & Configuration

```bash
# Automated setup
./setup.sh

# Interactive setup with credential entry
./quickstart.sh

# Validate Firebase configuration
dart run scripts/validate_firebase.dart

# Create .env file
cp .env.example .env
```

### Development

```bash
# Install dependencies
flutter pub get

# Run the app
flutter run

# Run in specific device
flutter run -d <device-id>

# List available devices
flutter devices
```

### Building

```bash
# Build for iOS simulator
flutter build ios --simulator

# Build for device (requires signing)
flutter build ios

# Clean build
flutter clean && flutter pub get && flutter run
```

### Diagnostics

```bash
# Check Flutter installation
flutter doctor

# Verbose Flutter check
flutter doctor -v

# Check Flutter version
flutter --version

# Validate Firebase config
dart run scripts/validate_firebase.dart
```

## Firebase Credentials Needed

Get these from [Firebase Console](https://console.firebase.google.com) → Project Settings → General:

1. **FIREBASE_API_KEY** - Web API Key
2. **FIREBASE_AUTH_DOMAIN** - yourproject.firebaseapp.com
3. **FIREBASE_DATABASE_URL** - Realtime Database URL
4. **FIREBASE_PROJECT_ID** - Project ID
5. **FIREBASE_STORAGE_BUCKET** - yourproject.appspot.com
6. **FIREBASE_MESSAGING_SENDER_ID** - 12-digit number
7. **FIREBASE_APP_ID** - iOS App ID
8. **FIREBASE_MEASUREMENT_ID** - G-XXXXXXXXXX (Analytics)

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Flutter not found | Install from https://flutter.dev/docs/get-started/install |
| .env file not found | Run `cp .env.example .env` |
| Invalid API key | Check Firebase Console, update .env |
| Authentication failed | Create user in Firebase Console → Authentication |
| Permission denied | Update database rules in Firebase Console |
| Offline status | Check .env credentials, verify internet |
| Script won't run | Run `chmod +x setup.sh quickstart.sh` |

## File Locations

- **Configuration:** `.env` (edit this)
- **Setup Script:** `setup.sh`
- **Quick Start:** `quickstart.sh`
- **Validator:** `scripts/validate_firebase.dart`
- **Documentation:** `ENV_SETUP.md`, `README.md`

## Setup Flow

```
┌─────────────────┐
│  ./quickstart.sh │
└────────┬────────┘
         │
         ├─→ Check prerequisites (Flutter, Git, Xcode)
         │
         ├─→ Run flutter pub get
         │
         ├─→ Create .env file
         │
         ├─→ Prompt for Firebase credentials (optional)
         │
         ├─→ Validate configuration
         │
         ├─→ Offer to run app
         │
         └─→ Show next steps
```

## Need Help?

- **Environment Setup:** [ENV_SETUP.md](./ENV_SETUP.md)
- **Full Documentation:** [README.md](./README.md)
- **Setup Checklist:** [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)
- **iOS Builds:** [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md)

## Firebase Console Quick Links

- **Project Settings:** Console → ⚙️ → Project settings
- **Authentication:** Console → Authentication → Users
- **Database:** Console → Realtime Database → Data
- **Rules:** Console → Realtime Database → Rules

## Typical Setup Time

- **With quickstart.sh:** 3-5 minutes
- **Manual setup:** 10-15 minutes
- **First time with Firebase:** 15-20 minutes

## Success Indicators

- [ ] `flutter doctor` shows no errors
- [ ] `dart run scripts/validate_firebase.dart` passes
- [ ] App launches without errors
- [ ] Can log in with Firebase credentials
- [ ] Dashboard shows "Online" status (green)
- [ ] Can view transactions (if data exists)

## Common Next Steps

1. **Create Firebase Admin User:**
   - Firebase Console → Authentication → Add user

2. **Set Database Rules:**
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

3. **Run the App:**
   ```bash
   flutter run
   ```

4. **Test Login:**
   - Use Firebase admin credentials

5. **Verify Connection:**
   - Check for green "Online" indicator

---

**Quick Start:** `./quickstart.sh`

**Validate Config:** `dart run scripts/validate_firebase.dart`

**Run App:** `flutter run`
