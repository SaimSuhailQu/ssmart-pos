/**
 * Automatic local backups of the shop SQLite database.
 *
 * Why this exists: until v2.6.0 there was no backup at all — the laptop's
 * `mart-pos.db` was the only copy of some shop data, and the Oct 2026
 * lost-update incident was recovered from that single file. A backup that
 * only happens when someone remembers is not a backup.
 *
 * How it works:
 * - better-sqlite3's online backup API (`db.backup()`), which is safe
 *   against a live, WAL-mode database — no shutdown, no file copy races.
 * - One backup per day (on launch if today has none, re-checked every 6h),
 *   kept in `<userData>/backups/` as `mart-pos-<timestamp>-<reason>.db`.
 * - Retention: newest 30 files. Old ones are pruned automatically.
 * - Never throws: a failed backup logs and the app keeps running. A backup
 *   system that can crash the POS is worse than none.
 *
 * Restore: stop the app, copy the chosen backup over `mart-pos.db`, restart.
 * The money migration (`moneyMigration.ts`) takes its own VACUUM INTO
 * backup on top of this, so a same-day auto-backup always exists first.
 */
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { db } from '../../db';

const BACKUP_KEEP_COUNT = 30;
const BACKUP_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function backupsDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

function timestamp(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/** Create one backup file now. Returns the path, or null on failure. */
export async function createBackup(reason: string): Promise<string | null> {
  try {
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `mart-pos-${timestamp()}-${reason}.db`);
    await db.backup(file);
    console.log(`[Backup] Created ${file}`);
    pruneBackups(dir);
    return file;
  } catch (err) {
    console.error('[Backup] Failed to create backup:', err);
    return null;
  }
}

function pruneBackups(dir: string): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('mart-pos-') && f.endsWith('.db'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const extra of files.slice(BACKUP_KEEP_COUNT)) {
      try {
        fs.unlinkSync(path.join(dir, extra.f));
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('[Backup] Prune failed:', err);
  }
}

/** Create today's backup if none exists yet. Safe to call often. */
export async function ensureDailyBackup(): Promise<void> {
  try {
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const today = timestamp().slice(0, 8);
    const hasToday = fs
      .readdirSync(dir)
      .some((f) => f.startsWith(`mart-pos-${today}`));
    if (!hasToday) await createBackup('daily');
  } catch (err) {
    console.warn('[Backup] Daily check failed:', err);
  }
}

/**
 * Start the backup scheduler: one backup on launch (if today lacks one),
 * then re-check every 6 hours. Call once, after initDb().
 */
export function startBackupScheduler(): void {
  void ensureDailyBackup();
  setInterval(() => {
    void ensureDailyBackup();
  }, BACKUP_CHECK_INTERVAL_MS);
}
