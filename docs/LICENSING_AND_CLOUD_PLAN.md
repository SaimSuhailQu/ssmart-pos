# SSmart POS — Licensing & Multi-Tenant Cloud Plan

Complete blueprint for selling the POS to multiple stores: per-device license
locking, a reseller-owned Firebase licensing cloud, tenant data isolation, and
the rollout roadmap.

---

## 1. How licensing works today (already implemented)

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

**Buyer activation flow:** buyer installs → app shows device code → buyer
sends it on WhatsApp → you paste it into Firebase (console or admin script) →
app unlocks on next launch or "Recheck Activation".

**Admin (Flutter)** — currently rides on Firebase Auth (you control which
Google accounts can sign in via the Auth allowlist). Per-device binding for
mobile is available via the same licensing RTDB (`DeviceFingerprint` helper
added; wire-up steps in §5).

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

Open Firebase Console → Realtime Database → `licenses` → add child:

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

- **To deactivate / reassign:** set `"active": false` (or delete the node).
  The buyer's app locks itself within 12 h or on next launch; the device code
  can then be reused for a different machine.
- **To extend a subscription:** update `expiresAt`.
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
| Mobile gate wiring | ◻ §5 (half-day) |
| Licensing Cloud Function (secure activation API) | ◻ §7 (1 day) |
| Multi-tenant path scoping | ◻ §3 (2–3 days) |
| Reseller web dashboard (list/activate/revoke) | ◻ §7 (2–3 days) |

---

## 5. Wiring the mobile admin gate (when you sell mobile access)

1. Add `license_service.dart` using the existing `DeviceFingerprint`:
   read `licenses/<fp>` (and `tenant_map/<fp>` in Option B) on startup.
2. In `main.dart`, gate `DashboardScreen` behind the license result exactly
   like the desktop's `LicenseGate` (trial/expired/active).
3. Trial length from `config/trial_days`; cache the state locally so offline
   stores keep working.

## 6. Anti-piracy hardening (practical level)

- Signing/ASAR integrity fuses are already on (forge config).
- The license cache file stores only `{status, fingerprint, expiresAt}` —
  tampering with it cannot forge *activated* state because remote
  revalidation overwrites it within 12 h.
- For high-risk markets, move the activation decision into a Cloud Function
  (§7) and sign responses; the app then verifies the signature with an
  embedded public key.

## 7. Suggested next builds (in order)

1. **Cloud Function `activateLicense`** (admin-key protected) so you can
   activate customers from a WhatsApp link instead of the console.
2. **Reseller dashboard** (single-page; list devices, status, revoke,
   extend) reading the same `licenses` node.
3. **Multi-tenant scoping** per §3 Option B when you cross ~5 stores.
4. **Stripe/easypaisa payment links** in the dashboard for renewals.
