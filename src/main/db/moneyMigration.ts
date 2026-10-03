/**
 * v2.2.0 money migration: add INTEGER paisa columns alongside every REAL
 * money column, backfilled as ROUND(value * 100).
 *
 * This module is intentionally dependency-free (it takes the better-sqlite3
 * handle as a parameter) so the migration can be unit-tested against a
 * scratch database without booting Electron.
 *
 * NOT auto-run — it executes once during a v2.2.0 maintenance window,
 * after a verified backup. Idempotent: skips columns that already exist.
 *
 * Procedure:
 *   1. VACUUM INTO a timestamped backup (rollback = restore the file).
 *   2. In a single transaction, add `<col>_minor INTEGER` + backfill.
 *   3. Verify every backfill: SUM(ABS(minor - ROUND(real*100))) must be 0.
 *   4. v2.2.0 app code then dual-writes; the REAL columns are dropped in v2.3.0.
 */

export interface MoneyMigrationDb {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): unknown[];
    get(): unknown;
  };
  transaction(fn: () => void): () => void;
}

export const MONEY_COLUMNS: Array<readonly [table: string, column: string]> = [
  ['products', 'price'],
  ['products', 'cost_price'],
  ['sales', 'subtotal'],
  ['sales', 'tax'],
  ['sales', 'discount'],
  ['sales', 'total'],
  ['sales', 'amount_tendered'],
  ['sales', 'change_given'],
  ['sales', 'refund_amount'],
  ['sale_items', 'price'],
  ['payments', 'amount'],
  ['customers', 'balance'],
  ['customer_khata_entries', 'amount'],
  ['expenses', 'amount'],
  ['purchase_orders', 'total_cost'],
  ['purchase_orders', 'paid_amount'],
  ['purchase_order_items', 'cost_price'],
  ['vendor_payments', 'amount'],
  ['vendor_order_entries', 'amount'],
];

export interface MoneyMigrationReport {
  backupPath: string;
  columnsMigrated: number;
  columnsSkipped: number;
  verified: boolean;
}

export function migrateMoneyColumnsToPaisa(
  db: MoneyMigrationDb,
  dbPathForBackup: string,
  onDrift?: (table: string, column: string, drift: number) => void,
): MoneyMigrationReport {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPathForBackup}.paisa-backup-${ts}`;

  // 1. Backup first — rollback is "restore this file".
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

  let migrated = 0;
  let skipped = 0;

  // 2. Add + backfill inside one transaction.
  const migrate = db.transaction(() => {
    for (const [table, column] of MONEY_COLUMNS) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      // The table may not exist on very old installs (e.g. vendor tables).
      if (cols.length === 0) {
        skipped++;
        continue;
      }
      const minorCol = `${column}_minor`;
      if (cols.some((c) => c.name === minorCol)) {
        skipped++;
        continue;
      }
      if (!cols.some((c) => c.name === column)) {
        skipped++;
        continue;
      }
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${minorCol} INTEGER NOT NULL DEFAULT 0`);
      db.exec(`UPDATE ${table} SET ${minorCol} = CAST(ROUND(${column} * 100) AS INTEGER)`);
      migrated++;
    }
  });
  migrate();

  // 3. Verify every backfill exactly.
  let verified = true;
  for (const [table, column] of MONEY_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (cols.length === 0) continue;
    const minorCol = `${column}_minor`;
    if (!cols.some((c) => c.name === minorCol) || !cols.some((c) => c.name === column)) continue;
    const row = db
      .prepare(
        `SELECT SUM(ABS(${minorCol} - CAST(ROUND(${column} * 100) AS INTEGER))) AS drift FROM ${table}`,
      )
      .get() as { drift: number | null };
    const drift = row.drift ?? 0;
    if (drift !== 0) {
      verified = false;
      onDrift?.(table, column, drift);
    }
  }

  return { backupPath, columnsMigrated: migrated, columnsSkipped: skipped, verified };
}
