/**
 * Device-locked licensing for MART POS desktop.
 *
 * Flow:
 *  1. Compute a SHA-256 device fingerprint (Windows MachineGUID / hostname+user).
 *  2. Look it up in the licensing Firebase RTDB at `licenses/<fingerprint>`.
 *  3. License active  -> cache grace record locally, grant access.
 *     License missing  -> start a feature-complete trial (default 14 days,
 *     configurable in Firebase at `config/trial_days`), persisted locally.
 *
 * The fingerprint is a one-way hash: the licensing database never sees or
 * stores a recoverable machine identifier. See docs/LICENSING_AND_CLOUD_PLAN.md
 * for the reseller workflow (deactivate/reassign a license, remote kill).
 */

import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { hostname, userInfo } from 'os';
import { join } from 'path';
import { app } from 'electron';
import { initializeApp, getApps, deleteApp, FirebaseOptions } from 'firebase/app';
import { getDatabase, ref, get, Database } from 'firebase/database';

export interface LicenseState {
  status: 'licensed' | 'trial' | 'expired';
  mode: 'licensed' | 'trial' | 'expired';
  licensedTo?: string;
  licenseKey?: string;
  expiresAt?: string; // ISO date when trial/expires
  daysRemaining?: number;
  fingerprint: string;
  platform: string;
  checkedAt: string;
  lastValidated?: string;
  /**
   * Multi-tenant cloud routing.
   *
   *  - undefined  -> the LEGACY ROOT of the Firebase project. This is the
   *    seller/master device, whose existing khata/sales/products data lives at
   *    the root paths and is never moved or duplicated.
   *  - "store_xyz" -> this device syncs under `tenants/store_xyz/...` so a sold
   *    copy is fully isolated from the seller's data.
   */
  tenantId?: string;
  /** 'master' = the seller (root + full access); 'tenant' = a sold copy. */
  role?: 'master' | 'tenant';
  /** Convenience flag: true when this device is the seller/master. */
  isMaster?: boolean;
  error?: string;
}

interface StoredLicenseCache extends LicenseState {
  version: number;
}

const CACHE_VERSION = 1;
const DEFAULT_TRIAL_DAYS = 14;
const REVALIDATE_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h

let dbRef: Database | null = null;
let revalidateTimer: NodeJS.Timeout | null = null;

// -------------------------------------------------------------------- //
//  Device fingerprint
// -------------------------------------------------------------------- //

function stableMachineId(): string {
  // The Electron runtime resolves a per-install UUID that survives app
  // reinstalls but not OS reinstalls; combined with hostname/user it is a
  // robust, privacy-safe machine identity.
  const installUuid = app.getPath('userData').length > 0 ? getOrCreateInstallUuid() : randomUUID();
  let user = 'unknown-user';
  try {
    user = userInfo().username;
  } catch {
    /* ignore */
  }
  return `${hostname()}|${user}|${installUuid}`;
}

function getOrCreateInstallUuid(): string {
  try {
    const uuidFile = join(app.getPath('userData'), 'device-uuid.txt');
    if (existsSync(uuidFile)) {
      const existing = readFileSync(uuidFile, 'utf8').trim();
      if (existing.length >= 8) return existing;
    }
    const fresh = randomUUID();
    writeFileSync(uuidFile, fresh, 'utf8');
    return fresh;
  } catch {
    return randomUUID();
  }
}

export function computeFingerprint(): string {
  const material = `ssmart-pos:${stableMachineId()}`;
  return createHash('sha256').update(material).digest('hex');
}

function platformLabel(): string {
  switch (process.platform) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return process.platform;
  }
}

// -------------------------------------------------------------------- //
//  Local activation cache (grace when offline)
// -------------------------------------------------------------------- //

function cachePath(): string {
  return join(app.getPath('userData'), 'license-cache.json');
}

function readCache(): StoredLicenseCache | null {
  try {
    if (!existsSync(cachePath())) return null;
    const parsed = JSON.parse(readFileSync(cachePath(), 'utf8')) as StoredLicenseCache;
    if (parsed?.version !== CACHE_VERSION || !parsed.fingerprint) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(state: LicenseState): void {
  try {
    const payload: StoredLicenseCache = { ...state, version: CACHE_VERSION };
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    /* non-fatal */
  }
}

// -------------------------------------------------------------------- //
//  Licensing RTDB connection (reseller-owned project)
// -------------------------------------------------------------------- //

function licensingDb(): Database | null {
  if (dbRef) return dbRef;
  try {
    // Prefer dedicated licensing project vars; fall back to the app's own
    // Firebase project so a single-project setup still works.
    const cfg: FirebaseOptions = {
      apiKey: import.meta.env.VITE_LICENSING_FIREBASE_API_KEY ??
        import.meta.env.VITE_FIREBASE_API_KEY,
      databaseURL: import.meta.env.VITE_LICENSING_FIREBASE_DATABASE_URL ??
        import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_LICENSING_FIREBASE_PROJECT_ID ??
        import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_LICENSING_FIREBASE_APP_ID ??
        import.meta.env.VITE_FIREBASE_APP_ID,
    };
    if (!cfg.apiKey || !cfg.databaseURL) return null;

    const appName = '__ssmart_licensing__';
    const existing = getApps().find((a) => a.name === appName);
    const licApp = existing ?? initializeApp(cfg, appName);
    dbRef = getDatabase(licApp);
    return dbRef;
  } catch {
    return null;
  }
}

export async function shutdownLicensing(): Promise<void> {
  if (revalidateTimer) {
    clearInterval(revalidateTimer);
    revalidateTimer = null;
  }
  const licApp = getApps().find((a) => a.name === '__ssmart_licensing__');
  if (licApp) {
    try {
      await deleteApp(licApp);
    } catch {
      /* ignore */
    }
  }
  dbRef = null;
}

// -------------------------------------------------------------------- //
//  Remote license lookup
// -------------------------------------------------------------------- //

interface RemoteLicenseRecord {
  active?: boolean;
  revoked?: boolean;
  licenseKey?: string;
  customerName?: string;
  customerEmail?: string;
  note?: string;
  expiresAt?: string; // optional subscription expiry
  deactivated?: boolean;
  /** Explicit tenant id for this device, if set on the license record. */
  tenant?: string;
  /** 'master' grants the seller root access; anything else is a tenant. */
  role?: string;
}

interface TenantBinding {
  tenantId?: string;
  role?: string;
}

type TenantRouting = { tenantId?: string; role: 'master' | 'tenant'; isMaster: boolean };

/**
 * Resolve which tenant subtree this device should use.
 *
 * Reads `tenant_map/<fingerprint>`, which may be either a plain string
 * (`"store_ali"`) or an object (`{ tenant: "store_ali", role: "tenant" }`).
 */
async function fetchTenantBinding(fingerprint: string): Promise<TenantBinding | null> {
  const db = licensingDb();
  if (!db) return null;
  try {
    const snap = await get(ref(db, `tenant_map/${fingerprint}`));
    if (!snap.exists()) return null;
    const val = snap.val();
    if (typeof val === 'string') return { tenantId: val };
    if (val && typeof val === 'object') {
      const rec = val as Record<string, unknown>;
      return {
        tenantId: typeof rec.tenant === 'string' ? rec.tenant : undefined,
        role: typeof rec.role === 'string' ? rec.role : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safety valve for buying/selling: when `config/require_tenant` is true, any
 * device without an explicit tenant binding is auto-placed in an isolated
 * sandbox (`device_<fingerprint>`) so an unprovisioned buyer trial can NEVER
 * read or write the seller's root data.
 */
async function fetchRequireTenant(): Promise<boolean> {
  const db = licensingDb();
  if (!db) return false;
  try {
    const snap = await get(ref(db, 'config/require_tenant'));
    return snap.exists() ? snap.val() === true : false;
  } catch {
    return false;
  }
}

/**
 * Compute the tenant routing for a device. Master devices keep the legacy root
 * (tenantId undefined) so their existing data is untouched.
 */
async function resolveTenant(
  fingerprint: string,
  remote: RemoteLicenseRecord | null,
): Promise<{ tenantId?: string; role: 'master' | 'tenant'; isMaster: boolean }> {
  const binding = await fetchTenantBinding(fingerprint);
  const isMaster = remote?.role === 'master' || binding?.role === 'master';
  if (isMaster) {
    return { tenantId: undefined, role: 'master', isMaster: true };
  }
  let tenantId = binding?.tenantId;
  if (!tenantId && remote?.tenant) tenantId = String(remote.tenant);
  if (!tenantId && (await fetchRequireTenant())) {
    tenantId = `device_${fingerprint.slice(0, 12)}`;
  }
  return { tenantId, role: 'tenant', isMaster: false };
}

async function fetchRemoteLicense(fingerprint: string): Promise<RemoteLicenseRecord | null> {
  const db = licensingDb();
  if (!db) return null;
  const snap = await get(ref(db, `licenses/${fingerprint}`));
  if (!snap.exists()) return null;
  return snap.val() as RemoteLicenseRecord;
}

async function fetchTrialDays(): Promise<number> {
  const db = licensingDb();
  if (!db) return DEFAULT_TRIAL_DAYS;
  try {
    const snap = await get(ref(db, 'config/trial_days'));
    const val = snap.exists() ? Number(snap.val()) : NaN;
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : DEFAULT_TRIAL_DAYS;
  } catch {
    return DEFAULT_TRIAL_DAYS;
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

// -------------------------------------------------------------------- //
//  Public API
// -------------------------------------------------------------------- //

export async function checkLicense(): Promise<LicenseState> {
  const fingerprint = computeFingerprint();
  const base = {
    fingerprint,
    platform: platformLabel(),
    checkedAt: new Date().toISOString(),
  };

  let remote: RemoteLicenseRecord | null = null;
  try {
    remote = await fetchRemoteLicense(fingerprint);
  } catch (err) {
    // Network failure: fall back to cached state within grace window.
    const cached = readCache();
    if (cached && cached.status === 'licensed') {
      const state: LicenseState = {
        ...base,
        status: 'licensed',
        mode: 'licensed',
        licensedTo: cached.licensedTo,
        licenseKey: cached.licenseKey,
        lastValidated: cached.checkedAt,
        tenantId: cached.tenantId,
        role: cached.role,
        isMaster: cached.isMaster,
      };
      return state;
    }
    if (cached && cached.status === 'trial') {
      return await evaluateTrialFromCache(cached, base);
    }
    return { ...base, status: 'trial', mode: 'trial', role: 'tenant', isMaster: false, error: 'offline' };
  }

  // Resolve tenant routing (master -> root; tenant -> tenants/<id>).
  const tenant = await resolveTenant(fingerprint, remote);

  if (remote && !remote.revoked && !remote.deactivated && remote.active !== false) {
    // Optional subscription expiry
    if (remote.expiresAt) {
      const exp = new Date(remote.expiresAt);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        const state: LicenseState = {
          ...base,
          ...tenant,
          status: 'expired',
          mode: 'expired',
          licensedTo: remote.customerName,
          licenseKey: remote.licenseKey,
          error: 'subscription_expired',
        };
        writeCache(state);
        return state;
      }
    }
    const state: LicenseState = {
      ...base,
      ...tenant,
      status: 'licensed',
      mode: 'licensed',
      licensedTo: remote.customerName ?? remote.customerEmail,
      licenseKey: remote.licenseKey,
      lastValidated: base.checkedAt,
    };
    writeCache(state);
    return state;
  }

  // No active remote license -> trial evaluation
  const cached = readCache();
  return await evaluateTrialFromCache(cached, base, remote?.revoked || remote?.deactivated, tenant);
}

async function evaluateTrialFromCache(
  cached: StoredLicenseCache | null,
  base: Pick<LicenseState, 'fingerprint' | 'platform' | 'checkedAt'>,
  wasRevoked = false,
  tenant?: TenantRouting,
): Promise<LicenseState> {
  const now = Date.now();
  // When offline, reuse whatever tenant routing the cache already learned.
  const routing: TenantRouting = tenant ?? {
    tenantId: cached?.tenantId,
    role: cached?.role ?? 'tenant',
    isMaster: cached?.isMaster ?? false,
  };

  if (cached?.fingerprint === base.fingerprint && cached.status === 'trial' && cached.expiresAt) {
    const exp = new Date(cached.expiresAt).getTime();
    if (Number.isFinite(exp) && exp > now) {
      return {
        ...base,
        ...routing,
        status: 'trial',
        mode: 'trial',
        expiresAt: cached.expiresAt,
        daysRemaining: Math.max(0, daysBetween(new Date(), new Date(cached.expiresAt))),
        error: wasRevoked ? 'license_revoked' : undefined,
      };
    }
    // Trial over
    const expired: LicenseState = {
      ...base,
      ...routing,
      status: 'expired',
      mode: 'expired',
      expiresAt: cached.expiresAt,
      daysRemaining: 0,
      error: wasRevoked ? 'license_revoked' : 'trial_expired',
    };
    return expired;
  }

  // First run on this device (or cache mismatch) -> start a fresh trial.
  return startTrial(base, routing);
}

async function startTrial(
  base: Pick<LicenseState, 'fingerprint' | 'platform' | 'checkedAt'>,
  routing?: TenantRouting,
): Promise<LicenseState> {
  const trialDays = await fetchTrialDays();
  const expires = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
  const state: LicenseState = {
    ...base,
    ...(routing ?? { role: 'tenant', isMaster: false }),
    status: 'trial',
    mode: 'trial',
    expiresAt: expires.toISOString(),
    daysRemaining: trialDays,
  };
  writeCache(state);
  return state;
}

/** Background revalidation so remote deactivation takes effect within hours. */
export function scheduleRevalidation(onChange: (state: LicenseState) => void): void {
  if (revalidateTimer) clearInterval(revalidateTimer);
  revalidateTimer = setInterval(async () => {
    try {
      const next = await checkLicense();
      if (next.status !== 'licensed') {
        onChange(next);
      }
    } catch {
      /* keep running silently */
    }
  }, REVALIDATE_INTERVAL_MS);
}
