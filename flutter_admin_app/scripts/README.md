# Scripts Documentation

This directory contains automation scripts for the SSmart POS Flutter Admin App.

## Available Scripts

### 1. setup_from_plist.sh

**Automated Firebase setup from GoogleService-Info.plist**

This is the fastest way to configure your Firebase credentials. Just provide your plist file and everything is set up automatically.

#### Usage

```bash
./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist
```

#### What it does

1. Validates the plist file format
2. Extracts all Firebase credentials:
   - API_KEY
   - PROJECT_ID
   - DATABASE_URL
   - STORAGE_BUCKET
   - GCM_SENDER_ID (Messaging Sender ID)
   - GOOGLE_APP_ID
   - BUNDLE_ID
3. Derives AUTH_DOMAIN from PROJECT_ID
4. Copies plist to `ios/Runner/GoogleService-Info.plist`
5. Creates `.env` file with all extracted values
6. Validates the configuration (if Dart is available)
7. Shows you next steps

#### Requirements

- Bash shell
- Valid GoogleService-Info.plist file from Firebase Console
- Optional: Flutter/Dart (for validation)

#### Where to get GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click gear icon (⚙️) → Project settings
4. Scroll to "Your apps" section
5. Click on your iOS app (or add one if needed)
6. Click "Download GoogleService-Info.plist"

#### Example

```bash
cd flutter_admin_app

# If file is in Downloads
./scripts/setup_from_plist.sh ~/Downloads/GoogleService-Info.plist

# Or if file is in current directory
./scripts/setup_from_plist.sh ./GoogleService-Info.plist
```

#### Output

```
================================================
SSmart POS Admin - Setup from GoogleService-Info.plist
================================================

✓ Found plist file: /path/to/GoogleService-Info.plist
✓ Plist file is valid
ℹ Extracting Firebase credentials from plist...

✓ Successfully extracted all required credentials

ℹ Firebase Configuration:
  API_KEY: AIzaSy...
  PROJECT_ID: your-project
  AUTH_DOMAIN: your-project.firebaseapp.com
  DATABASE_URL: https://your-project-default-rtdb.firebaseio.com
  STORAGE_BUCKET: your-project.appspot.com
  MESSAGING_SENDER_ID: 123456789
  APP_ID: 1:123456789:ios:abc123
  MEASUREMENT_ID:
  BUNDLE_ID: com.example.app

ℹ Copying plist to ios/Runner/
✓ Copied GoogleService-Info.plist to ios/Runner/
ℹ Creating .env file with Firebase credentials...
✓ Created .env file with Firebase credentials

================================================
Setup Complete!
================================================

What was configured:

✓ GoogleService-Info.plist copied to ios/Runner/
✓ .env file created with Firebase credentials
✓ All required Firebase values extracted and configured

ℹ Files created/updated:
  - ios/Runner/GoogleService-Info.plist
  - .env

⚠ Security Reminders:
  - The .env file is already in .gitignore
  - GoogleService-Info.plist should NOT be committed to Git
  - Keep these files secure and never share them publicly

ℹ Next Steps:

1. Create a Firebase admin user (if not already done):
   - Go to Firebase Console > Authentication > Users > Add user

2. Set up database rules:
   - Go to Firebase Console > Realtime Database > Rules
   - Ensure authenticated read/write access

3. Run the app:
   cd /path/to/flutter_admin_app
   flutter pub get
   flutter run

✓ Setup completed successfully!
```

#### Troubleshooting

**Problem:** "File not found" error

**Solution:** Check the path to your plist file. Use absolute path or relative path from the flutter_admin_app directory.

**Problem:** "Invalid plist file format"

**Solution:** Ensure you downloaded the correct file from Firebase Console. It should be an XML file starting with `<?xml version=`.

**Problem:** "Missing required fields"

**Solution:** Your plist file may be incomplete. Download a fresh copy from Firebase Console.

**Problem:** "Dart not found" during validation

**Solution:** This is just a warning. The setup is complete. Install Flutter to run validation later.

#### Bundle ID Information

The script will show if your plist bundle ID differs from your iOS app bundle ID. This is normal for admin apps:

- **Plist Bundle ID:** `com.ssmartpos` (main POS app)
- **iOS App Bundle ID:** `com.ssmartpos.admin` (admin app)

This is correct because the admin app is a separate app from the main POS app.

### 2. validate_firebase.dart

**Validates Firebase configuration in .env file**

#### Usage

```bash
dart run scripts/validate_firebase.dart
```

#### What it does

1. Checks if .env file exists
2. Verifies all required Firebase fields are present
3. Validates the format of each field
4. Reports any issues or warnings

#### Requirements

- Dart/Flutter installed
- .env file in flutter_admin_app directory

#### Example Output

Success:
```
✓ .env file found
✓ All required Firebase keys present
✓ FIREBASE_API_KEY format valid
✓ FIREBASE_DATABASE_URL format valid
✓ Configuration looks good!
```

With warnings:
```
✓ .env file found
⚠ FIREBASE_MEASUREMENT_ID is empty (Analytics not configured)
✓ All required Firebase keys present
✓ Configuration looks good!
```

With errors:
```
✗ .env file not found
✗ Missing required key: FIREBASE_API_KEY
✗ Invalid DATABASE_URL format
Configuration has errors! Please fix them before running the app.
```

### 3. test_setup.sh

**Tests the setup automation**

Used for development and testing of setup scripts.

#### Usage

```bash
./scripts/test_setup.sh
```

## Common Workflows

### Initial Setup (Recommended)

1. Download GoogleService-Info.plist from Firebase Console
2. Run the automated setup:
   ```bash
   ./scripts/setup_from_plist.sh ~/Downloads/GoogleService-Info.plist
   ```
3. Install dependencies:
   ```bash
   flutter pub get
   ```
4. Run the app:
   ```bash
   flutter run
   ```

### Verify Configuration

```bash
dart run scripts/validate_firebase.dart
```

### Update Firebase Credentials

1. Download new GoogleService-Info.plist from Firebase Console
2. Run the setup script again (it will overwrite existing files):
   ```bash
   ./scripts/setup_from_plist.sh ~/Downloads/GoogleService-Info.plist
   ```

### Manual Configuration

If you prefer to set up manually or the script doesn't work:

1. Copy plist manually:
   ```bash
   cp /path/to/GoogleService-Info.plist ios/Runner/
   ```

2. Create .env from example:
   ```bash
   cp .env.example .env
   ```

3. Edit .env and fill in your Firebase credentials:
   ```bash
   nano .env
   ```

4. Validate:
   ```bash
   dart run scripts/validate_firebase.dart
   ```

## Security Notes

All scripts follow these security best practices:

- Never log sensitive credentials
- Warn about Git commits
- Add files to .gitignore automatically
- Clear instructions about what should not be committed

**Important:** Never commit these files to Git:
- `.env`
- `ios/Runner/GoogleService-Info.plist`

These files are already in `.gitignore` to protect your credentials.

## Contributing

When adding new scripts:

1. Add executable permission: `chmod +x scripts/your_script.sh`
2. Add colored output for better UX
3. Include proper error handling
4. Add validation for all inputs
5. Document in this README

## Support

For issues with scripts:
- Check the troubleshooting section above
- Review the main README.md
- Check ENV_SETUP.md for manual setup instructions
