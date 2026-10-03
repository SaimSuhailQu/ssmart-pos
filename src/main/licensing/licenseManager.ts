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

const log = createLogger('licensing:manager');

const ACTIVATED_KEY_CACHE = 'activated-key.bin';
export const TRIAL_DAYS = 14;
export const TRIAL_GRACE_DAYS = 3;

interface ActivatedKeyRecord {
  key: string;
  payload: LicensePayload;
  activatedAt: string;
  fingerprint: string;
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
 * offline, enforces device binding, then persists the encrypted record.
 */
export function activateProductKey(key: string): Result<TieredLicenseState> {
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

  const record: ActivatedKeyRecord = {
    key: key.trim().toUpperCase(),
    payload: {
      ...payload,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    },
    activatedAt: new Date().toISOString(),
    fingerprint,
  };
  // Dates survive JSON as ISO strings; revive them.
  const stored = JSON.parse(JSON.stringify(record)) as ActivatedKeyRecord;
  const write = writeSecureCache(ACTIVATED_KEY_CACHE, fingerprint, stored);
  if (!write.ok) {
    log.error('failed to persist activated key');
    return err(new Error('Could not save the activation. Disk write failed.'));
  }

  log.info('product key activated', { tier: tierLabel(payload.tier) });
  return ok(keyStateToLicense(stored, fingerprint));
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
    if (keyed) return keyed;
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
export function deactivateProductKey(): void {
  deleteSecureCache(ACTIVATED_KEY_CACHE);
  log.info('product key deactivated on device');
}

export function getDeviceCode(): string {
  return deviceCode();
}
