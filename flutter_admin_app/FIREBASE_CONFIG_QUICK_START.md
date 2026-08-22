# Firebase Configuration Quick Start

This project uses the `GoogleService-Info.plist` file as the single source of truth for configuring Firebase credentials.

## For GitHub Actions CI/CD (GoogleService-Info.plist)

Get set up in 2 minutes:

```bash
# 1. Download GoogleService-Info.plist from the Firebase Console
# 2. Encode the file to base64
cat GoogleService-Info.plist | base64

# 3. Add to GitHub:
#    Go to Settings → Secrets and variables → Actions → New repository secret
#    Name: GOOGLE_SERVICE_INFO_PLIST
#    Value: (paste the base64 output)

# 4. Run the workflow!
```

**Benefits:**
- **Single Secret:** Only one GitHub Secret to manage.
- **Fast Builds:** No external API calls or CLI setups required during checkout.
- **Reliable:** Decodes directly into the build environment.

---

## For Local Development

Configure your local environment automatically using the setup script:

```bash
cd flutter_admin_app

# Run the setup script pointing to your plist file
./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist

# Get dependencies and run
flutter pub get
flutter run
```

This will automatically copy the file to `ios/Runner/GoogleService-Info.plist` and generate the local `.env` configuration file.

---

## How to Download GoogleService-Info.plist

If you do not have the plist file:

1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Select your Firebase project.
3. Click the gear icon ⚙️ → **Project settings**.
4. Scroll down to the **Your apps** section.
5. Select your iOS app and click **Download GoogleService-Info.plist**.
