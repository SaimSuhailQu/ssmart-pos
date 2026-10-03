#!/usr/bin/env node
/**
 * Smoke tests for v2.1.0 new modules (money, cart domain, PIN auth,
 * Ed25519 licensing, ESC/POS builder).
 *
 *   node scripts/smoke.cjs
 *
 * Compiles the pure modules standalone (no Electron) and runs assertions.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const repo = path.resolve(__dirname, '..');
const DIR = '/tmp/ssmart-smoke';
fs.mkdirSync(DIR, { recursive: true });

const files = [
  'src/core/money.ts',
  'src/core/result.ts',
  'src/core/logger.ts',
  'src/core/validation.ts',
  'src/domain/cart.ts',
  'src/main/security/pinAuth.ts',
  'src/main/licensing/licenseKeys.ts',
  'src/main/printing/escposBuilder.ts',
];
execSync(
  `npx tsc --ignoreConfig ${files.map((f) => `"${repo}/${f}"`).join(' ')} --outDir "${DIR}" --module commonjs --target es2020 --skipLibCheck --types node`,
  { cwd: repo, stdio: 'pipe' },
);

const { fromMajor, add, computeTotals, formatMoney } = require(`${DIR}/core/money.js`);
const { emptyCart, addLine, setLineQty, cartTotals } = require(`${DIR}/domain/cart.js`);
const { hashPin, verifyPin, isHashed, authenticatePin } = require(`${DIR}/main/security/pinAuth.js`);
const { generateKeyPair, issueLicenseKey, verifyLicenseKey, LicenseTier } = require(`${DIR}/main/licensing/licenseKeys.js`);
const { buildReceiptBytes } = require(`${DIR}/main/printing/escposBuilder.js`);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

// --- Money ---
t('money: 0.1+0.2 has no drift', () => {
  assert.strictEqual(add(fromMajor(0.1), fromMajor(0.2)).minor, 30);
});
t('money: computeTotals', () => {
  const tot = computeTotals({ subtotal: fromMajor(1000), discountMinor: 10000, taxRateBps: 0 });
  assert.strictEqual(tot.total.minor, 90000);
  assert.strictEqual(formatMoney(tot.total), '900.00');
});

// --- Cart domain ---
const prod = (id, price, stock) => ({ id, name: `P${id}`, barcode: `${id}`, price, stock, category: 'General' });
t('cart: add + totals in paisa', () => {
  const r = addLine(emptyCart(), prod(1, 19.99, 10), 2);
  assert.ok(r.ok);
  const totals = cartTotals(r.value, 0, 0);
  assert.strictEqual(totals.subtotal.minor, 3998);
  assert.strictEqual(totals.itemCount, 2);
});
t('cart: stock cap enforced', () => {
  assert.ok(!addLine(emptyCart(), prod(1, 10, 2), 5).ok);
});
t('cart: setQty to 0 removes line', () => {
  const c = addLine(emptyCart(), prod(1, 10, 5), 2).value;
  const r = setLineQty(c, 1, 0);
  assert.ok(r.ok && r.value.length === 0);
});

// --- PIN auth ---
t('pin: hash/verify round-trip', () => {
  const h = hashPin('1234');
  assert.ok(isHashed(h));
  assert.strictEqual(verifyPin(h, '1234'), 'ok');
  assert.strictEqual(verifyPin(h, '9999'), 'invalid');
});
t('pin: legacy plaintext migrates', () => {
  assert.strictEqual(verifyPin('1234', '1234'), 'migrate');
  assert.strictEqual(verifyPin('1234', '0000'), 'invalid');
});
t('pin: authenticatePin never leaks the hash', () => {
  const h = hashPin('5678');
  const res = authenticatePin([{ id: 1, name: 'A', role: 'Cashier', pin: h }], '5678');
  assert.ok(res.ok);
  assert.ok(!('pin' in res.value.user));
  assert.strictEqual(res.value.userId, 1);
});

// --- Licensing keys ---
const payload = (bind) => ({ version: 1, tier: LicenseTier.Standard, issuedAt: new Date(), expiresAt: new Date('2030-01-01'), maxTerminals: 1, deviceBind: bind });
t('license: issue/verify round-trip', () => {
  const { publicKeyB64, privateKeyB64 } = generateKeyPair();
  const key = issueLicenseKey(payload('ab'.repeat(32)), privateKeyB64);
  assert.ok(key.startsWith('SSM1-'));
  const v = verifyLicenseKey(key, publicKeyB64);
  assert.ok(v.ok, String(v.error));
  assert.strictEqual(v.value.tier, LicenseTier.Standard);
});
t('license: tampered key rejected', () => {
  const { publicKeyB64, privateKeyB64 } = generateKeyPair();
  const key = issueLicenseKey(payload(null), privateKeyB64);
  const tampered = key.slice(0, -2) + (key.slice(-2) === 'AA' ? 'BB' : 'AA');
  assert.ok(!verifyLicenseKey(tampered, publicKeyB64).ok);
});

// --- ESC/POS receipt ---
t('receipt: builds non-empty bytes', () => {
  const bytes = buildReceiptBytes({
    storeName: 'SS MART', storeLines: [], cashier: 'Test',
    lines: [{ name: 'Item', qty: 2, unitPriceMinor: 1999, lineTotalMinor: 3998 }],
    subtotalMinor: 3998, discountMinor: 0, taxMinor: 0, totalMinor: 3998,
    payments: [{ method: 'Cash', amountMinor: 5000 }], tenderedMinor: 5000, changeMinor: 1002,
  });
  assert.ok(bytes.length > 100 && bytes.includes(0x1d));
});

console.log(`\nAll ${n} smoke tests passed.`);
