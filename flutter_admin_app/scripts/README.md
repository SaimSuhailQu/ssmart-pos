# Scripts Directory

This directory contains utility scripts for the Flutter Admin App.

## Available Scripts

### validate_firebase.dart

Firebase configuration validator that checks your `.env` file.

**Usage:**
```bash
dart run scripts/validate_firebase.dart
```

**What it does:**
- Checks if `.env` file exists
- Validates all required Firebase configuration keys are present
- Checks for placeholder values (e.g., "your_api_key_here")
- Validates format of each configuration value
- Provides clear error messages for any issues

**Example Output:**

Success:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Firebase Configuration Validator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ .env file found

Checking required configuration keys...

✓ FIREBASE_API_KEY ✓
✓ FIREBASE_AUTH_DOMAIN ✓
✓ FIREBASE_DATABASE_URL ✓
✓ FIREBASE_PROJECT_ID ✓
✓ FIREBASE_STORAGE_BUCKET ✓
✓ FIREBASE_MESSAGING_SENDER_ID ✓
✓ FIREBASE_APP_ID ✓
✓ FIREBASE_MEASUREMENT_ID ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Configuration validation PASSED!

Your Firebase configuration looks good! ✓
```

Error:
```
✗ .env file not found!

Create it from template:
  cp .env.example .env

Then edit it with your Firebase credentials.
```

## Adding New Scripts

When adding new scripts to this directory:

1. Use descriptive names
2. Add a comment header explaining what the script does
3. Update this README with usage instructions
4. Make shell scripts executable: `chmod +x script.sh`

## Common Issues

### "dart: command not found"

**Solution:** Ensure Flutter is installed and in your PATH:
```bash
flutter --version
```

If Flutter isn't installed, see: https://flutter.dev/docs/get-started/install

### Script won't run (Permission denied)

**Solution:** Make the script executable:
```bash
chmod +x scripts/your_script.sh
```
