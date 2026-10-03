/**
 * Secure cache — AES-256-GCM encrypted JSON at rest, keyed from the device
 * fingerprint via scrypt. Extracted as a shared primitive so both the
 * Firebase licensing flow and the offline product-key flow use one
 * implementation. Copying the file to another machine fails to decrypt.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { tryCatch, Result, ok } from '../../core/result';

const SALT = 'ssmart-pos/secure-cache/v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function cacheKey(fingerprint: string): Buffer {
  // Double-hash the fingerprint so the KDF input is never the raw fp.
  const material = createHash('sha256').update(`cache:${fingerprint}`).digest('hex');
  return scryptSync(material, SALT, 32);
}

function pathFor(name: string): string {
  return join(app.getPath('userData'), name);
}

export function writeSecureCache(name: string, fingerprint: string, payload: unknown): Result<void> {
  return tryCatch(() => {
    mkdirSync(app.getPath('userData'), { recursive: true });
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', cacheKey(fingerprint), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    writeFileSync(pathFor(name), Buffer.concat([iv, tag, ciphertext]));
  });
}

export function readSecureCache<T>(name: string, fingerprint: string): Result<T | null> {
  // Tampered/wrong-machine/unreadable all collapse to null (no cache).
  return ok(readSecureCacheInner<T>(name, fingerprint));
}

// Inner read kept separate so the tamper case returns null, not an error.
function readSecureCacheInner<T>(name: string, fingerprint: string): T | null {
  try {
    const file = pathFor(name);
    if (!existsSync(file)) return null;
    const blob = readFileSync(file);
    if (blob.length < IV_BYTES + TAG_BYTES) return null;
    const iv = blob.subarray(0, IV_BYTES);
    const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', cacheKey(fingerprint), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function deleteSecureCache(name: string): void {
  try {
    const file = pathFor(name);
    if (existsSync(file)) unlinkSync(file);
  } catch {
    /* non-fatal */
  }
}

export function okOrNull<T>(r: Result<T | null>): T | null {
  return r.ok ? r.value : null;
}
