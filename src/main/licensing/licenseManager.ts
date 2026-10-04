/**
 * Tiered license manager — the unified licensing entry point.
 *
 * Evaluation order (first decisive win):
 *  1. Offline product key (Ed25519) — activated via "Enter Product Key",
 *     cached encrypted. Works with zero connectivity. Tiers: Standard
 *     (single terminal) and Enterprise (multi-terminal, maxTerminals).
 *  2. Firebase remote license (existing flow in src/licensing.ts) —
 *     device-code activation, remote kill switch, 12h revalidation.
 *  3. Trial — 14 days feature-complete, then a 3-day GRACE period
 *     (banner warning, full function) before the hard lockout.
 *
 * The renderer keeps consuming the existing `LicenseState` shape from
 * `window.api.getLicenseState()`; this manager maps its richer result onto
 * it so LicenseGate needs no protocol change.
 */

import { LicenseState } from '../../types';
import { checkLicense as checkFirebaseLicense } from '../../licensing';
import { computeFingerprint, deviceCode } from './deviceFingerprint';
import {
  LicensePayload,
  LicenseTier,
  isPayloadExpired,
  resolvePublicKey,
  verifyLicenseKey,
} from './licenseKeys';
import { readSecureCache, writeSecureCache, deleteSecureCache, okOrNull } from './secureCache';
import { Result, ok, err } from '../../core/result';
import { createLogger } from '../../core/logger';
import {
  BoundElsewhereError,
  claimBinding,
  clearLicenseRecord,
  firebaseSignIn,
  keyIdFor,
  releaseBinding,
  tenantIdForUid,
  verifyBinding,
} from './binding';
import {
  GoogleSession,
  cachedGoogleEmail,
  googleSilentAuth,
  googleSignOut,
} from './googleAuth';

const log = createLogger('licensing:manager');

const ACTIVATED_KEY_CACHE = 'activated-key.bin';
export const TRIAL_DAYS = 14;
export const TRIAL_GRACE_DAYS = 3;

interface ActivatedKeyRecord {
  key: string;
  /** Public index of the key (sha256, truncated) — used for server binding. */
  keyId: string;
  payload: LicensePayload;
  activatedAt: string;
  fingerprint: string;
  /** Google account that activated the key (device-binding owner). */
  ownerEmail?: string;
  /** Per-user tenant id derived from the Google uid (own database path). */
  tenantId?: string;
}

export interface TieredLicenseState extends LicenseState {
  /** Product tier driving feature/entitlement checks. */
  tier: 'trial' | 'standard' | 'enterprise';
  /** True while inside the post-trial grace window. */
  inGrace?: boolean;
  /** ISO date the grace window ends (trial tier only). */
  graceUntil?: string;
  /** Enterprise: terminals allowed by the key. */
  maxTerminals?: number;
  /** Google account the license is bound to (device-binding flow). */
  ownerEmail?: string;
  /** Set when the server says this key is now bound to another device. */
  boundElsewhere?: { deviceName: string };
}

const tierLabel = (tier: LicenseTier): TieredLicenseState['tier'] =>
  tier === LicenseTier.Enterprise ? 'enterprise' : tier === LicenseTier.Standard ? 'standard' : 'trial';

function baseState(fingerprint: string): Omit<LicenseState, 'status' | 'mode'> {
  return {
    fingerprint,
    platform: process.platform,
    checkedAt: new Date().toISOString(),
  };
}

/** Read the locally activated product key, if any. */
export function getActivatedKey(fingerprint: string): ActivatedKeyRecord | null {
  return okOrNull(readSecureCache<ActivatedKeyRecord>(ACTIVATED_KEY_CACHE, fingerprint));
}

/**
 * Activate a product key on this device. Verifies the Ed25519 signature
 * offline, then — when a Google session is supplied and the network is up —
 * claims the server-side device binding (the anti-sharing lock).
 *
 * Without a Google session the key still activates offline exactly as
 * before (backwards compatible); the binding is claimed on the next
 * Google sign-in via `claimPendingBinding()`.
 */
export async function activateProductKey(
  key: string,
  googleSession?: GoogleSession | null,
): Promise<Result<TieredLicenseState>> {
  const fingerprint = computeFingerprint();
  const publicKey = resolvePublicKey();
  if (!publicKey) {
    return err(new Error('Offline activation is not configured in this build. Contact support.'));
  }

  const verified = verifyLicenseKey(key, publicKey);
  if (!verified.ok) return err(verified.error);
  const payload = verified.value;

  if (isPayloadExpired(payload)) {
    return err(new Error('This product key has expired.'));
  }
  if (payload.deviceBind && payload.deviceBind.toLowerCase() !== fingerprint.toLowerCase()) {
    return err(new Error('This key is bound to a different device.'));
  }
  if (payload.tier === LicenseTier.Trial) {
    return err(new Error('This key is a trial key — trials activate automatically.'));
  }

  const keyId = keyIdFor(key);
  let ownerEmail: string | undefined;
  let tenantId: string | undefined;

  // Server-side device binding (best-effort: offline activation still works).
  if (googleSession) {
    try {
      const user = await firebaseSignIn(googleSession);
      tenantId = tenantIdForUid(user.uid);
      const claim = await claimBinding({
        user,
        keyId,
        fingerprint,
        tier: tierLabel(payload.tier),
        tenantId,
      });
      if (claim.outcome === 'denied') {
        return err(new BoundElsewhereError(claim.deviceName));
      }
      ownerEmail = user.email ?? googleSession.email;
      log.info('device binding claimed', { keyId, outcome: claim.outcome });
    } catch (e) {
      // A definitive "bound elsewhere" is fatal; network hiccups are not.
      if (e instanceof BoundElsewhereError) return err(e);
      log.warn('binding claim failed — continuing offline', { error: String(e) });
    }
  }

  const record: ActivatedKeyRecord = {
    key: key.trim().toUpperCase(),
    keyId,
    payload: {
      ...payload,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    },
    activatedAt: new Date().toISOString(),
    fingerprint,
    ownerEmail,
    tenantId,
  };
  // Dates survive JSON as ISO strings; revive them.
  const stored = JSON.parse(JSON.stringify(record)) as ActivatedKeyRecord;
  const write = writeSecureCache(ACTIVATED_KEY_CACHE, fingerprint, stored);
  if (!write.ok) {
    log.error('failed to persist activated key');
    return err(new Error('Could not save the activation. Disk write failed.'));
  }

  log.info('product key activated', { tier: tierLabel(payload.tier), bound: !!ownerEmail });
  return ok(keyStateToLicense(stored, fingerprint));
}

/**
 * Claim the server binding for a key that was activated offline before
 * the user signed in with Google. Called after googleSignIn().
 */
export async function claimPendingBinding(
  googleSession: GoogleSession,
): Promise<Result<TieredLicenseState>> {
  const fingerprint = computeFingerprint();
  const record = getActivatedKey(fingerprint);
  if (!record) return err(new Error('No activated key on this device.'));
  if (record.ownerEmail) {
    return ok(keyStateToLicense(record, fingerprint)); // already bound
  }
  try {
    const user = await firebaseSignIn(googleSession);
    const tenantId = tenantIdForUid(user.uid);
    const claim = await claimBinding({
      user,
      keyId: record.keyId,
      fingerprint,
      tier: tierLabel(record.payload.tier),
      tenantId,
    });
    if (claim.outcome === 'denied') {
      return err(new BoundElsewhereError(claim.deviceName));
    }
    const updated: ActivatedKeyRecord = {
      ...record,
      ownerEmail: user.email ?? googleSession.email,
      tenantId,
    };
    writeSecureCache(ACTIVATED_KEY_CACHE, fingerprint, JSON.parse(JSON.stringify(updated)));
    log.info('pending binding claimed', { keyId: record.keyId });
    return ok(keyStateToLicense(updated, fingerprint));
  } catch (e) {
    if (e instanceof BoundElsewhereError) return err(e);
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

function keyStateToLicense(record: ActivatedKeyRecord, fingerprint: string): TieredLicenseState {
  const payload: LicensePayload = {
    ...record.payload,
    issuedAt: new Date(record.payload.issuedAt),
    expiresAt: record.payload.expiresAt ? new Date(record.payload.expiresAt) : null,
  };
  return {
    ...baseState(fingerprint),
    status: 'licensed',
    mode: 'licensed',
    tier: tierLabel(payload.tier),
    licensedTo: payload.deviceBind ? `Device ${deviceCode(fingerprint)}` : 'Licensed terminal',
    licenseKey: record.key.slice(0, 12) + '…',
    expiresAt: payload.expiresAt?.toISOString(),
    daysRemaining: payload.expiresAt
      ? Math.max(0, Math.ceil((payload.expiresAt.getTime() - Date.now()) / 86_400_000))
      : undefined,
    maxTerminals: payload.maxTerminals,
    lastValidated: new Date().toISOString(),
    role: payload.tier === LicenseTier.Enterprise ? 'master' : 'tenant',
    isMaster: payload.tier === LicenseTier.Enterprise,
    ownerEmail: record.ownerEmail,
    tenantId: record.tenantId,
  };
}

/** Evaluate an activated key: signature re-check + expiry + binding. */
function evaluateActivatedKey(fingerprint: string): TieredLicenseState | null {
  const record = getActivatedKey(fingerprint);
  if (!record) return null;
  if (record.fingerprint.toLowerCase() !== fingerprint.toLowerCase()) return null;

  const payload: LicensePayload = {
    ...record.payload,
    issuedAt: new Date(record.payload.issuedAt),
    expiresAt: record.payload.expiresAt ? new Date(record.payload.expiresAt) : null,
  };
  if (isPayloadExpired(payload)) {
    log.warn('activated key expired; clearing');
    deleteSecureCache(ACTIVATED_KEY_CACHE);
    return null;
  }
  return keyStateToLicense({ ...record, payload }, fingerprint);
}

function trialStateWithGrace(firebase: LicenseState): TieredLicenseState {
  const now = Date.now();
  const trialEnd = firebase.expiresAt ? new Date(firebase.expiresAt).getTime() : now;
  const graceUntil = trialEnd + TRIAL_GRACE_DAYS * 86_400_000;
  const inGrace = now > trialEnd && now <= graceUntil;

  if (firebase.status === 'expired' && !inGrace) {
    return { ...firebase, tier: 'trial' };
  }
  if (inGrace) {
    return {
      ...firebase,
      status: 'trial',
      mode: 'trial',
      tier: 'trial',
      inGrace: true,
      graceUntil: new Date(graceUntil).toISOString(),
      daysRemaining: 0,
    };
  }
  return { ...firebase, tier: 'trial' };
}

/**
 * The unified license check. Call this from the `get-license-state`
 * IPC handler (see ipc.ts).
 */
export async function evaluateLicense(): Promise<TieredLicenseState> {
  const fingerprint = computeFingerprint();

  // 1. Offline product key — highest priority, works without network.
  try {
    const keyed = evaluateActivatedKey(fingerprint);
    if (keyed) {
      // 1b. Server binding check (online only, definitive answers only).
      // A key moved to another device, or released by its owner, dies here.
      // Offline/timeout/no-record → local state stands (shop keeps selling).
      const verified = await verifyKeyBinding(fingerprint);
      if (verified) return verified;
      return keyed;
    }
  } catch (e) {
    log.warn('activated-key evaluation failed', { error: String(e) });
  }

  // 2. Firebase remote flow (device-code activation, kill switch).
  try {
    const firebase = await checkFirebaseLicense();
    if (firebase.status === 'licensed') {
      return { ...firebase, tier: firebase.isMaster ? 'enterprise' : 'standard' };
    }
    // 3. Trial (+ grace).
    return trialStateWithGrace(firebase);
  } catch (e) {
    log.error('firebase license check failed', { error: String(e) });
    // Fail closed-ish: keep whatever the activated key said (none), else trial w/ error.
    return {
      ...baseState(fingerprint),
      status: 'trial',
      mode: 'trial',
      tier: 'trial',
      error: 'license_check_failed',
    };
  }
}

/** Remove the locally activated product key (support / transfer flow). */
export async function deactivateProductKey(): Promise<void> {
  const fingerprint = computeFingerprint();
  const record = getActivatedKey(fingerprint);
  // Release the server binding so the key can move to another device
  // (after the anti-sharing cooldown). Best-effort: local deactivation
  // always succeeds even offline.
  if (record?.ownerEmail) {
    try {
      const session = await googleSilentAuth();
      if (session) {
        const user = await firebaseSignIn(session);
        await releaseBinding({ user, keyId: record.keyId });
      }
      await clearLicenseRecord(fingerprint);
    } catch (e) {
      log.warn('binding release failed — local key still removed', {
        error: String(e),
      });
    }
    googleSignOut();
  }
  deleteSecureCache(ACTIVATED_KEY_CACHE);
  log.info('product key deactivated on device');
}

/**
 * Launch-time server verification for an activated key.
 * Returns a replacement state only on DEFINITIVE server answers:
 *  - 'revoked'        → binding released → local key is dead
 *  - 'boundElsewhere' → key moved to another device → local key is dead
 * Anything else (offline, timeout, no record yet) → null (keep local).
 */
async function verifyKeyBinding(
  fingerprint: string,
): Promise<TieredLicenseState | null> {
  const record = getActivatedKey(fingerprint);
  if (!record?.keyId) return null;
  // Fast path: never bound to a Google account → nothing to verify.
  if (!record.ownerEmail && !cachedGoogleEmail()) return null;
  try {
    // The binding read is auth-gated: establish the Firebase session first.
    // Silent refresh fails offline → null → local state stands (safe).
    const session = await googleSilentAuth();
    if (!session) return null;
    try {
      await firebaseSignIn(session);
    } catch {
      return null;
    }
    const result = await verifyBinding({ keyId: record.keyId, fingerprint });
    if (result.outcome === 'revoked' || result.outcome === 'boundElsewhere') {
      log.warn('server revoked this device binding — dropping local key', {
        outcome: result.outcome,
      });
      deleteSecureCache(ACTIVATED_KEY_CACHE);
      return {
        ...baseState(fingerprint),
        status: 'trial',
        mode: 'trial',
        tier: 'trial',
        boundElsewhere:
          result.outcome === 'boundElsewhere'
            ? { deviceName: result.deviceName }
            : undefined,
        error: result.outcome === 'revoked' ? 'license_released' : 'license_moved',
      };
    }
    return null; // 'ok' | 'unknown' → local state stands
  } catch {
    return null;
  }
}

export function getDeviceCode(): string {
  return deviceCode();
}
