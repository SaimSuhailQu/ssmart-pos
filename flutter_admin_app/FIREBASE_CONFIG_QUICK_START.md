# Firebase Configuration Quick Start

Choose your configuration method and get started in minutes.

## For GitHub Actions CI/CD

### Method 1: GoogleService-Info.plist (RECOMMENDED) ⭐

**Fastest setup - 2 minutes**

```bash
# 1. Download plist from Firebase Console
# 2. Encode to base64
cat GoogleService-Info.plist | base64

# 3. Add to GitHub:
#    Settings → Secrets → Actions → New repository secret
#    Name: GOOGLE_SERVICE_INFO_PLIST
#    Value: (paste base64 output)

# 4. Run workflow - done!
```

**Why choose this:**
- ✅ Single secret
- ✅ Fastest builds
- ✅ Simplest setup
- ✅ Most reliable

---

### Method 2: GCP Service Account Key

**Advanced setup - 5 minutes**

```bash
# 1. Create service account in GCP Console
#    IAM & Admin → Service Accounts → Create

# 2. Grant Firebase Admin role

# 3. Download JSON key

# 4. Add to GitHub:
#    Settings → Secrets → Actions → New repository secret
#    Name: GCP_SA_KEY
#    Value: (paste entire JSON)

# 5. Run workflow - done!
```

**Why choose this:**
- ✅ Single secret
- ✅ Programmatic access
- ✅ GCP best practices
- ✅ Fine-grained permissions

**Detailed guide:** [GCP_SERVICE_ACCOUNT_SETUP.md](./GCP_SERVICE_ACCOUNT_SETUP.md)

---

### Method 3: Individual Secrets (Legacy)

**Traditional setup - 10 minutes**

```bash
# Add 8 separate secrets to GitHub:
# Settings → Secrets → Actions → New repository secret

FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_DATABASE_URL=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
```

**Why choose this:**
- ✅ Maximum control
- ✅ Override individual values
- ✅ Legacy compatibility

**Detailed guide:** [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)

---

## For Local Development

```bash
cd flutter_admin_app

# Option A: Use plist (fastest)
./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist

# Option B: Use GCP service account
./scripts/setup_from_gcp_sa.sh /path/to/service-account-key.json

# Option C: Manual .env
cp .env.example .env
# Edit .env with your credentials

# Then run the app
flutter pub get
flutter run
```

**Guide:** [ENV_SETUP.md](./ENV_SETUP.md)

---

## Comparison

| Method | Secrets | Setup | Speed | Best For |
|--------|---------|-------|-------|----------|
| **Plist** | 1 | 2 min | Fastest | Most users |
| **GCP SA** | 1 | 5 min | Medium | Advanced |
| **Individual** | 8 | 10 min | Fast | Control |

---

## Quick Decision Tree

**Do you have GoogleService-Info.plist?**
- ✅ YES → Use Method 1 (Plist) - Simplest!
- ❌ NO → Continue...

**Do you need programmatic access?**
- ✅ YES → Use Method 2 (GCP SA)
- ❌ NO → Continue...

**Want maximum control?**
- ✅ YES → Use Method 3 (Individual)
- ❌ NO → Get the plist and use Method 1!

---

## Getting GoogleService-Info.plist

If you don't have it:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click gear icon ⚙️ → Project settings
4. Scroll to "Your apps"
5. Click iOS app (or add one)
6. Download GoogleService-Info.plist

**Then use Method 1 above** - it's the easiest!

---

## Need Help?

- **All three methods:** [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)
- **GCP Service Account details:** [GCP_SERVICE_ACCOUNT_SETUP.md](./GCP_SERVICE_ACCOUNT_SETUP.md)
- **Local development:** [ENV_SETUP.md](./ENV_SETUP.md)
- **Implementation details:** [CI_CD_FIREBASE_IMPLEMENTATION.md](./CI_CD_FIREBASE_IMPLEMENTATION.md)

---

## Testing Your Setup

After adding secrets, test the workflow:

1. Go to **Actions** tab
2. Select **Build Flutter iOS Admin App**
3. Click **Run workflow**
4. Select **unsigned** build type
5. Click **Run workflow**

**Expected output:**

**Method 1:**
```
✓ Using GoogleService-Info.plist (Method 1 - Recommended)
✓ Firebase configured successfully
```

**Method 2:**
```
✓ Using GCP Service Account key (Method 2)
✓ Firebase configured successfully
```

**Method 3:**
```
✓ Using individual Firebase secrets (Method 3 - Legacy)
✓ Firebase configured successfully
```

---

**Recommendation:** Start with Method 1 (GoogleService-Info.plist) - it's the simplest and works for 95% of use cases!
