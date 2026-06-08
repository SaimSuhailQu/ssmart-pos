# GCP Service Account Setup Guide

Complete guide for configuring Firebase using a GCP Service Account key instead of individual secrets.

## Table of Contents

- [Overview](#overview)
- [Three Configuration Methods Compared](#three-configuration-methods-compared)
- [Method 1: GoogleService-Info.plist (RECOMMENDED)](#method-1-googleservice-infoplist-recommended)
- [Method 2: GCP Service Account Key](#method-2-gcp-service-account-key)
- [Method 3: Individual Secrets (Legacy)](#method-3-individual-secrets-legacy)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

The GitHub Actions workflow now supports **three methods** for configuring Firebase credentials, listed from simplest to most complex:

1. **GoogleService-Info.plist** (RECOMMENDED) - Single base64-encoded secret
2. **GCP Service Account Key** - Programmatic access with one JSON key
3. **Individual Secrets** (Legacy) - Eight separate secrets

All three methods produce the same result: a configured `.env` file for the Flutter app.

## Three Configuration Methods Compared

| Feature | Method 1: Plist | Method 2: GCP SA | Method 3: Individual |
|---------|-----------------|------------------|---------------------|
| **Number of Secrets** | 1 | 1 | 8 |
| **Setup Time** | 2 minutes | 5 minutes | 10 minutes |
| **API Calls in CI** | None | Yes (gcloud) | None |
| **Build Speed** | Fastest | Medium | Fast |
| **Requires GCP CLI** | No | Yes (in runner) | No |
| **Maintenance** | Easiest | Easy | Most work |
| **Best For** | Most users | Automation/scripts | Maximum control |

### Quick Recommendation

**Use Method 1 (GoogleService-Info.plist)** unless you need programmatic Firebase configuration or don't have access to the plist file.

---

## Method 1: GoogleService-Info.plist (RECOMMENDED)

This is the **simplest and fastest** method. If you have access to your Firebase project, this is the recommended approach.

### Why This is Best

- ✅ **Single secret** - Only one GitHub Secret to manage
- ✅ **No API calls** - Fastest CI/CD builds
- ✅ **Works offline** - No external dependencies
- ✅ **Direct from Firebase** - No translation needed
- ✅ **Easy to update** - Just re-encode and update secret

### Prerequisites

- Access to Firebase Console
- Base64 encoding capability (built into macOS/Linux)

### Step 1: Download GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select **Project settings**
5. Scroll to **Your apps** section
6. Click on your **iOS app** (or add one if needed)
   - Bundle ID: `com.ssmartpos.admin` (or your custom ID)
7. Click **Download GoogleService-Info.plist**

**Visual Path:**
```
Firebase Console
  → Project Settings (⚙️)
    → Your apps
      → iOS app
        → Download GoogleService-Info.plist
```

### Step 2: Encode to Base64

**On macOS/Linux:**
```bash
cat GoogleService-Info.plist | base64 > encoded-plist.txt
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("GoogleService-Info.plist")) > encoded-plist.txt
```

This creates a file `encoded-plist.txt` with the base64-encoded content.

### Step 3: Add to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Set:
   - **Name:** `GOOGLE_SERVICE_INFO_PLIST`
   - **Value:** Paste the entire contents of `encoded-plist.txt`
5. Click **Add secret**

### Step 4: Test the Setup

1. Go to **Actions** tab
2. Select **Build Flutter iOS Admin App** workflow
3. Click **Run workflow**
4. Select **unsigned** build type
5. Click **Run workflow**

**Expected output in logs:**
```
✓ Using GoogleService-Info.plist from GitHub Secrets (Method 1 - Recommended)
✓ Successfully decoded plist file
✓ Firebase configured successfully via GoogleService-Info.plist
```

### Updating the Plist

If you need to update (e.g., changed Firebase project):

1. Download new `GoogleService-Info.plist`
2. Re-encode: `cat GoogleService-Info.plist | base64`
3. Update GitHub Secret: **Settings → Secrets → Actions → GOOGLE_SERVICE_INFO_PLIST → Update**

---

## Method 2: GCP Service Account Key

Use this method if you need programmatic access or want to automate Firebase configuration retrieval.

### Why Use This Method

- ✅ **Single secret** - One JSON key for everything
- ✅ **Programmatic** - Can retrieve config via API
- ✅ **Follows GCP best practices** - Standard service account pattern
- ✅ **Role-based permissions** - Fine-grained access control

### Prerequisites

- Google Cloud Project with Firebase enabled
- GCP Console access with permission to create service accounts
- `gcloud` CLI available (already installed in GitHub Actions runners)

### Step 1: Create Service Account

1. Go to [GCP Console](https://console.cloud.google.com)
2. Select your project (same as Firebase project)
3. Navigate to **IAM & Admin → Service Accounts**
4. Click **Create Service Account**

**Visual Path:**
```
GCP Console
  → IAM & Admin
    → Service Accounts
      → Create Service Account
```

### Step 2: Configure Service Account

**Name and Description:**
- **Service account name:** `github-actions-firebase`
- **Service account ID:** `github-actions-firebase@your-project.iam.gserviceaccount.com`
- **Description:** `Service account for GitHub Actions CI/CD to access Firebase configuration`

Click **Create and Continue**

### Step 3: Grant Permissions

Add these roles (minimum required):

1. **Firebase Admin** (`roles/firebase.admin`)
   - Allows reading Firebase configuration
   - Required for retrieving app config

2. **Service Account User** (`roles/iam.serviceAccountUser`)
   - Allows acting as the service account
   - Required for authentication

**Optional but recommended:**
3. **Firebase Viewer** (`roles/firebase.viewer`)
   - Read-only access to Firebase resources

Click **Continue** → **Done**

### Step 4: Create and Download Key

1. Find your new service account in the list
2. Click the **three dots (⋮)** → **Manage keys**
3. Click **Add Key → Create new key**
4. Select **JSON** format
5. Click **Create**

A JSON file will download automatically:
```
your-project-12345-abc123def456.json
```

**⚠️ Security Warning:** This key grants access to your Firebase project. Store it securely!

### Step 5: Add Key to GitHub Secrets

1. Open the downloaded JSON file
2. Copy **entire contents** (from `{` to `}`)
3. Go to GitHub: **Settings → Secrets and variables → Actions**
4. Click **New repository secret**
5. Set:
   - **Name:** `GCP_SA_KEY`
   - **Value:** Paste entire JSON content
6. Click **Add secret**

**Example JSON structure:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "github-actions-firebase@your-project.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### Step 6: Enable Required APIs

The workflow requires these APIs to be enabled:

1. **Firebase Management API**
   ```bash
   gcloud services enable firebase.googleapis.com
   ```

2. **Service Usage API**
   ```bash
   gcloud services enable serviceusage.googleapis.com
   ```

Or enable via console:
```
GCP Console
  → APIs & Services
    → Enable APIs and Services
      → Search "Firebase Management API"
        → Enable
```

### Step 7: Test the Setup

1. Go to **Actions** tab
2. Select **Build Flutter iOS Admin App** workflow
3. Click **Run workflow**
4. Select **unsigned** build type
5. Click **Run workflow**

**Expected output in logs:**
```
✓ Using GCP Service Account key from GitHub Secrets (Method 2)
✓ Service account key saved
✓ Successfully authenticated with GCP
✓ Firebase configured successfully via GCP Service Account
```

### Local Testing (Optional)

Test the service account locally before adding to GitHub:

```bash
cd flutter_admin_app

# Test with your service account key
./scripts/setup_from_gcp_sa.sh ~/Downloads/your-project-key.json

# Check generated .env
cat .env
```

### Rotating Service Account Keys

**Best practice:** Rotate keys every 90 days

1. Create new key in GCP Console
2. Update GitHub Secret `GCP_SA_KEY` with new key
3. Delete old key in GCP Console

```
GCP Console
  → IAM & Admin
    → Service Accounts
      → Select service account
        → Keys tab
          → Delete old key
```

---

## Method 3: Individual Secrets (Legacy)

This is the original method. Still supported but **not recommended** for new setups.

### Why You Might Use This

- Maximum control over each value
- No dependencies on external files
- Easy to understand what each value is

### Why You Shouldn't

- ❌ **8 separate secrets** - More to manage
- ❌ **Tedious setup** - Copy/paste 8 times
- ❌ **Easy to miss one** - More error-prone
- ❌ **Harder to update** - Must update multiple secrets

### Setup Instructions

See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for complete instructions.

**Quick summary:**

Add these 8 secrets to GitHub:
1. `FIREBASE_API_KEY`
2. `FIREBASE_AUTH_DOMAIN`
3. `FIREBASE_DATABASE_URL`
4. `FIREBASE_PROJECT_ID`
5. `FIREBASE_STORAGE_BUCKET`
6. `FIREBASE_MESSAGING_SENDER_ID`
7. `FIREBASE_APP_ID`
8. `FIREBASE_MEASUREMENT_ID`

---

## Security Considerations

### Service Account Key Security

**DO:**
- ✅ Store service account keys in GitHub Secrets (encrypted)
- ✅ Use minimal required permissions (Firebase Admin only)
- ✅ Rotate keys every 90 days
- ✅ Delete keys when no longer needed
- ✅ Use separate service accounts for different environments
- ✅ Monitor service account usage in GCP Console
- ✅ Delete downloaded key file after adding to GitHub

**DON'T:**
- ❌ Commit service account keys to Git
- ❌ Share keys via email or chat
- ❌ Use overly broad permissions (Owner, Editor)
- ❌ Leave old keys active indefinitely
- ❌ Use production keys for testing

### GoogleService-Info.plist Security

**DO:**
- ✅ Store base64-encoded plist in GitHub Secrets
- ✅ Add `GoogleService-Info.plist` to `.gitignore`
- ✅ Use separate Firebase projects for dev/staging/prod
- ✅ Enable Firebase App Check for production

**DON'T:**
- ❌ Commit plist file to Git
- ❌ Share plist file publicly
- ❌ Use production Firebase in development

### Access Control

**Who can see secrets?**
- Nobody - secret values are never displayed
- Only GitHub Actions workflows can access them
- Not visible in workflow logs (automatically masked)

**Who can manage secrets?**
- Repository owner
- Users with admin/write permissions

**Audit Trail:**
- Service account usage: GCP Console → IAM & Admin → Service Accounts → View usage
- GitHub Secret updates: Settings → Actions → Secrets (shows update timestamps)

### Revoking Access

**If a service account key is compromised:**

1. **Immediately** delete the key in GCP Console:
   ```
   IAM & Admin → Service Accounts → Keys → Delete
   ```

2. Create new key and update GitHub Secret

3. Review service account activity logs:
   ```bash
   gcloud logging read "protoPayload.authenticationInfo.principalEmail=github-actions-firebase@your-project.iam.gserviceaccount.com" --limit 50
   ```

4. Consider disabling the entire service account temporarily

**If plist is exposed:**
1. Regenerate app in Firebase Console
2. Download new plist
3. Re-encode and update GitHub Secret

### Environment Separation

**Best practice:** Use separate Firebase projects for each environment

```
Development:    ssmart-pos-dev     → GOOGLE_SERVICE_INFO_PLIST_DEV
Staging:        ssmart-pos-staging → GOOGLE_SERVICE_INFO_PLIST_STAGING
Production:     ssmart-pos-prod    → GOOGLE_SERVICE_INFO_PLIST_PROD
```

Use GitHub Environments to manage this:
```yaml
environment: production
env:
  GOOGLE_SERVICE_INFO_PLIST: ${{ secrets.GOOGLE_SERVICE_INFO_PLIST_PROD }}
```

---

## Troubleshooting

### GoogleService-Info.plist Method

#### Issue: "Failed to decode base64 plist"

**Cause:** Incorrect base64 encoding or corrupted file

**Solution:**
```bash
# Re-encode carefully
cat GoogleService-Info.plist | base64 -w 0 > encoded.txt

# Verify it's valid base64
base64 -d encoded.txt > test-decode.xml
plutil -lint test-decode.xml  # macOS only
```

#### Issue: "Invalid plist file format"

**Cause:** File is not a proper XML plist

**Solution:**
- Ensure you downloaded the correct file from Firebase
- File should start with `<?xml version="1.0"?>`
- Use `plutil -lint GoogleService-Info.plist` to validate

### GCP Service Account Method

#### Issue: "gcloud: command not found"

**Cause:** gcloud CLI not installed (shouldn't happen in GitHub Actions)

**Solution for local testing:**
```bash
# macOS
brew install --cask google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Verify
gcloud --version
```

#### Issue: "Failed to authenticate with GCP"

**Cause:** Invalid service account key

**Solutions:**
1. Verify JSON format is correct
2. Check key hasn't been deleted in GCP Console
3. Ensure service account still exists
4. Re-create and download new key

#### Issue: "Could not retrieve Firebase Web API Key"

**Cause:** Firebase Management API not enabled or insufficient permissions

**Solutions:**
1. Enable Firebase Management API:
   ```bash
   gcloud services enable firebase.googleapis.com
   ```

2. Verify service account has Firebase Admin role:
   ```bash
   gcloud projects get-iam-policy PROJECT_ID \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:github-actions-firebase@PROJECT_ID.iam.gserviceaccount.com"
   ```

3. Add Firebase Admin role if missing:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:github-actions-firebase@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/firebase.admin"
   ```

#### Issue: "No Firebase apps found in project"

**Cause:** No iOS or web app configured in Firebase

**Solution:**
1. Go to Firebase Console → Project settings
2. Add an iOS or web app
3. Complete the setup wizard

### General Issues

#### Issue: Workflow says "No Firebase Configuration Found"

**Cause:** No secrets are configured

**Solution:**
1. Verify at least ONE of these secrets exists:
   - `GOOGLE_SERVICE_INFO_PLIST`
   - `GCP_SA_KEY`
   - `FIREBASE_API_KEY`
2. Check secret names are exact (case-sensitive)
3. Ensure secret has a value (not empty)

#### Issue: "App builds but Firebase doesn't work"

**Cause:** Incorrect credentials in .env

**Solutions:**
1. Check workflow logs for errors during setup
2. Verify credentials match Firebase Console
3. Test locally with same credentials
4. Check Firebase security rules allow access

#### Issue: Want to switch methods

**From Individual Secrets to Plist:**
1. Download `GoogleService-Info.plist`
2. Encode to base64
3. Add `GOOGLE_SERVICE_INFO_PLIST` secret
4. Optionally delete 8 individual secrets
5. Re-run workflow (will use plist automatically)

**From Plist to GCP SA:**
1. Create service account and key
2. Add `GCP_SA_KEY` secret
3. Delete `GOOGLE_SERVICE_INFO_PLIST` secret
4. Re-run workflow

---

## Comparison Matrix

### Detailed Feature Comparison

| Aspect | Plist | GCP SA Key | Individual |
|--------|-------|------------|-----------|
| **Complexity** | Very Low | Medium | High |
| **Secrets Count** | 1 | 1 | 8 |
| **External Dependencies** | None | gcloud CLI | None |
| **Firebase API Calls** | No | Yes | No |
| **Build Time** | ~5 sec | ~30 sec | ~5 sec |
| **Offline Capable** | Yes | No | Yes |
| **Easy to Update** | Yes | Medium | Tedious |
| **Rotation Needed** | Rarely | Every 90d | Rarely |
| **GCP Knowledge Needed** | No | Yes | No |
| **Audit Trail** | GitHub | GCP + GitHub | GitHub |
| **Programmatic Access** | No | Yes | No |
| **Recommended For** | Most users | Advanced/Scripts | Precise control |

---

## Summary & Recommendations

### For Most Users: Method 1 (Plist)

Use **GoogleService-Info.plist** if:
- ✅ You have access to Firebase Console
- ✅ You want simplest setup
- ✅ You want fastest CI/CD builds
- ✅ You don't need programmatic configuration

**Setup time: 2 minutes**

### For Advanced Users: Method 2 (GCP SA)

Use **GCP Service Account** if:
- ✅ You need programmatic access
- ✅ You want to follow GCP best practices
- ✅ You're comfortable with IAM and service accounts
- ✅ You need fine-grained permissions

**Setup time: 5 minutes**

### For Maximum Control: Method 3 (Individual)

Use **Individual Secrets** if:
- ✅ You need to override specific values
- ✅ You want to see exactly what each field is
- ✅ You can't use the other methods
- ✅ You prefer explicit configuration

**Setup time: 10 minutes**

---

## Additional Resources

- **Firebase Console:** https://console.firebase.google.com
- **GCP Console:** https://console.cloud.google.com
- **GitHub Actions Secrets:** https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **Service Account Best Practices:** https://cloud.google.com/iam/docs/best-practices-service-accounts
- **Firebase Security Rules:** https://firebase.google.com/docs/rules

## Related Documentation

- [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Individual secrets method (legacy)
- [ENV_SETUP.md](./ENV_SETUP.md) - Local development .env setup
- [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md) - iOS build configuration
- [README.md](./README.md) - Main project documentation

---

**Need Help?**

If you encounter issues not covered here:
1. Check workflow logs in Actions tab
2. Verify Firebase Console settings
3. Test locally with same credentials
4. Create an issue with logs and error messages
