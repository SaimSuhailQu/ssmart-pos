# Environment Setup Guide

Complete guide to configuring your Firebase environment for the SSmart POS Flutter Admin App.

## Overview

This guide covers **two** ways to configure Firebase for the SSmart POS Admin app:

1. **Local Development** → Use `.env` file (faster, simpler)
2. **CI/CD (GitHub Actions)** → Use GitHub Secrets (more secure)

**Quick Decision:**
- Working locally? → Use .env file (this guide)
- Setting up CI/CD? → Use GitHub Secrets ([GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md))
- Both? → Use both (keep values in sync)

## Quick Setup

If you want to skip the details, run the quick start script:

```bash
./quickstart.sh
```

This will guide you through the entire setup interactively.

## Manual Setup

### Prerequisites

Before you begin, ensure you have:

- A Firebase project created (or use existing SSmart POS project)
- Firebase Realtime Database enabled
- Firebase Authentication enabled with Email/Password provider

### Step 1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create a new one)
3. You should see your project dashboard

### Step 2: Get Firebase Configuration

#### For Web/iOS App Configuration:

1. Click the **gear icon** (⚙️) next to "Project Overview"
2. Select **Project settings**
3. Scroll down to **"Your apps"** section
4. If you don't have an iOS app registered:
   - Click **"Add app"** → Select **iOS**
   - iOS bundle ID: `com.ssmart.pos.admin` (or your custom bundle ID)
   - App nickname: `SSmart POS Admin`
   - Click **Register app**
5. You'll see a configuration object with these values

#### Configuration Values Needed:

| Field | Example | Where to Find |
|-------|---------|---------------|
| `FIREBASE_API_KEY` | `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | Project Settings → General → Web API Key |
| `FIREBASE_AUTH_DOMAIN` | `yourproject.firebaseapp.com` | Project Settings → General |
| `FIREBASE_DATABASE_URL` | `https://yourproject-default-rtdb.firebaseio.com` | Realtime Database → Data tab (URL in browser) |
| `FIREBASE_PROJECT_ID` | `yourproject-id` | Project Settings → General → Project ID |
| `FIREBASE_STORAGE_BUCKET` | `yourproject.appspot.com` | Project Settings → General |
| `FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | Project Settings → Cloud Messaging → Sender ID |
| `FIREBASE_APP_ID` | `1:123456789012:ios:abcdef123456` | Project Settings → Your apps → iOS app → App ID |
| `FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Project Settings → Your apps → iOS app (if Analytics enabled) |

#### Visual Guide:

**Finding Project Settings:**
```
Firebase Console
  └─ Click ⚙️ (Settings gear icon)
     └─ Click "Project settings"
        └─ General tab
           ├─ Project ID: your-project-id
           ├─ Web API Key: AIzaSy...
           └─ Your apps section
              └─ iOS app config
```

**Finding Database URL:**
```
Firebase Console
  └─ Build
     └─ Realtime Database
        └─ Data tab
           └─ Look at browser URL bar
              └─ https://yourproject-default-rtdb.firebaseio.com
```

### Step 3: Create .env File

1. Navigate to the flutter_admin_app directory:
   ```bash
   cd flutter_admin_app
   ```

2. Copy the example file:
   ```bash
   cp .env.example .env
   ```

3. Edit the .env file:
   ```bash
   nano .env
   # or
   open .env
   ```

4. Replace all placeholder values with your actual Firebase credentials:

```env
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
FIREBASE_DATABASE_URL=https://yourproject-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=yourproject-id
FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:ios:abcdef123456
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

5. Save and close the file (Ctrl+X, then Y, then Enter in nano)

### Step 4: Verify Configuration

Run the validation script to check your configuration:

```bash
dart run scripts/validate_firebase.dart
```

This will:
- Check if .env file exists
- Verify all required fields are present
- Validate the format of each field
- Report any issues

### Step 5: Set Up Firebase Authentication

The app requires authentication to access Firebase data.

1. Go to **Firebase Console** → **Authentication**
2. Click **"Get started"** (if not already enabled)
3. Click **"Sign-in method"** tab
4. Enable **"Email/Password"** provider
5. Click **"Users"** tab
6. Click **"Add user"**
7. Enter admin credentials:
   - Email: `admin@yourcompany.com`
   - Password: (strong password)
8. Click **"Add user"**

**Important:** Save these credentials! You'll need them to log into the app.

### Step 6: Configure Database Rules

Secure your Realtime Database with proper access rules:

1. Go to **Firebase Console** → **Realtime Database**
2. Click **"Rules"** tab
3. Set the following rules:

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

4. Click **"Publish"**

This ensures only authenticated users can read/write sales data.

## Testing Your Configuration

### Test 1: Validate Configuration

```bash
dart run scripts/validate_firebase.dart
```

Expected output:
```
✓ .env file found
✓ All required Firebase keys present
✓ FIREBASE_API_KEY format valid
✓ FIREBASE_DATABASE_URL format valid
✓ Configuration looks good!
```

### Test 2: Run the App

```bash
flutter run
```

Expected behavior:
1. App launches successfully
2. Shows login screen
3. Can enter email/password
4. Successfully authenticates and shows dashboard

### Test 3: Check Connection

Once logged in, check the app bar:
- Should show green "Online" indicator if Firebase is connected
- Should show sales data if your Electron POS app has synced data

## Common Issues

### Issue 1: "Failed to load .env file"

**Cause:** .env file doesn't exist or is in wrong location

**Solution:**
```bash
# Ensure you're in the flutter_admin_app directory
pwd  # Should end with /flutter_admin_app

# Check if .env exists
ls -la .env

# If not, create it
cp .env.example .env
# Then edit it with your credentials
```

### Issue 2: "Invalid API key"

**Cause:** Wrong API key or extra spaces

**Solution:**
1. Go to Firebase Console → Project Settings
2. Copy the **Web API Key** exactly (no spaces)
3. Paste into .env file
4. Ensure no quotes around the value
5. Save and try again

### Issue 3: "Database URL not found"

**Cause:** Realtime Database not enabled or wrong URL

**Solution:**
1. Go to Firebase Console → Realtime Database
2. If you see "Create Database", click it and create one
3. Copy the URL from browser address bar
4. Should be: `https://yourproject-default-rtdb.firebaseio.com`
5. Update .env file

### Issue 4: "Authentication failed"

**Cause:** User not created or wrong credentials

**Solution:**
1. Go to Firebase Console → Authentication → Users
2. Verify user exists with correct email
3. Reset password if needed
4. Try logging in again

### Issue 5: "Permission denied"

**Cause:** Database rules too restrictive or no authentication

**Solution:**
1. Check Firebase Console → Realtime Database → Rules
2. Ensure rules allow authenticated reads:
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
3. Make sure you're logged in to the app

### Issue 6: ".env file has placeholder values"

**Cause:** You didn't replace the example values

**Solution:**
```bash
# Open .env file
nano .env

# Look for lines like:
FIREBASE_API_KEY=your_api_key_here  # ← Replace this!

# Replace ALL "your_*_here" values with real Firebase credentials
# Save and exit
```

## Security Best Practices

1. **Never commit .env file**
   - Already in .gitignore
   - Double-check before pushing

2. **Use strong admin passwords**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols

3. **Restrict database access**
   - Use authentication for all data access
   - Consider role-based rules for production

4. **Enable App Check** (Production)
   - Prevents API abuse
   - See: https://firebase.google.com/docs/app-check

5. **Rotate API keys regularly**
   - Especially if exposed
   - Update .env file after rotation

## Advanced Configuration

### Multiple Environments

For development, staging, and production:

```bash
# Create environment-specific files
.env.development
.env.staging
.env.production

# Copy appropriate file based on environment
cp .env.production .env  # For production build
```

### Using GitHub Secrets for CI/CD

For GitHub Actions automated builds, use **GitHub Secrets** instead of .env file:

**Why GitHub Secrets?**
- ✅ More secure (encrypted at rest)
- ✅ No .env file in repository
- ✅ Easy to update without code changes
- ✅ Standard for production CI/CD

**Setup:**
1. Don't commit .env file to repository
2. Add Firebase credentials as GitHub Secrets
3. Workflow automatically creates .env from secrets

**Complete Guide:** See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)

**Quick Setup:**
1. Go to GitHub repo → **Settings** → **Secrets** → **Actions**
2. Add these 8 secrets (get from Firebase Console):
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_MEASUREMENT_ID`
3. Run workflow - .env created automatically

**Decision Guide:**
- **Local development** → Use .env file (this guide)
- **GitHub Actions CI/CD** → Use GitHub Secrets ([guide](./GITHUB_SECRETS_SETUP.md))
- **Both** → Keep same values in .env and GitHub Secrets

## Getting Help

If you're still having issues:

1. Run the validator: `dart run scripts/validate_firebase.dart`
2. Check Flutter doctor: `flutter doctor -v`
3. Review Firebase Console for error messages
4. Check app logs: `flutter run --verbose`

## Checklist

Use this checklist to verify your setup:

- [ ] Firebase project created
- [ ] Realtime Database enabled
- [ ] Authentication enabled with Email/Password
- [ ] Admin user created in Authentication
- [ ] .env file created from .env.example
- [ ] All Firebase credentials added to .env
- [ ] No placeholder values remain in .env
- [ ] Database rules configured
- [ ] Configuration validated with script
- [ ] App runs successfully
- [ ] Can log in with admin credentials
- [ ] Dashboard shows "Online" status

## Next Steps

Once your environment is set up:

1. Run the app: `flutter run`
2. Log in with your admin credentials
3. Explore the dashboard and features
4. See README.md for usage instructions
5. See IOS_BUILD_SETUP.md for building iOS apps

---

Need help? Check README.md or create an issue on GitHub.
