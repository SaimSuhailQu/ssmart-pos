# SSmart POS — Security & Access Guide

**Who can see and change your data, and why.** Written for you, the owner —
no Firebase expertise required. Everything here reflects the code as of
**v2.3.1** (desktop `2.3.1`, mobile `2.3.1+31`).

---

## 1. The big picture: one database, three locked zones

There is **one Firebase project** (`ssmart-c6e43`) with **one Realtime
Database**. Inside it, data is split into three zones with different locks:

```
ssmart-c6e43-default-rtdb
│
├── sales/  products/  customers/  customer_khata/  expenses/
│   vendors/  purchase_orders/  daily_closings/  …      ← ZONE 1: YOUR SHOP
│
├── tenants/
│   ├── buyer_ali/   sales/  products/  khata/  …        ← ZONE 2: BUYER SHOPS
│   └── buyer_sara/  sales/  products/  khata/  …          (one folder each)
│
├── licenses/  bindings/  tenant_map/  tenantOwners/     ← ZONE 3: LICENSING
└── config/  (trial_days, …)
```

| Zone | What lives there | Who can read/write it |
|---|---|---|
| **1 — Your shop (root)** | All your real POS data | Only **devices that identified themselves** to Firebase (your desktop + your phone). See §3. |
| **2 — Buyer shops (`tenants/<id>/`)** | Each sold copy's data, fully separated | **Only that buyer's Google account** — the rules check the account's unique ID (`uid`) against `tenantOwners/<id>`. Buyer A *physically cannot* read Buyer B's data or yours. |
| **3 — Licensing** | Device registrations, product-key bindings, trial config | Device registrations are readable (needed for activation flows); writes require a signed-in account. |

So the answer to *"does everyone get their own database?"* is: **one shared
database, but every buyer's data is in its own locked folder that only their
Google account can open.** To each buyer it behaves exactly like a private
database. Storage and billing are shared (one Firebase project).

---

## 2. Locks on your mobile admin app

Your phone app (`flutter_admin_app`, "SSmart POS Admin") has **three
independent gates**, in this order:

1. **Owner allowlist (app-side).** Only
   **`saim.suhail.5@gmail.com`** can sign in — by Google *or* by
   email/password. Anyone else is told the app is restricted and is signed
   out immediately. This is enforced at sign-in **and** again on every app
   start (a restored old session that isn't yours gets kicked out).
   → Configured in `flutter_admin_app/lib/core/constants/firebase_constants.dart`
   → `OwnerConfig.masterEmails`. Add a co-owner's Gmail there if you ever want one.

2. **Master license (no trial, ever).** Your account is treated as the
   owner/master: no trial banner, no expiry, no lockout — even offline. Your
   phone also registers itself in `licenses/` as `role: "master"` so it
   agrees with your desktop.

3. **Google Sign-In.** The login screen's Google button signs in your Gmail
   through Firebase Authentication. Your password never touches our code —
   Google verifies it and hands the app a signed token.

**What a tamperer could do:** a modified copy of the IPA could strip gate 1
(and 2). But gate 1 only guards *convenience*: without your Google password
they still can't sign in as you, and the *data* locks in §1/§3 are enforced
by Firebase's servers, which a modified app cannot bypass.

---

## 3. Server-side access: devices must identify themselves (NEW in 2.3.1)

Previously your shop data (Zone 1) was readable by *anyone* who knew the
project's public web config, because the desktop synced without ever signing
in. **This is now fixed:**

- On startup, the desktop (and every sync device) performs a **silent
  anonymous sign-in** to Firebase Authentication — one hidden identity per
  install. No login screen, nothing for you to do.
- The database rules now require `auth != null` for **every business path**
  (Zone 1 root paths and Zone 2 `tenants/`). A random script that only knows
  the web config gets **permission denied**.
- If the sign-in can't complete (offline), the app retries automatically
  (15s → 30s → 45s → 60s) and sync simply waits — nothing is lost; it all
  uploads once the identity lands.

**⚠️ This one rule depends on one console setting:** the **Anonymous**
provider must be enabled, or the desktop's sync will be rejected by the
rules. That's step 2 of the checklist below.

---

## 4. YOUR CHECKLIST — do these once in the Firebase Console

Open https://console.firebase.google.com → project **ssmart-c6e43**.

### ☐ Step 1 — Enable Google sign-in
**Authentication → Sign-in method → "Google" → Enable → Save.**
Without this, the admin app's Google button (even for you) shows
"Google sign-in is not enabled…".

### ☐ Step 2 — Enable Anonymous sign-in  ← *do this BEFORE step 3*
**Authentication → Sign-in method → "Anonymous" → Enable → Save.**
Without this, the **desktop POS sync stops working** once the new rules from
step 3 are published (the app will log exactly this error).

### ☐ Step 3 — Publish the database rules
**Realtime Database → Rules** tab. The live rules are what actually enforce
everything in this document — **nothing deploys them automatically** (there
is no `firebase.json` in this repo; the file is reference-only).

Open `database.rules.json` from this repo, copy its **entire content**, paste
it into the Console rules editor, click **Publish**.

> Publish **after** steps 1–2. The rules are written to be safe the moment
> both providers are on: your devices authenticate themselves, buyers keep
> their isolated folders, and the world gets permission denied.

### ☐ Step 4 — (Optional) Sanity check
**Authentication → Users** will list one anonymous user per device that has
run the new build, plus your Google account after you first sign in on the
phone. That's expected — those are the device identities.

---

## 5. If something stops syncing (troubleshooting)

| Symptom | Cause | Fix |
|---|---|---|
| Desktop log: `Anonymous sign-in provider is disabled` | Step 2 not done | Enable **Anonymous**, restart the desktop app |
| Desktop log: `permission_denied` on sync | Rules published (step 3) but provider missing | Do step 2 (and step 1 for the phone) |
| Phone: "Google sign-in is not enabled" | Step 1 not done | Enable **Google** |
| Phone: "This app is restricted to the owner account" | You signed in with a non-owner Gmail | Sign in with `saim.suhail.5@gmail.com` (or add the Gmail to `OwnerConfig.masterEmails`) |
| Buyer says their app can't reach their data | Their Google account ≠ the account first used on that device | Their device must stay signed in with the SAME Gmail that first activated it (that account owns `tenants/<their-id>/`) |

---

## 6. What each app still can't do (honest limits)

- **Zone 1 rule is identity-based, not account-based:** any *device* that
  completes anonymous sign-in passes `auth != null`. This stops drive-by
  scripts and leaked-config scraping; it does not stop someone who rebuilds
  the desktop app (they'd get an identity like any other install). True
  per-account root lockdown would require giving your desktop a real
  owner login — possible, but it adds a sign-in dependency to your tills.
- **The buyer's license row in `licenses/` is world-readable** by design
  (the device-code activation flow needs it). It contains no shop data.
- **Firebase "web config" values are public by nature** (they're in every
  installed app). That's normal and safe *only together with* the rules in
  §3/§4 — which is exactly why step 3 matters.

---

## 7. Quick reference

| Thing | Where |
|---|---|
| Owner allowlist | `flutter_admin_app/lib/core/constants/firebase_constants.dart` → `OwnerConfig` |
| Device identity logic | `src/syncEngine.ts` → `ensureSyncAuth()` |
| Rules (reference copy) | `database.rules.json` |
| Master/no-trial logic (mobile) | `flutter_admin_app/lib/services/license_service.dart` |
| Master/tenant routing (desktop) | `src/licensing.ts` → `resolveTenant()` |
| Buyer folder ownership | RTDB `tenantOwners/<tenantId>` = buyer's uid |
