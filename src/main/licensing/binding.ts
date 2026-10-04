/**
 * Server-side device binding — the actual "can't run on another device" lock.
 *
 * The Ed25519 product key proves the key is genuine (offline). THIS module
 * proves the key belongs to THIS device, using Firebase as the bouncer:
 *
 *   bindings/<keyId> = {
 *     fingerprint, ownerUid, ownerEmail, deviceName,
 *     tier, tenantId, boundAt, lastSeenAt, releasedAt?, bindCount
 *   }
 *
 * Rules:
 *  - First activation with a key BINDS it to the device fingerprint.
 *  - Same key + same device → welcome back (lastSeenAt refreshed).
 *  - Same key + different device → DENIED ("already active on <device>").
 *    The owner can release the old device (24h rebind cooldown stops
 *    key-sharing games).
 *  - Released binding → the local key is dead on next online check.
 *
 * Offline-first is preserved: every network call has a timeout and any
 * network failure means "keep the local license state". Only a DEFINITIVE
 * server response (record exists, fingerprint differs / released) can
 * downgrade the device. The shop keeps selling through internet outages.
 *
 * RTDB security rules for this layout live in database.rules.json —
 * deploy them in the Firebase console or the binding writes will fail.
 */

import { createHash } from 'crypto';
import { hostname } from 'os';
import {
  FirebaseOptions,
  deleteApp,
  getApps,
  initializeApp,
} from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  get,
  getDatabase,
  ref,
  remove,
  set,
  update,
  type Database,
} from 'firebase/database';
import { createLogger } from '../../core/logger';
import type { GoogleSession } from './googleAuth';

const log = createLogger('licensing:binding');

const NET_TIMEOUT_MS = 10_000;
const REBIND_COOLDOWN_MS = 24 * 3600_000; // 24h after a release

export interface DeviceBinding {
  fingerprint: string;
  ownerUid: string;
  ownerEmail: string;
  deviceName: string;
  keyId: string;
  tier: string;
  tenantId: string;
  boundAt: string;
  lastSeenAt: string;
  releasedAt?: string;
  bindCount: number;
}

export type ClaimResult =
  | { outcome: 'bound' | 'already' | 'rebound'; binding: DeviceBinding }
  | { outcome: 'denied'; deviceName: string; ownerEmail: string };

export type VerifyResult =
  | { outcome: 'ok'; binding: DeviceBinding }
  | { outcome: 'revoked' }
  | { outcome: 'boundElsewhere'; deviceName: string }
  | { outcome: 'unknown' }; // no record / offline — keep local state

export class BoundElsewhereError extends Error {
  readonly deviceName: string;
  constructor(deviceName: string) {
    super(
      `This product key is already active on "${deviceName}". Release it there (or ask your reseller) before activating here.`,
    );
    this.name = 'BoundElsewhereError';
    this.deviceName = deviceName;
  }
}

/** keyId = stable public index for a product key (never the key itself). */
export function keyIdFor(key: string): string {
  return createHash('sha256')
    .update(`ssmart-pos:key-id:v1:${key.trim().toUpperCase()}`)
    .digest('hex')
    .slice(0, 16);
}

/** Deterministic per-user tenant id from the Firebase uid. */
export function tenantIdForUid(uid: string): string {
  return `u_${createHash('sha256').update(`ssmart-pos:tenant:v1:${uid}`).digest('hex').slice(0, 12)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

let fb: { auth: Auth; db: Database } | null = null;

function firebaseConfig(): FirebaseOptions | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
    const cfg: FirebaseOptions = {
      apiKey: env.VITE_LICENSING_FIREBASE_API_KEY ?? env.VITE_FIREBASE_API_KEY ?? process.env.SSPOS_FIREBASE_API_KEY,
      databaseURL:
        env.VITE_LICENSING_FIREBASE_DATABASE_URL ??
        env.VITE_FIREBASE_DATABASE_URL ??
        process.env.SSPOS_FIREBASE_DATABASE_URL,
      projectId: env.VITE_LICENSING_FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_LICENSING_FIREBASE_APP_ID ?? env.VITE_FIREBASE_APP_ID,
    };
    if (!cfg.apiKey || !cfg.databaseURL) return null;
    return cfg;
  } catch {
    return null;
  }
}

function getFirebase(): { auth: Auth; db: Database } | null {
  if (fb) return fb;
  const cfg = firebaseConfig();
  if (!cfg) return null;
  try {
    const name = '__ssmart_binding__';
    const existing = getApps().find((a) => a.name === name);
    const app = existing ?? initializeApp(cfg, name);
    fb = { auth: getAuth(app), db: getDatabase(app) };
    return fb;
  } catch (e) {
    log.warn('firebase init failed', { error: String(e) });
    return null;
  }
}

export async function shutdownBinding(): Promise<void> {
  const app = getApps().find((a) => a.name === '__ssmart_binding__');
  if (app) {
    try {
      await deleteApp(app);
    } catch {
      /* ignore */
    }
  }
  fb = null;
}

/**
 * Trade the Google id_token for a Firebase Auth session.
 * Google's servers verify the token — the uid/email are trustworthy.
 */
export async function firebaseSignIn(session: GoogleSession): Promise<User> {
  const f = getFirebase();
  if (!f) throw new Error('Firebase is not configured in this build.');
  const cred = GoogleAuthProvider.credential(session.idToken);
  const res = await withTimeout(
    signInWithCredential(f.auth, cred),
    NET_TIMEOUT_MS,
    'Firebase sign-in',
  );
  log.info('firebase sign-in ok', { uid: res.user.uid, email: res.user.email });
  return res.user;
}

/**
 * Claim (or re-confirm) the device binding for a product key.
 * Must be called with an authenticated Firebase user.
 */
export async function claimBinding(args: {
  user: User;
  keyId: string;
  fingerprint: string;
  tier: string;
  tenantId: string;
}): Promise<ClaimResult> {
  const f = getFirebase();
  if (!f) throw new Error('Firebase is not configured in this build.');
  const { user, keyId, fingerprint, tier, tenantId } = args;
  const now = new Date().toISOString();
  const deviceName = hostname();
  const bindingRef = ref(f.db, `bindings/${keyId}`);

  const snap = await withTimeout(get(bindingRef), NET_TIMEOUT_MS, 'Binding lookup');
  if (!snap.exists()) {
    const binding: DeviceBinding = {
      fingerprint,
      ownerUid: user.uid,
      ownerEmail: user.email ?? '',
      deviceName,
      keyId,
      tier,
      tenantId,
      boundAt: now,
      lastSeenAt: now,
      bindCount: 1,
    };
    await withTimeout(set(bindingRef, binding), NET_TIMEOUT_MS, 'Binding write');
    await withTimeout(
      set(ref(f.db, `tenantOwners/${tenantId}`), user.uid),
      NET_TIMEOUT_MS,
      'Tenant owner write',
    ).catch(() => undefined); // best-effort; rules may already cover it
    log.info('device bound to key', { keyId, deviceName });
    return { outcome: 'bound', binding };
  }

  const b = snap.val() as DeviceBinding;

  // Released binding → allow rebind after the cooldown.
  if (b.releasedAt) {
    const releasedAgo = Date.now() - new Date(b.releasedAt).getTime();
    if (releasedAgo < REBIND_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((REBIND_COOLDOWN_MS - releasedAgo) / 3600_000);
      throw new Error(
        `This key was released ${Math.round(releasedAgo / 3600_000)}h ago. You can bind a new device in ~${hoursLeft}h (anti-sharing cooldown).`,
      );
    }
    const binding: DeviceBinding = {
      ...b,
      fingerprint,
      ownerUid: user.uid,
      ownerEmail: user.email ?? b.ownerEmail,
      deviceName,
      tier,
      tenantId,
      boundAt: now,
      lastSeenAt: now,
      releasedAt: undefined,
      bindCount: (b.bindCount ?? 1) + 1,
    };
    await withTimeout(set(bindingRef, binding), NET_TIMEOUT_MS, 'Rebind write');
    log.info('device rebound to key', { keyId, deviceName });
    return { outcome: 'rebound', binding };
  }

  // Same device → heartbeat.
  if (b.fingerprint.toLowerCase() === fingerprint.toLowerCase()) {
    await withTimeout(
      update(bindingRef, { lastSeenAt: now, deviceName }),
      NET_TIMEOUT_MS,
      'Heartbeat write',
    ).catch(() => undefined);
    return { outcome: 'already', binding: { ...b, lastSeenAt: now } };
  }

  // Different device → HARD DENY. This is the anti-sharing lock.
  log.warn('binding denied: key active on another device', {
    keyId,
    boundDevice: b.deviceName,
  });
  return { outcome: 'denied', deviceName: b.deviceName, ownerEmail: b.ownerEmail };
}

/**
 * Launch-time verification. Only definitive server answers change the
 * local state; anything else (offline, timeout, no record) → 'unknown'.
 */
export async function verifyBinding(args: {
  keyId: string;
  fingerprint: string;
}): Promise<VerifyResult> {
  const f = getFirebase();
  if (!f) return { outcome: 'unknown' };
  try {
    const snap = await withTimeout(
      get(ref(f.db, `bindings/${args.keyId}`)),
      NET_TIMEOUT_MS,
      'Binding verify',
    );
    if (!snap.exists()) return { outcome: 'unknown' };
    const b = snap.val() as DeviceBinding;
    if (b.releasedAt) return { outcome: 'revoked' };
    if (b.fingerprint.toLowerCase() !== args.fingerprint.toLowerCase()) {
      return { outcome: 'boundElsewhere', deviceName: b.deviceName };
    }
    return { outcome: 'ok', binding: b };
  } catch (e) {
    log.warn('binding verify failed (offline?)', { error: String(e) });
    return { outcome: 'unknown' };
  }
}

/**
 * Owner releases the binding (frees the key for another device after the
 * cooldown). Requires the caller's uid to match the binding owner.
 */
export async function releaseBinding(args: {
  user: User;
  keyId: string;
}): Promise<void> {
  const f = getFirebase();
  if (!f) throw new Error('Firebase is not configured in this build.');
  const bindingRef = ref(f.db, `bindings/${args.keyId}`);
  const snap = await withTimeout(get(bindingRef), NET_TIMEOUT_MS, 'Binding lookup');
  if (!snap.exists()) return;
  const b = snap.val() as DeviceBinding;
  if (b.ownerUid !== args.user.uid) {
    throw new Error('Only the Google account that activated this key can release it.');
  }
  await withTimeout(
    update(bindingRef, { releasedAt: new Date().toISOString() }),
    NET_TIMEOUT_MS,
    'Release write',
  );
  log.info('binding released', { keyId: args.keyId });
}

/** Remove the license record for a fingerprint (used on local deactivate). */
export async function clearLicenseRecord(fingerprint: string): Promise<void> {
  const f = getFirebase();
  if (!f) return;
  await withTimeout(remove(ref(f.db, `licenses/${fingerprint}`)), NET_TIMEOUT_MS, 'License clear').catch(
    () => undefined,
  );
}
