# Environment Setup Guide

This guide covers configuring your Firebase environment for the SSmart POS Flutter Admin App.

---

## Prerequisites

Before beginning, ensure you have:
- A Firebase project created.
- Realtime Database enabled in the Firebase Console.
- Firebase Authentication enabled with Email/Password provider.
- An admin user created in Firebase Authentication.

---

## Local Development Setup

### Method 1: Automatic Setup via GoogleService-Info.plist (Recommended)

If you have a `GoogleService-Info.plist` file downloaded from the Firebase Console, run:

```bash
cd flutter_admin_app
./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist
```

This script will automatically:
1. Copy the plist file to `ios/Runner/GoogleService-Info.plist`.
2. Extract all necessary Firebase configuration credentials.
3. Generate the local `.env` file automatically.
4. Run the validation script to verify the configuration.

### Method 2: Manual Setup

If you don't have the plist file, you can configure your environment variables manually:

1. Copy the example environment file:
   ```bash
   cd flutter_admin_app
   cp .env.example .env
   ```
2. Edit `.env` and fill in the values extracted from the Firebase Console Project Settings:
   ```env
   FIREBASE_API_KEY=AIzaSy...
   FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
   FIREBASE_DATABASE_URL=https://yourproject-default-rtdb.firebaseio.com
   FIREBASE_PROJECT_ID=yourproject-id
   FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=123456789012
   FIREBASE_APP_ID=1:123456789012:ios:abcdef123456
   ```

---

## CI/CD Environment Setup (GitHub Actions)

For automated builds in GitHub Actions, do not use a `.env` file. Instead, configure the `GOOGLE_SERVICE_INFO_PLIST` secret as described in the [GitHub Secrets Setup Guide](./GITHUB_SECRETS_SETUP.md).

---

## Verification

To verify that your local environment variables are correctly structured, run the validation script:

```bash
dart run scripts/validate_firebase.dart
```
