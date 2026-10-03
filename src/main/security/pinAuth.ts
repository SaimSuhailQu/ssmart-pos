/**
 * PIN authentication (main process) — scrypt-hashed PINs.
 *
 * The `users.pin` column historically stored plaintext. This module:
 *  - hashes new/changed PINs with scrypt (N=16384, r=8, p=1, 32-byte salt)
 *  - verifies with constant-time comparison
 *  - transparently migrates: a correct plaintext PIN is re-hashed on first
 *    successful login, so no manual migration is needed
 *  - strips the PIN from any user object crossing the IPC boundary
 *
 * Stored format: `scrypt$<salt-b64>$<hash-b64>`. Anything else in the column
 * is treated as legacy plaintext and migrated on successful verify.
 *
 * Wiring (src/db.ts):
 *   verifyUserPin(pin) -> find user by... (see note) — PINs can't be looked
 *   up by hash, so: fetch candidate users, verify each, migrate on success.
 *   addUser/updateUser -> store hashPin(pin).
 *   getAllUsers -> SELECT id, name, role (drop the pin column from the query).
 */

import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { Result, ok, err } from '../../core/result';
import { createLogger } from '../../core/logger';

const log = createLogger('security:pin');

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(pin, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function parseHash(stored: string): { salt: Buffer; hash: Buffer } | null {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return null;
  try {
    return { salt: Buffer.from(parts[1], 'base64'), hash: Buffer.from(parts[2], 'base64') };
  } catch {
    return null;
  }
}

/** True when the stored value is already a scrypt hash. */
export function isHashed(stored: string): boolean {
  return stored.startsWith('scrypt$') && parseHash(stored) !== null;
}

/**
 * Verify a candidate PIN against the stored value.
 * Returns 'ok' (hashed match), 'migrate' (legacy plaintext match — caller
 * must re-hash and persist), or 'invalid'.
 */
export function verifyPin(stored: string, candidate: string): 'ok' | 'migrate' | 'invalid' {
  const parsed = parseHash(stored);
  if (parsed) {
    const candidateHash = scryptSync(candidate, parsed.salt, KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    if (parsed.hash.length !== candidateHash.length) return 'invalid';
    return timingSafeEqual(parsed.hash, candidateHash) ? 'ok' : 'invalid';
  }
  // Legacy plaintext: constant-time compare, then migrate.
  const a = Buffer.from(stored, 'utf8');
  const b = Buffer.from(candidate, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'invalid';
  return 'migrate';
}

export interface SafeUser {
  id: number;
  name: string;
  role: string;
}

/** Strip secrets before a user object crosses IPC to the renderer. */
export function toSafeUser(row: Record<string, unknown>): SafeUser {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    role: String(row.role ?? 'Cashier'),
  };
}

/**
 * Verify a PIN against a list of candidate user rows ({id,name,role,pin}).
 * Returns the safe user + whether the stored PIN needs migration.
 */
export function authenticatePin(
  users: Array<Record<string, unknown>>,
  candidatePin: string,
): Result<{ user: SafeUser; userId: number; needsMigration: boolean }> {
  for (const u of users) {
    const stored = String(u.pin ?? '');
    if (!stored) continue;
    const verdict = verifyPin(stored, candidatePin);
    if (verdict === 'invalid') continue;
    const userId = Number(u.id);
    log.info('pin verified', { userId, migrated: verdict === 'migrate' });
    return ok({ user: toSafeUser(u), userId, needsMigration: verdict === 'migrate' });
  }
  return err(new Error('Invalid PIN.'));
}

/**
 * Seed PINs must be rotated on first boot. Call once at startup; if the
 * default `1234`/`9999` accounts still exist with legacy plaintext PINs,
 * force the admin to set new ones before the POS unlocks.
 */
export function isDefaultPin(pin: string): boolean {
  return pin === '1234' || pin === '9999' || pin === '0000';
}
