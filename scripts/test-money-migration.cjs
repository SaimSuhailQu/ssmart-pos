#!/usr/bin/env node
/**
 * Scratch-DB test for the v2.2.0 paisa migration.
 *
 *   node scripts/test-money-migration.cjs
 *
 * Compiles src/main/db/moneyMigration.ts standalone, builds a scratch DB
 * with the real money columns, inserts tricky float values (0.1+0.2,
 * repeating decimals, negatives), runs the ACTUAL migrateMoneyColumnsToPaisa(),
 * and verifies: exact backfills, idempotency, and backup creation.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repo = path.resolve(__dirname, '..');
const tmp = '/tmp/ssmart-paisa-test';
fs.mkdirSync(tmp, { recursive: true });

// 1. Compile the real migration module standalone (no Electron needed).
execSync(
  `npx tsc --ignoreConfig "${repo}/src/main/db/moneyMigration.ts" --outDir "${tmp}" --module commonjs --target es2020 --skipLibCheck`,
  { cwd: repo, stdio: 'inherit' },
);

const Database = require('better-sqlite3');
const { migrateMoneyColumnsToPaisa } = require(path.join(tmp, 'moneyMigration.js'));

const DB = path.join(tmp, 'scratch.db');
try { fs.unlinkSync(DB); } catch { /* fresh */ }
const db = new Database(DB);

// 2. Representative subset of the real schema (REAL money columns).
db.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, price REAL NOT NULL, cost_price REAL NOT NULL DEFAULT 0);
  CREATE TABLE sales (id INTEGER PRIMARY KEY, subtotal REAL NOT NULL, tax REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL, amount_tendered REAL NOT NULL DEFAULT 0, change_given REAL NOT NULL DEFAULT 0, refund_amount REAL DEFAULT 0);
  CREATE TABLE sale_items (id INTEGER PRIMARY KEY, price REAL NOT NULL);
  CREATE TABLE payments (id INTEGER PRIMARY KEY, amount REAL NOT NULL);
  CREATE TABLE customers (id INTEGER PRIMARY KEY, balance REAL DEFAULT 0);
  CREATE TABLE customer_khata_entries (id INTEGER PRIMARY KEY, amount REAL NOT NULL);
  CREATE TABLE expenses (id INTEGER PRIMARY KEY, amount REAL NOT NULL);
`);

// 3. Tricky values: repeating decimals, classic 0.1+0.2 drift, large amounts, zero, negative.
const tricky = [19.99, 0.1 + 0.2, 1000000.99, 0, 0.01, 999.995, -50.25, 123456.78];
const ins = db.prepare('INSERT INTO products (price, cost_price) VALUES (?, ?)');
for (const v of tricky) ins.run(v, v / 2);
db.prepare('INSERT INTO sales (subtotal, total, amount_tendered, change_given) VALUES (?, ?, ?, ?)').run(0.1 + 0.2, 19.99, 20, 0.01);
db.prepare('INSERT INTO sale_items (price) VALUES (?)').run(999.995);
db.prepare('INSERT INTO payments (amount) VALUES (?)').run(123456.78);
db.prepare('INSERT INTO customers (balance) VALUES (?)').run(-50.25);
db.prepare('INSERT INTO customer_khata_entries (amount) VALUES (?)').run(0.07);
db.prepare('INSERT INTO expenses (amount) VALUES (?)').run(1000000.99);

const report = migrateMoneyColumnsToPaisa(db, DB);
console.log('report:', JSON.stringify(report, null, 2));

let ok = true;
const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); ok = false; }
};

const p = db.prepare('SELECT price_minor AS m FROM products LIMIT 1').get();
assert(p.m === 1999, `products.price 19.99 -> ${p.m}, want 1999`);
// 0.1+0.2 must become exactly 30 paisa (ROUND fixes the binary drift).
const s = db.prepare('SELECT subtotal_minor AS m FROM sales LIMIT 1').get();
assert(s.m === 30, `sales.subtotal 0.1+0.2 -> ${s.m}, want 30`);
const c = db.prepare('SELECT balance_minor AS m FROM customers LIMIT 1').get();
assert(c.m === -5025, `customers.balance -50.25 -> ${c.m}, want -5025`);

// Idempotency: second run migrates nothing.
const report2 = migrateMoneyColumnsToPaisa(db, DB);
assert(report2.columnsMigrated === 0, 'second run not idempotent');
assert(report2.verified, 'second run not verified');

// Backup exists.
const backups = fs.readdirSync(tmp).filter((f) => f.includes('paisa-backup'));
assert(backups.length > 0, 'no backup created');

db.close();
if (!report.verified || !ok) { console.error('MIGRATION TEST FAILED'); process.exit(1); }
console.log('MIGRATION TEST PASSED');
