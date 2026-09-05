# Quick Setup Guide for SSmart POS Admin

This is a condensed setup guide to get you started quickly. For detailed information, see [README.md](README.md).

## Prerequisites Checklist

- [ ] macOS with Xcode 14+ installed
- [ ] Flutter SDK 3.0.0+ installed (`flutter --version` to check)
- [ ] Firebase project with Realtime Database enabled
- [ ] Electron POS app configured and syncing to Firebase

## 5-Minute Setup

### Step 1: Install Flutter Dependencies

```bash
cd flutter_admin_app
flutter pub get
```

### Step 2: Configure Firebase

Copy and edit the environment file:

```bash
cp .env.example .env
```

Get your Firebase config from:
**Firebase Console → Project Settings → iOS App → Config**

Paste into `.env`:
```env
FIREBASE_API_KEY=your_key_here
FIREBASE_AUTH_DOMAIN=your_domain_here
FIREBASE_DATABASE_URL=your_database_url_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket_here
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Step 3: Create Admin User in Firebase

1. Go to **Firebase Console → Authentication → Users**
2. Click **Add User**
3. Enter email: `admin@yourdomain.com`
4. Enter a strong password
5. Click **Add User**

### Step 4: Set Database Security Rules

Firebase Console → Realtime Database → Rules:

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

Click **Publish**.

### Step 5: Run the App

```bash
flutter run
```

Login with the credentials you created in Step 3.

## Verification Checklist

After setup, verify:

- [ ] App launches without errors
- [ ] Login screen appears
- [ ] Can login with admin credentials
- [ ] Dashboard shows connection status as "Online"
- [ ] Sales data appears (if Electron POS has synced data)
- [ ] Can navigate to Transactions screen
- [ ] Can search and filter transactions

## Common First-Time Issues

### "No such file: .env"
**Solution**: Run `cp .env.example .env` and fill in Firebase credentials.

### "Firebase initialization failed"
**Solution**: Check that all Firebase credentials in `.env` are correct.

### "Login failed"
**Solution**: Verify admin user exists in Firebase Console → Authentication.

### "No Sales Data Yet"
**Solution**:
1. Check Electron POS app is running
2. Verify Firebase Console → Realtime Database has data at `sales/` path
3. Make a test sale in the POS system

## Next Steps

Once setup is complete:

1. **Test Real-Time Sync**: Make a sale in POS, watch it appear in admin app
2. **Explore Features**: Navigate through dashboard and transactions
3. **Customize**: Modify colors, branding in `lib/core/theme/app_theme.dart`
4. **Deploy**: Build for release when ready for production use

## Need Help?

- Check [README.md](README.md) for detailed documentation
- Review Firebase Console for configuration issues
- Ensure Electron POS app is properly configured

---

**Pro Tip**: Keep the Electron POS app and Flutter admin app running simultaneously to see real-time updates in action!
