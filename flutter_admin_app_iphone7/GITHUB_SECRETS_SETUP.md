# GitHub Secrets Setup Guide

This guide details how to configure the Firebase credential secret (`GOOGLE_SERVICE_INFO_PLIST`) for GitHub Actions CI/CD workflows.

---

## The GoogleService-Info.plist Method

The build workflow is configured to use a single GitHub secret containing a base64-encoded copy of your `GoogleService-Info.plist`.

### Step 1: Download GoogleService-Info.plist

1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Select your project.
3. Click the gear icon ⚙️ → **Project settings**.
4. Scroll down to the **Your apps** section.
5. Select your iOS app and click **Download GoogleService-Info.plist**.

### Step 2: Encode to Base64

Run the following command in your terminal to encode the plist file contents:

**macOS / Linux:**
```bash
cat GoogleService-Info.plist | base64
```

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("GoogleService-Info.plist"))
```

### Step 3: Add the Secret to GitHub

1. Navigate to your repository on GitHub.
2. Go to **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
4. Enter the name exactly as: `GOOGLE_SERVICE_INFO_PLIST`
5. Paste the complete base64 string from Step 2 as the value.
6. Click **Add secret**.

---

## Verifying Setup in CI/CD

To verify that the secret was configured correctly:

1. Go to the **Actions** tab in your repository.
2. Select the **Build Flutter iOS Admin App** workflow.
3. Click **Run workflow** and choose **unsigned** (no Apple account needed).
4. Run the workflow and verify that the `Setup Firebase Configuration` step reports:
   ```
   ✓ Using GoogleService-Info.plist from GitHub Secrets
   ✓ Successfully decoded plist file
   ✓ Firebase configured successfully via GoogleService-Info.plist
   ```

---

## Security Considerations

- **Encrypted at Rest:** GitHub Secrets are encrypted at rest and masked in all build outputs.
- **Do Not Commit Plist:** Never commit `GoogleService-Info.plist` or `.env` files to your Git repository. They are ignored by default in `.gitignore`.
