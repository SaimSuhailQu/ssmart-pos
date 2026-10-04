/**
 * Offline product-key licensing — Ed25519 signed license payloads.
 *
 * Design:
 *  - The reseller holds the Ed25519 PRIVATE key (never ships with the app).
 *  - The app embeds only the PUBLIC key (`SSPOS_LICENSE_PUBLIC_KEY` at
 *    build time, or the `FALLBACK_PUBLIC_KEY` placeholder replaced during
 *    the release-signing step — see scripts/issue-license.mjs).
 *  - A product key is: `SSM1-` + base32(payload || signature), grouped.
 *  - Payload (49 bytes): version(1) | tier(1) | issuedAt u32be |
 *    expiresAt u32be (0 = perpetual) | maxTerminals u16be |
 *    deviceBind (32 bytes, zeros = any device)
 *  - Signature: Ed25519 over the payload, 64 bytes.
 *
 * Verification is fully offline — no network, no Firebase — so a sold
 * terminal keeps working in a basement with no connectivity. Tampering
 * with any byte invalidates the signature.
 *
 * Node's built-in crypto supports Ed25519 (no new dependencies).
 */

import { generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey } from 'crypto';
import { Result, tryCatch } from '../../core/result';
import { createLogger } from '../../core/logger';

const log = createLogger('licensing:keys');

export const LICENSE_KEY_PREFIX = 'SSM1';
export const PAYLOAD_BYTES = 49;
export const SIGNATURE_BYTES = 64;

export enum LicenseTier {
  Trial = 0,
  Standard = 1,
  Enterprise = 2,
}

export interface LicensePayload {
  version: number;
  tier: LicenseTier;
  issuedAt: Date;
  /** null = perpetual */
  expiresAt: Date | null;
  maxTerminals: number;
  /** 64-hex device fingerprint this key is bound to, or null = any device. */
  deviceBind: string | null;
}

export interface KeyPair {
  publicKeyB64: string;
  privateKeyB64: string;
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

/** Generate a fresh Ed25519 keypair for the reseller. Guard the private key. */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyB64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

function encodePayload(p: LicensePayload): Buffer {
  const buf = Buffer.alloc(PAYLOAD_BYTES);
  buf.writeUInt8(1, 0); // version
  buf.writeUInt8(p.tier, 1);
  buf.writeUInt32BE(Math.floor(p.issuedAt.getTime() / 1000), 2);
  buf.writeUInt32BE(p.expiresAt ? Math.floor(p.expiresAt.getTime() / 1000) : 0, 6);
  buf.writeUInt16BE(Math.max(1, Math.min(999, p.maxTerminals)), 10);
  if (p.deviceBind) {
    const bind = Buffer.from(p.deviceBind.replace(/[^0-9a-f]/gi, ''), 'hex');
    if (bind.length !== 32) throw new Error('deviceBind must be 32 bytes (64 hex chars)');
    bind.copy(buf, 12);
  }
  return buf;
}

function decodePayload(buf: Buffer): LicensePayload | null {
  if (buf.length !== PAYLOAD_BYTES || buf.readUInt8(0) !== 1) return null;
  const expiresRaw = buf.readUInt32BE(6);
  const bind = buf.subarray(12, 44);
  return {
    version: 1,
    tier: buf.readUInt8(1) as LicenseTier,
    issuedAt: new Date(buf.readUInt32BE(2) * 1000),
    expiresAt: expiresRaw === 0 ? null : new Date(expiresRaw * 1000),
    maxTerminals: buf.readUInt16BE(10),
    deviceBind: bind.every((b) => b === 0) ? null : bind.toString('hex'),
  };
}

function publicKeyFromB64(b64: string) {
  return createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });
}

/**
 * Issue a product key. Runs on the RESELLER's machine (scripts/issue-license.mjs),
 * never inside the shipped app.
 */
export function issueLicenseKey(payload: LicensePayload, privateKeyB64: string): string {
  const body = encodePayload(payload);
  const privateKey = createPrivateKey({ key: Buffer.from(privateKeyB64, 'base64'), format: 'der', type: 'pkcs8' });
  const signature = sign(null, body, privateKey); // Ed25519: algorithm = null
  const grouped = base32Encode(Buffer.concat([body, signature]));
  const chunks = grouped.match(/.{1,4}/g) ?? [];
  return `${LICENSE_KEY_PREFIX}-${chunks.join('-')}`;
}

/**
 * Verify a product key offline against the embedded public key.
 * Returns the decoded payload, or an error describing why it is invalid.
 */
export function verifyLicenseKey(key: string, publicKeyB64: string): Result<LicensePayload, Error> {
  return tryCatch(() => {
    const normalized = key.trim().toUpperCase();
    if (!normalized.startsWith(`${LICENSE_KEY_PREFIX}-`)) {
      throw new Error('Not a SSmart POS product key.');
    }
    const raw = base32Decode(normalized.slice(LICENSE_KEY_PREFIX.length + 1));
    if (raw.length !== PAYLOAD_BYTES + SIGNATURE_BYTES) {
      throw new Error('Product key has an invalid length — check for typos.');
    }
    const body = Buffer.from(raw.subarray(0, PAYLOAD_BYTES));
    const signature = Buffer.from(raw.subarray(PAYLOAD_BYTES));
    const valid = verify(null, body, publicKeyFromB64(publicKeyB64), signature);
    if (!valid) throw new Error('Signature invalid — this key was not issued by SSmart POS.');
    const payload = decodePayload(body);
    if (!payload) throw new Error('Product key payload is corrupt.');
    return payload;
  });
}

/** True when the payload's expiry has passed (perpetual keys never expire). */
export function isPayloadExpired(payload: LicensePayload, now = new Date()): boolean {
  return payload.expiresAt !== null && payload.expiresAt.getTime() <= now.getTime();
}

/**
 * Resolve the public key the app verifies against.
 * Build-time env wins; the in-source placeholder MUST be replaced by the
 * release-signing step or verification fails closed (no valid signatures).
 */
export function resolvePublicKey(): string | null {
  const fromEnv =
    (typeof process !== 'undefined' && process.env.SSPOS_LICENSE_PUBLIC_KEY) || '';
  if (fromEnv.trim().length > 16) return fromEnv.trim();
  if (!FALLBACK_PUBLIC_KEY.includes('REPLACE_ME')) return FALLBACK_PUBLIC_KEY;
  log.error('No license public key configured — offline activation is disabled.');
  return null;
}

/**
 * Replaced at release time by scripts/issue-license.mjs --embed-public-key.
 * If it still contains REPLACE_ME, offline key activation fails closed.
 */
export const FALLBACK_PUBLIC_KEY = 'MCowBQYDK2VwAyEAi5Xepc/uZULn5HPaBvAR3PRNDGDlSTfPO3oWBiBRpg0=';

