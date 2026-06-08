# Firebase Configuration Quick Reference

One-page guide for configuring Firebase credentials in SSmart POS Admin app.

## Two Options Available

### Option 1: .env File (Local Development)
```bash
cd flutter_admin_app
cp .env.example .env
# Edit .env with your Firebase credentials
flutter run
```
**Use for:** Local development, testing, quick iteration

### Option 2: GitHub Secrets (CI/CD)
```
GitHub → Settings → Secrets → Actions → New repository secret
Add all 8 Firebase secrets
Run workflow
```
**Use for:** GitHub Actions, automated builds, production

---

## Quick Decision Tree

```
What are you doing?
│
├─ Working locally on your computer?
│  └─ Use .env file → See ENV_SETUP.md
│
├─ Setting up GitHub Actions CI/CD?
│  └─ Use GitHub Secrets → See GITHUB_SECRETS_SETUP.md
│
└─ Both local and CI/CD?
   └─ Use both (keep same values) → See both guides
```

---

## All 8 Required Firebase Secrets

| # | Secret Name | Example | Where to Find |
|---|-------------|---------|---------------|
| 1 | `FIREBASE_API_KEY` | `AIzaSyXXX...` | Firebase Console → Project Settings → Web API Key |
| 2 | `FIREBASE_AUTH_DOMAIN` | `project.firebaseapp.com` | Firebase Console → Project Settings |
| 3 | `FIREBASE_DATABASE_URL` | `https://project-rtdb.firebaseio.com` | Realtime Database → Data tab URL |
| 4 | `FIREBASE_PROJECT_ID` | `project-id` | Firebase Console → Project Settings |
| 5 | `FIREBASE_STORAGE_BUCKET` | `project.appspot.com` | Firebase Console → Project Settings |
| 6 | `FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | Firebase Console → Cloud Messaging |
| 7 | `FIREBASE_APP_ID` | `1:123456789012:ios:abc123` | Firebase Console → Your apps → iOS app |
| 8 | `FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Firebase Console → iOS app (if Analytics enabled) |

---

## Setup Commands

### Local Development (.env)
```bash
# Interactive setup (recommended)
./quickstart.sh

# Or automated setup
./setup.sh

# Or manual setup
cp .env.example .env
nano .env  # Edit with your credentials
```

### Verify Configuration
```bash
dart run scripts/validate_firebase.dart
flutter run
```

### GitHub Secrets Setup
```bash
# No CLI commands - use GitHub UI:
# 1. Go to repository on GitHub
# 2. Settings → Secrets and variables → Actions
# 3. Click "New repository secret"
# 4. Add each of the 8 secrets above
# 5. Run workflow from Actions tab
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Failed to load .env file" | Create .env: `cp .env.example .env` |
| "Invalid API key" | Check Firebase Console for correct key (no spaces) |
| Workflow says "No secrets found" | Add secrets in Settings → Secrets → Actions |
| Build works but Firebase doesn't | Check all 8 secrets have correct values |

---

## File Locations

```
flutter_admin_app/
├── .env                              # Your local config (gitignored)
├── .env.example                      # Template
├── ENV_SETUP.md                      # Complete .env guide
├── GITHUB_SECRETS_SETUP.md           # Complete GitHub Secrets guide
├── FIREBASE_CONFIG_QUICK_REFERENCE.md # This file
├── README.md                          # Project overview
├── quickstart.sh                      # Interactive setup
└── setup.sh                           # Automated setup
```

---

## Next Steps

### For Local Development:
1. Run `./quickstart.sh`
2. Follow prompts
3. Run app with `flutter run`

### For CI/CD:
1. Read [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)
2. Add secrets to GitHub repository
3. Run workflow from Actions tab

### For Both:
1. Set up .env for local: `./quickstart.sh`
2. Set up GitHub Secrets for CI/CD: See guide
3. Keep values in sync

---

## Documentation Links

- **This Quick Reference** - One-page overview
- **[ENV_SETUP.md](./ENV_SETUP.md)** - Complete .env setup guide
- **[GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)** - Complete GitHub Secrets guide
- **[README.md](./README.md)** - Project documentation
- **[IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md)** - iOS build guide

---

**Last Updated:** 2026-06-08
