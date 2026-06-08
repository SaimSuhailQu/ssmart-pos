# GitHub Secrets Setup Guide

Complete guide for configuring Firebase environment variables as GitHub Secrets for CI/CD workflows.

## Why Use GitHub Secrets?

GitHub Secrets provide a secure way to store sensitive configuration for your CI/CD pipelines:

**Benefits:**
- ✅ **Encrypted at rest** - Secrets are encrypted in GitHub's database
- ✅ **Access controlled** - Only available to workflows, not visible in logs
- ✅ **No .env needed in CI** - Secrets injected at build time
- ✅ **Easy updates** - Change values without code changes
- ✅ **Team friendly** - Anyone with write access can manage
- ✅ **Production ready** - Industry best practice for CI/CD

**When to Use:**
- **GitHub Actions CI/CD** → Always use GitHub Secrets
- **Production/Staging builds** → Use GitHub Secrets
- **Automated deployments** → Use GitHub Secrets

**When NOT to Use:**
- **Local development** → Use .env file (faster iteration)
- **Quick testing** → Use .env file (simpler)

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step-by-Step Setup](#step-by-step-setup)
- [Secret Naming Convention](#secret-naming-convention)
- [Getting Firebase Credentials](#getting-firebase-credentials)
- [Adding Secrets to GitHub](#adding-secrets-to-github)
- [Verifying Setup](#verifying-setup)
- [Updating Secrets](#updating-secrets)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:

- GitHub repository access with **write permissions** (or higher)
- Firebase project with credentials ready (see [Getting Firebase Credentials](#getting-firebase-credentials))
- Basic understanding of GitHub Actions

## Step-by-Step Setup

### 1. Navigate to Repository Settings

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/YOUR_REPO`
2. Click the **Settings** tab (top right)
3. In the left sidebar, scroll down to **Security** section
4. Click **Secrets and variables**
5. Click **Actions**

**Visual Navigation:**
```
Repository Home
  → Settings (tab)
    → Security (sidebar section)
      → Secrets and variables
        → Actions
          → [Secrets management page]
```

### 2. Add Repository Secrets

On the **Actions secrets** page, you'll see a list of existing secrets (if any) and a **"New repository secret"** button.

For **each** Firebase credential, you'll need to:

1. Click **"New repository secret"** button
2. Enter the **Name** (see [Secret Naming Convention](#secret-naming-convention))
3. Enter the **Value** (the actual Firebase credential)
4. Click **"Add secret"**

**Example for FIREBASE_API_KEY:**
```
┌─────────────────────────────────────────┐
│ Name                                    │
│ ┌─────────────────────────────────────┐ │
│ │ FIREBASE_API_KEY                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Value                                   │
│ ┌─────────────────────────────────────┐ │
│ │ AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│           [Add secret]                  │
└─────────────────────────────────────────┘
```

Repeat this process for all 8 Firebase secrets.

## Secret Naming Convention

Use these **exact** names for GitHub Secrets (case-sensitive):

| Secret Name | Description | Required? |
|-------------|-------------|-----------|
| `FIREBASE_API_KEY` | Firebase Web API Key | Yes |
| `FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain | Yes |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | Yes |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | Yes |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | Yes |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID | Yes |
| `FIREBASE_APP_ID` | Firebase App ID (iOS/Web) | Yes |
| `FIREBASE_MEASUREMENT_ID` | Google Analytics Measurement ID | Optional* |

*Optional: Only needed if Google Analytics is enabled in your Firebase project.

**Important:**
- Secret names are **case-sensitive**
- Use exactly these names (workflow expects them)
- Don't use quotes around values

## Getting Firebase Credentials

### Method 1: Firebase Console (Web UI)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Select your project

2. **Open Project Settings**
   - Click the ⚙️ (gear icon) next to "Project Overview"
   - Click "Project settings"

3. **Get General Configuration**
   - Scroll to "Your apps" section
   - If no iOS app exists:
     - Click "Add app" → Select "iOS" platform
     - Bundle ID: `com.ssmart.pos.admin` (or your custom ID)
     - Register app
   - You'll see the Firebase configuration object

4. **Extract Values**

   | Firebase Console Location | Secret Name | Example Value |
   |---------------------------|-------------|---------------|
   | Project settings → General → Web API Key | `FIREBASE_API_KEY` | `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
   | Project settings → General → Project ID | `FIREBASE_PROJECT_ID` | `ssmart-pos-12345` |
   | Your apps → iOS app → Config | `FIREBASE_AUTH_DOMAIN` | `ssmart-pos-12345.firebaseapp.com` |
   | Realtime Database → Data tab (browser URL) | `FIREBASE_DATABASE_URL` | `https://ssmart-pos-12345-default-rtdb.firebaseio.com` |
   | Project settings → General | `FIREBASE_STORAGE_BUCKET` | `ssmart-pos-12345.appspot.com` |
   | Cloud Messaging → Sender ID | `FIREBASE_MESSAGING_SENDER_ID` | `123456789012` |
   | Your apps → iOS app → App ID | `FIREBASE_APP_ID` | `1:123456789012:ios:abcdef123456` |
   | Your apps → iOS app (if Analytics enabled) | `FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` |

### Method 2: From Existing .env File

If you already have a working `.env` file locally:

1. Open your `.env` file:
   ```bash
   cd flutter_admin_app
   cat .env
   ```

2. Copy each value (right side of `=`) to corresponding GitHub Secret
   - **Do NOT** copy the variable names
   - **Do NOT** include quotes
   - **Do NOT** include the `=` sign

Example:
```env
# In .env file:
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# In GitHub Secret:
Name: FIREBASE_API_KEY
Value: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
       ↑ Just the value, no quotes
```

### Method 3: Firebase CLI (Advanced)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Get project info
firebase projects:list

# View app configuration
firebase apps:sdkconfig ios YOUR_APP_ID
```

## Adding Secrets to GitHub

### Step-by-Step for Each Secret

Let's add all 8 secrets:

#### 1. FIREBASE_API_KEY

```
GitHub → Settings → Secrets → Actions → New repository secret

Name: FIREBASE_API_KEY
Value: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

→ Add secret
```

#### 2. FIREBASE_AUTH_DOMAIN

```
Name: FIREBASE_AUTH_DOMAIN
Value: your-project.firebaseapp.com

→ Add secret
```

#### 3. FIREBASE_DATABASE_URL

```
Name: FIREBASE_DATABASE_URL
Value: https://your-project-default-rtdb.firebaseio.com

→ Add secret
```

#### 4. FIREBASE_PROJECT_ID

```
Name: FIREBASE_PROJECT_ID
Value: your-project-id

→ Add secret
```

#### 5. FIREBASE_STORAGE_BUCKET

```
Name: FIREBASE_STORAGE_BUCKET
Value: your-project.appspot.com

→ Add secret
```

#### 6. FIREBASE_MESSAGING_SENDER_ID

```
Name: FIREBASE_MESSAGING_SENDER_ID
Value: 123456789012

→ Add secret
```

#### 7. FIREBASE_APP_ID

```
Name: FIREBASE_APP_ID
Value: 1:123456789012:ios:abcdef123456

→ Add secret
```

#### 8. FIREBASE_MEASUREMENT_ID

```
Name: FIREBASE_MEASUREMENT_ID
Value: G-XXXXXXXXXX

→ Add secret
```

### After Adding All Secrets

You should see all 8 secrets listed:

```
Repository secrets (8)

• FIREBASE_API_KEY              Updated X minutes ago
• FIREBASE_APP_ID               Updated X minutes ago
• FIREBASE_AUTH_DOMAIN          Updated X minutes ago
• FIREBASE_DATABASE_URL         Updated X minutes ago
• FIREBASE_MEASUREMENT_ID       Updated X minutes ago
• FIREBASE_MESSAGING_SENDER_ID  Updated X minutes ago
• FIREBASE_PROJECT_ID           Updated X minutes ago
• FIREBASE_STORAGE_BUCKET       Updated X minutes ago
```

**Note:** Secret values are **never displayed** after creation (security feature).

## Verifying Setup

### Method 1: Run GitHub Actions Workflow

1. Go to **Actions** tab in your repository
2. Select **"Build Flutter iOS Admin App"** workflow
3. Click **"Run workflow"**
4. Select build type: **unsigned** (for testing, no Apple account needed)
5. Click **"Run workflow"**

**Expected Output in Workflow Logs:**

If secrets are configured:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Creating .env from GitHub Secrets
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Environment file created from secrets
  File size: 534 bytes
```

If secrets are NOT configured:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  No Firebase Secrets Found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Firebase secrets are not configured in GitHub Secrets.
...
```

### Method 2: Check Secret Count

Go to **Settings → Secrets → Actions**

You should see **8 Firebase secrets** listed (plus any other secrets you've configured).

### Checklist

- [ ] All 8 Firebase secrets added to GitHub
- [ ] Secret names match exactly (case-sensitive)
- [ ] No quotes or extra spaces in values
- [ ] Workflow runs successfully
- [ ] .env file created in workflow logs
- [ ] Build completes without Firebase errors

## Updating Secrets

To update a secret value:

1. Go to **Settings → Secrets → Actions**
2. Find the secret you want to update
3. Click **"Update"** button next to it
4. Enter the new value
5. Click **"Update secret"**

**Use Cases for Updates:**
- Firebase API key rotation
- Switching to different Firebase project
- Fixing incorrect values
- Security incident response

**Important:**
- Updates take effect immediately for new workflow runs
- Running workflows use the old value
- Re-run workflow to use updated secrets

## Security Considerations

### Best Practices

✅ **DO:**
- Use GitHub Secrets for all CI/CD environments
- Use different Firebase projects for dev/staging/prod
- Rotate secrets periodically (every 90 days recommended)
- Limit repository access to trusted team members
- Use environment-specific secrets for staging vs production
- Enable Firebase App Check for production

❌ **DON'T:**
- Never commit `.env` file with real credentials
- Never share secret values in issues/PRs/chat
- Never log secret values in workflow output
- Don't use production credentials for testing
- Don't share repository access unnecessarily

### Access Control

**Who can see secrets?**
- Nobody! Secret values are **never displayed** after creation
- Only GitHub Actions workflows can access them
- Not visible in workflow logs (masked automatically)

**Who can manage secrets?**
- Repository **owner**
- Users with **admin** permission
- Users with **write** permission (can add/update)

**Who CANNOT see secrets?**
- Users with **read-only** access
- External contributors
- Anyone viewing public repository

### Secret Masking

GitHub automatically masks secret values in logs:

```
# If secret value is: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# In workflow logs you see:
FIREBASE_API_KEY=***
```

This prevents accidental exposure in build outputs.

### Environment Protection

For additional security, use **GitHub Environments**:

1. Go to **Settings → Environments**
2. Create environments: `development`, `staging`, `production`
3. Add secrets to specific environments
4. Configure protection rules (approvals, branch restrictions)

**Example:**
- `production` environment requires manual approval before deployment
- `staging` environment only accessible from `develop` branch
- `development` environment accessible from any branch

## Troubleshooting

### Issue 1: Workflow says "No Firebase Secrets Found"

**Cause:** Secrets not configured or using wrong names

**Solution:**
1. Check **Settings → Secrets → Actions**
2. Verify all 8 secrets are listed
3. Check secret names are **exact** (case-sensitive):
   - ✅ `FIREBASE_API_KEY`
   - ❌ `firebase_api_key`
   - ❌ `Firebase_Api_Key`
4. Re-add any missing secrets

### Issue 2: Build succeeds but Firebase features don't work

**Cause:** Incorrect secret values

**Solution:**
1. Double-check values from Firebase Console
2. Update each secret with correct value
3. Ensure no extra spaces or quotes
4. Re-run workflow

### Issue 3: "Secret value is empty"

**Cause:** Secret created without value

**Solution:**
1. Click **Update** next to the secret
2. Enter the correct value
3. Click **Update secret**

### Issue 4: Can't find "Secrets and variables" option

**Cause:** Insufficient repository permissions

**Solution:**
- Contact repository owner
- Request **write** or **admin** access
- Or ask them to add secrets for you

### Issue 5: Secrets work in one workflow but not another

**Cause:** Secrets are repository-specific

**Solution:**
- If using forks: Add secrets to your fork
- If using multiple repos: Add secrets to each repo
- Cannot share secrets across repositories

### Issue 6: Want to verify secret values

**Problem:** Can't view secret values after creation

**Solution:**
1. Create a temporary workflow to verify:
   ```yaml
   - name: Debug Secrets (REMOVE AFTER TESTING!)
     run: |
       echo "API Key length: ${#FIREBASE_API_KEY}"
       echo "API Key first 5 chars: ${FIREBASE_API_KEY:0:5}"
     env:
       FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
   ```
2. Check partial output (first few characters)
3. **DELETE THIS DEBUG STEP** after verification
4. Never log full secret values

### Issue 7: Migrating from .env to GitHub Secrets

**Need to copy all values?**

Use this script to generate secret add commands:

```bash
# In flutter_admin_app directory
cd flutter_admin_app

# Generate GitHub CLI commands
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ ]] || [[ -z "$key" ]] && continue

  # Clean whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  echo "gh secret set $key --body '$value'"
done < .env

# Copy output and run each command, or:
# Make script executable and run:
# ./migrate-to-secrets.sh
```

Then run the generated commands (requires [GitHub CLI](https://cli.github.com/)):

```bash
gh secret set FIREBASE_API_KEY --body 'AIzaSyXXX...'
gh secret set FIREBASE_AUTH_DOMAIN --body 'project.firebaseapp.com'
# ... etc
```

## Decision Guide: .env vs GitHub Secrets

### Use .env File When:
- ✅ Local development
- ✅ Quick testing and iteration
- ✅ Learning and experimentation
- ✅ Working offline
- ✅ Frequent credential changes during dev

### Use GitHub Secrets When:
- ✅ CI/CD pipelines (GitHub Actions)
- ✅ Automated builds
- ✅ Production/staging deployments
- ✅ Team collaboration
- ✅ Security compliance required
- ✅ Multiple environments (dev/staging/prod)

### Use Both:
The recommended approach is to use **both**:
- **Local development:** `.env` file (gitignored)
- **CI/CD:** GitHub Secrets
- Keep values in sync manually or use 1Password/similar

## Quick Reference

### All Required Secrets

```bash
# Copy this checklist for setup:

□ FIREBASE_API_KEY
□ FIREBASE_AUTH_DOMAIN
□ FIREBASE_DATABASE_URL
□ FIREBASE_PROJECT_ID
□ FIREBASE_STORAGE_BUCKET
□ FIREBASE_MESSAGING_SENDER_ID
□ FIREBASE_APP_ID
□ FIREBASE_MEASUREMENT_ID
```

### Navigation Path

```
GitHub Repository
  → Settings
    → Secrets and variables
      → Actions
        → New repository secret
```

### Firebase Console Path

```
Firebase Console
  → Project Settings (⚙️)
    → General tab
      → Your apps section
        → iOS app config
```

## Additional Resources

- **Official GitHub Docs:** [Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- **Firebase Setup:** [ENV_SETUP.md](./ENV_SETUP.md)
- **Workflow Documentation:** [../.github/workflows/flutter-ios-build.yml](../.github/workflows/flutter-ios-build.yml)
- **Security Best Practices:** [GitHub Security Guides](https://docs.github.com/en/actions/security-guides)

## Getting Help

If you encounter issues:

1. Check this troubleshooting section
2. Review workflow logs in Actions tab
3. Verify Firebase Console for correct values
4. Check [ENV_SETUP.md](./ENV_SETUP.md) for Firebase configuration help
5. Create an issue with error logs

---

**Summary:** GitHub Secrets provide secure, encrypted storage for Firebase credentials in CI/CD. Use them for all automated builds and deployments. For local development, continue using `.env` file.
