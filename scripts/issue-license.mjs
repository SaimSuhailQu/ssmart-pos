#!/usr/bin/env node
/**
 * Reseller license-key issuance CLI.
 *
 *   node scripts/issue-license.mjs --init
 *     Generates an Ed25519 keypair. PRINTS the public key (embed it via
 *     SSPOS_LICENSE_PUBLIC_KEY at build time) and SAVES the private key to
 *     ./license-private.key (0600). Guard this file like a password.
 *
 *   node scripts/issue-license.mjs --tier standard --days 365
 *   node scripts/issue-license.mjs --tier enterprise --terminals 8 --perpetual
 *   node scripts/issue-license.mjs --tier standard --days 365 --bind <device-fingerprint-hex>
 *
 * The private key is read from ./license-private.key or $SSPOS_LICENSE_PRIVATE_KEY.
 * Output is the product key the buyer pastes into the app's "Enter Product Key" screen.
 *
 * This script is intentionally dependency-free (node:crypto Ed25519) and
 * duplicates the key codec from src/main/licensing/licenseKeys.ts so it can
 * run on any machine without building the app.
 */

import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PAYLOAD_BYTES = 49;

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

const TIERS = { trial: 0, standard: 1, enterprise: 2 };
const PRIVATE_KEY_FILE = './license-private.key';

function loadPrivateKey() {
  const fromEnv = process.env.SSPOS_LICENSE_PRIVATE_KEY;
  if (fromEnv && fromEnv.trim().length > 16) return Buffer.from(fromEnv.trim(), 'base64');
  if (existsSync(PRIVATE_KEY_FILE)) return readFileSync(PRIVATE_KEY_FILE);
  console.error(`Private key not found. Run with --init first, or set SSPOS_LICENSE_PRIVATE_KEY.`);
  process.exit(1);
}

function issue({ tier, days, perpetual, terminals, bind }) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.alloc(PAYLOAD_BYTES);
  body.writeUInt8(1, 0);
  body.writeUInt8(tier, 1);
  body.writeUInt32BE(now, 2);
  body.writeUInt32BE(perpetual ? 0 : now + days * 86400, 6);
  body.writeUInt16BE(terminals, 10);
  if (bind) {
    const hex = bind.replace(/[^0-9a-f]/gi, '');
    if (hex.length !== 64) { console.error('--bind must be a 64-char hex fingerprint'); process.exit(1); }
    Buffer.from(hex, 'hex').copy(body, 12);
  }
  const privateKey = createPrivateKey({ key: loadPrivateKey(), format: 'der', type: 'pkcs8' });
  const signature = sign(null, body, privateKey);
  const grouped = base32Encode(Buffer.concat([body, signature]));
  const chunks = grouped.match(/.{1,4}/g) || [];
  return `SSM1-${chunks.join('-')}`;
}

function init() {
  if (existsSync(PRIVATE_KEY_FILE)) {
    console.error(`${PRIVATE_KEY_FILE} already exists — refusing to overwrite.`);
    process.exit(1);
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  writeFileSync(PRIVATE_KEY_FILE, privDer, { mode: 0o600 });
  try { chmodSync(PRIVATE_KEY_FILE, 0o600); } catch { /* windows */ }
  console.log('Private key saved to ./license-private.key (mode 0600) — BACK IT UP OFFLINE.\n');
  console.log('Embed this PUBLIC key in release builds as SSPOS_LICENSE_PUBLIC_KEY:\n');
  console.log(pubB64);
  console.log('\nOr run: node scripts/issue-license.mjs --embed-public-key');
}

function embedPublicKey(target = 'src/main/licensing/licenseKeys.ts') {
  console.error('--embed-public-key needs the public key; pipe it:');
  console.error('  node scripts/issue-license.mjs --init  # shows the key, then set SSPOS_LICENSE_PUBLIC_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const get = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

if (args.includes('--init')) { init(); process.exit(0); }
if (args.includes('--embed-public-key')) { embedPublicKey(); process.exit(0); }
if (args.includes('--help') || args.length === 0) {
  console.log('Usage: node scripts/issue-license.mjs --tier <standard|enterprise> [--days N|--perpetual] [--terminals N] [--bind <fingerprint>]');
  process.exit(0);
}

const tierName = (get('--tier', 'standard') || 'standard').toLowerCase();
if (!(tierName in TIERS) || tierName === 'trial') { console.error('--tier must be standard or enterprise'); process.exit(1); }
const perpetual = args.includes('--perpetual');
const days = parseInt(get('--days', perpetual ? '0' : '365'), 10);
if (!perpetual && (!Number.isFinite(days) || days <= 0)) { console.error('--days must be positive (or use --perpetual)'); process.exit(1); }
const terminals = tierName === 'enterprise' ? Math.max(1, Math.min(999, parseInt(get('--terminals', '5'), 10) || 5)) : 1;

const key = issue({ tier: TIERS[tierName], days, perpetual, terminals, bind: get('--bind', null) });
console.log('\nProduct key (give to the buyer):\n');
console.log(key);
console.log(`\nTier: ${tierName} | Terminals: ${terminals} | ${perpetual ? 'Perpetual' : `${days} days`} | ${get('--bind', null) ? 'Device-bound' : 'Any device'}`);
