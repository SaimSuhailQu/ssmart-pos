# SS MART POS — Licensing & Multi-Tenant Cloud Plan

Complete blueprint for selling the POS to multiple stores: per-device license
locking, a reseller-owned Firebase licensing cloud, tenant data isolation, and
the rollout roadmap.

---

## 1. How licensing works (desktop + mobile)

**Desktop (Electron)** — `src/licensing.ts` + `src/components/LicenseGate.tsx`:

1. On launch the app computes a **device fingerprint**: SHA-256 of
   `hostname | OS user | install UUID`. It is a one-way hash — the licensing
   database never stores a recoverable machine identifier, and reinstalling
   the app does not change it (the install UUID persists in `userData`).
2. It looks the fingerprint up in the licensing Firebase RTDB at
   `licenses/<fingerprint>`.
3. Outcome:
   - **`active: true`** → app runs fully licensed (customer name recorded).
   - **no record** → a **14-day feature-complete trial** starts, persisted
     locally (`license-cache.json`). Trial length is remotely configurable via
     `config/trial_days`.
   - **`revoked/deactivated` or subscription `expiresAt` passed** → the app
     shows an **Activation Required** screen with the device code to copy.
4. Background revalidation every 12 h means a remote deactivation takes effect
   within hours, even on the buyer's machine. Licensed devices keep a local
   grace cache, so temporary internet outages never block a paying customer.

**Mobile (Flutter Admin)** — `lib/services/license_service.dart` +
`lib/widgets/license_gate.dart`:

Mirrors the desktop system exactly:
1. On launch, computes a SHA-256 device fingerprint via `DeviceFingerprint`
   (Android: ANDROID_ID, iOS: identifierForVendor, Windows: MachineGUID).
2. Checks `licenses/<fingerprint>` in Firebase RTDB.
3. Same trial/licensed/expired states, same offline grace cache, same UI
   (activation screen with copyable device code, trial banner, licensed badge).
4. The gate wraps `DashboardScreen` in `main.dart` so it triggers automatically
   on every app launch.

**Buyer activation flow (both platforms):** buyer installs → app shows device
code → buyer sends it on WhatsApp → you activate it from the **License Manager**
screen on your phone (or Firebase console) → app unlocks on next launch or
"Recheck Activation".

---

## 2. Your reseller Firebase project (one-time setup, ~30 min)

Use a **separate Firebase project** (e.g. `ssmart-licensing`) from any
customer's data project. You own it; customers never see it.

1. Create project → add a **Web app** → enable **Realtime Database** (locked
   mode) and **Email/Password auth** (for your future admin console).
2. Database rules — only your services can read/write licenses:

```json
{
  "rules": {
    "licenses": {
      ".read": false,
      "$fingerprint": {
        ".write": false
      }
    },
    "config": { ".read": false, ".write": false }
  }
}
```

> The desktop app reads licenses with the **Admin SDK from your machine**
> (or via a tiny Cloud Function), not with the public web config. If you prefer
> the app to read directly with the web config, allow read-only on
> `licenses/$fingerprint` — the fingerprint is already a SHA-256, so the DB
> leaks nothing useful. Recommended hardening: keep rules closed and issue
> activations through Cloud Functions (§7).

3. Add licensing env vars to the desktop build (project Keys tab or CI
   secrets): `VITE_LICENSING_FIREBASE_API_KEY`,
   `VITE_LICENSING_FIREBASE_DATABASE_URL`,
   `VITE_LICENSING_FIREBASE_PROJECT_ID`, `VITE_LICENSING_FIREBASE_APP_ID`.
   (Falls back to `VITE_FIREBASE_*` if unset — fine for a single-project setup.)

### Activating a customer (your daily workflow)

**From the mobile app (recommended):**

1. Open the SS MART Admin app on your phone.
2. Tap the profile icon (top-right) → **License Manager**.
3. Tap the green **+ Activate** button.
4. Paste the buyer's device code → fill in customer name → choose role
   (Tenant or Master) → optionally set an expiry date → tap **Activate
   License**.
5. The buyer's app unlocks on next launch or "Recheck Activation".

**From Firebase Console (alternative):**

Open Realtime Database → `licenses` → add child:

```
"9f2c1e…full-device-code…" : {
  "active":       true,
  "licenseKey":   "SSM-XXXX-XXXX",
  "customerName": "Ali Mart, Rawalpindi",
  "customerEmail":"ali@example.com",
  "note":         "Sold 2026-10-01, PKR 15,000 lifetime",
  "expiresAt":    null          // or "2027-10-01" for subscriptions
}
```

- **To deactivate / reassign:** Use the License Manager → three-dot menu →
  Deactivate. Or set `"active": false` in the console. The buyer's app locks
  itself within 12 h or on next launch; the device code can then be reused for
  a different machine.
- **To extend a subscription:** License Manager → three-dot menu → Extend /
  Set Expiry. Or update `expiresAt` in the console.
- One fingerprint = one device. The same code cannot activate two machines.

---

## 3. Multi-tenant data architecture (multiple stores, one cloud)

Each sold copy gets its **own Firebase project** (cleanest isolation, free
tier covers a small store) **or** its own subtree in your master project.

### Option A — one Firebase project per store (recommended to start)

- Store's desktop + admin apps point at their own project via env/`.env`.
- You keep the credentials template; customer data never mixes.
- Backups = one-click project export. Offboarding = delete project.

### Option B — master multi-tenant project (scale play)

Structure RTDB by tenant id; every read/write is scoped by tenant:

```
tenants/
  t_store_ali/   sales, products, customers, vendors, expenses, …
  t_store_2/     …
config/
  trial_days: 14
licenses/        ← per-device licenses (from §2)
tenant_map/      ← device fingerprint → tenant id (binding a sold copy to its data)
```

- Desktop: read `tenant_map/<fingerprint>` at boot; prefix every sync path
  with the tenant id (single change point: `FirebasePaths` root).
- Admin app: sign in with Google → look up `staff/<uid>/tenants` → open that
  tenant's subtree. This is exactly the "customers use their own Google
  account that I allow" model: you add their Google account to
  `staff/<tenant>` in the console; nothing else changes for them.

---

## 4. What is already shipped vs. what remains

| Capability | Status |
|---|---|
| Device fingerprint + SHA-256 privacy-safe device code | ✅ shipped (`src/licensing.ts`) |
| Trial (14-day, remotely configurable) | ✅ shipped |
| Activation screen with copyable device code | ✅ shipped (`LicenseGate.tsx`) |
| Remote kill switch (12 h revalidation) | ✅ shipped |
| Offline grace so paying customers never get locked out | ✅ shipped |
| Licensing Firebase rules + activation workflow | ✅ documented (§2) |
| Mobile fingerprint helper | ✅ shipped (`device_fingerprint.dart`) |
| **Mobile license gate (trial/licensed/expired)** | ✅ shipped (`license_gate.dart`) |
| **Mobile license service** | ✅ shipped (`license_service.dart`) |
| **License Manager screen (activate/deactivate/extend from mobile)** | ✅ shipped |
| **Multi-tenant path scoping (desktop sync)** | ✅ shipped (`syncEngine.setTenant`) |
| **Master access + tenant binding** | ✅ shipped (§6b) |
| Licensing Cloud Function (secure activation API) | ◻ §7 (1 day) |
| Reseller web dashboard (browser-based) | ◻ §7 (2–3 days) |

---

## 5. How to trigger licensing (step-by-step)

### Desktop (Electron POS)

The license gate fires **automatically on every launch** — no manual trigger
needed. Here's the flow:

1. The main process in `src/main.ts` calls `checkLicense()` from
   `src/licensing.ts` during the app boot sequence.
2. The result is forwarded to the renderer via IPC (`getLicenseState`,
   `getDeviceFingerprint`).
3. `src/components/LicenseGate.tsx` wraps the entire app in `App.tsx` and
   displays the appropriate state (trial banner / licensed badge / blocked
   screen).
4. Background revalidation (`scheduleRevalidation`) runs every 12 hours and
   pushes `onLicenseRevoked` if the status changes.

**To test:**
- Delete `license-cache.json` from the Electron userData directory to reset the
  trial.
- Set `licenses/<your-fingerprint>` → `{ "active": false }` in Firebase to
  test revocation. The app will block within 12 h or on restart.

### Mobile (Flutter Admin App)

The license gate fires **automatically after Firebase Auth succeeds** — no
manual trigger needed. Here's the flow:

1. In `lib/main.dart`, the `DashboardScreen` is wrapped in
   `MobileLicenseGate`, which takes a `LicenseService` instance.
2. On init, `MobileLicenseGate` calls `licenseService.checkLicense()` which:
   - Gets the device fingerprint via `DeviceFingerprint.get()`
   - Reads `licenses/<fingerprint>` from Firebase RTDB
   - Returns `licensed`, `trial`, or `expired`
3. The gate then renders the appropriate UI state — identical to the desktop.
4. Offline grace: the license state is cached in
   `ssmart_license_cache.json` so the app works without internet.

**To test:**
- Uninstall and reinstall the app to get a fresh trial.
- Add/remove your device code in `licenses/` in Firebase to test activation
  and revocation.

---

## 6. Anti-piracy hardening (practical level)

- Signing/ASAR integrity fuses are already on (forge config).
- The license cache file stores only `{status, fingerprint, expiresAt}` —
  tampering with it cannot forge *activated* state because remote
  revalidation overwrites it within 12 h.
- For high-risk markets, move the activation decision into a Cloud Function
  (§7) and sign responses; the app then verifies the signature with an
  embedded public key.

## 6b. Selling + Master access (IMPLEMENTED)

The desktop app now routes its cloud sync through a **tenant**, resolved
during the startup license check (`src/licensing.ts` → `resolveTenant`, then
`setTenant` in `src/main.ts`). This lets you sell copies while keeping your own
data exactly where it is.

### How routing is decided (in order)

1. **Master** — if `licenses/<your-fingerprint>` has `role: "master"`, or
   `tenant_map/<your-fingerprint>` has `role: "master"`, your device uses the
   **legacy root paths** (`sales/`, `customer_khata/`, `products/`, …). Your
   existing khata and everything else is **never moved, duplicated or touched**,
   and you get a green **"Master Access"** badge in the desktop app.
2. **Explicit tenant** — `tenant_map/<fingerprint>` = `"store_ali"` (or
   `{ "tenant": "store_ali", "role": "tenant" }`) routes that device to
   `tenants/store_ali/{sales,customer_khata,products,…}`. Fully isolated.
3. **Safety valve** — set `config/require_tenant: true` in the licensing DB and
   any device without a binding is auto-placed in an isolated sandbox
   `tenants/device_<fingerprint>` so an unprovisioned trial can never read or
   write your root data. With the flag absent (default), unmapped devices use
   the root — i.e. **your current single-store behaviour is unchanged**.

### Turn yourself into the master (once)

Driver's-seat only — in your licensing Firebase → Realtime Database:

```
licenses/<your-device-code> : {
  "active": true,
  "customerName": "SS MART (Owner)",
  "role": "master"
}
```

### Sell a copy (buyer workflow)

1. Buyer installs and sends you their **device code** (shown on the activation
   screen).
2. Open the **License Manager** on your phone → tap **+ Activate** → paste the
   device code → set role to Tenant → activate.
   
   Or manually add in Firebase:

```
licenses/<buyer-device-code> : {
  "active": true,
  "customerName": "Ali Mart, Rawalpindi",
  "licenseKey": "SSM-XXXX-XXXX",
  "role": "tenant"
}
tenant_map/<buyer-device-code> : { "tenant": "store_ali", "role": "tenant" }
```

3. The buyer restarts / hits "Recheck Activation". Their app syncs only under
   `tenants/store_ali/`. Your root data is untouched.
4. Recommended: also set `config/require_tenant: true` so no future device can
   accidentally write to the root.

### Notes

- `print_requests` intentionally stays at the **root** so the mobile POS can
  still trigger printing on the desktop regardless of tenant (it is an
  ephemeral command queue, not business data).
- Each sold copy can point at the **same Firebase project** (tenants) or at a
  **separate project** (Option A in §3). Tenant routing composes with either.

---

## 7. Suggested next builds (in order)

1. ~~**Cloud Function `activateLicense`**~~ → **Done.** The **License Manager**
   screen in the mobile admin app lets you activate, deactivate, extend, and
   delete licenses directly from your phone. Changes write straight to Firebase
   RTDB and take effect on the buyer's device within 12 h or on next launch.
2. **Reseller web dashboard** (optional) — a single-page web app reading the
   same `licenses` node. Useful if you want a browser-based view alongside the
   mobile manager.
3. **Multi-tenant scoping** per §3 Option B when you cross ~5 stores.
4. **Stripe/easypaisa payment links** in the dashboard for renewals.
