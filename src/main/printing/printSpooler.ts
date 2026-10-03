/**
 * Fail-safe print spooler (main process).
 *
 * Every print job is persisted to SQLite BEFORE any hardware is touched.
 * If the printer is disconnected, out of paper, or the app crashes
 * mid-print, the job stays queued and is retried with backoff. The
 * renderer is notified of queue state so the cashier sees "Printer
 * offline — 3 receipts queued" instead of a crash.
 *
 * Transports are pluggable: main.ts registers the real senders.
 *
 *   import { initPrintSpooler, registerTransport, enqueuePrintJob } from './main/printing/printSpooler';
 *   initPrintSpooler();
 *   registerTransport('usb', sendViaEscposUsb);      // your escpos sender
 *   registerTransport('network:192.168.1.50', createNetworkTransport('192.168.1.50'));
 *
 * Bluetooth on desktop registers a sender that always fails with a clear
 * message — the job queues safely and the cashier is told to use mobile.
 */

import { BrowserWindow } from 'electron';
import { Socket } from 'net';
import { db } from '../../db';
import { Result, tryCatch } from '../../core/result';
import { createLogger } from '../../core/logger';

const log = createLogger('print:spooler');

export type PrintJobKind = 'receipt' | 'barcode' | 'label';
export type PrintJobStatus = 'queued' | 'sending' | 'done' | 'failed';

export interface PrintJob {
  id: number;
  kind: PrintJobKind;
  payload: Buffer;
  transport: string;
  status: PrintJobStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: number | null;
  createdAt: number;
}

export type TransportSender = (bytes: Buffer, job: PrintJob) => Promise<void>;

const transports = new Map<string, TransportSender>();
const MAX_ATTEMPTS = 12;
const WORKER_MS = 5000;

function backoffMs(attempts: number): number {
  return Math.min(300_000, 5000 * 2 ** attempts); // 5s … 5min cap
}

export function initPrintSpooler(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload BLOB NOT NULL,
      transport TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, next_retry_at);
  `);
  // Recover jobs left 'sending' by a crash back to 'queued'.
  db.prepare(`UPDATE print_jobs SET status='queued' WHERE status='sending'`).run();
  setInterval(() => void processQueue(), WORKER_MS).unref();
  void processQueue();
  log.info('spooler initialized');
}

export function registerTransport(name: string, sender: TransportSender): void {
  transports.set(name, sender);
  log.info('transport registered', { name });
}

/** TCP transport for network/LAN thermal printers (port 9100). */
export function createNetworkTransport(host: string, port = 9100, timeoutMs = 8000): TransportSender {
  return (bytes) =>
    new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Printer ${host}:${port} timed out`));
      }, timeoutMs);
      socket.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Network printer unreachable (${host}): ${e.message}`));
      });
      socket.connect(port, host, () => {
        socket.write(bytes, (e) => {
          clearTimeout(timer);
          socket.end();
          if (e) reject(new Error(`Print send failed: ${e.message}`));
          else resolve();
        });
      });
    });
}

/** Desktop has no Bluetooth printer stack — fail with a clear message. */
export function createBluetoothStubTransport(): TransportSender {
  return async () => {
    throw new Error('Bluetooth printing is available in the mobile app only. Connect a USB or network printer.');
  };
}

export function enqueuePrintJob(
  kind: PrintJobKind,
  payload: Buffer,
  transport: string,
): Result<number> {
  return tryCatch(() => {
    const now = Date.now();
    const info = db
      .prepare(
        `INSERT INTO print_jobs (kind, payload, transport, status, attempts, created_at)
         VALUES (?, ?, ?, 'queued', 0, ?)`,
      )
      .run(kind, payload, transport, now);
    const id = Number(info.lastInsertRowid);
    log.info('job enqueued', { id, kind, transport });
    emitQueueChanged();
    void processQueue();
    return id;
  });
}

export function getQueueStatus(): { queued: number; failed: number; sending: number } {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,
         SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status='sending' THEN 1 ELSE 0 END) AS sending
       FROM print_jobs`,
    )
    .get() as { queued: number; failed: number; sending: number };
  return { queued: row.queued ?? 0, failed: row.failed ?? 0, sending: row.sending ?? 0 };
}

/** Cashier pressed "retry" — reset failed jobs to queued. */
export function retryFailedJobs(): number {
  const info = db
    .prepare(`UPDATE print_jobs SET status='queued', next_retry_at=NULL WHERE status='failed'`)
    .run();
  emitQueueChanged();
  void processQueue();
  return Number(info.changes);
}

function claimNextJob(): PrintJob | null {
  const now = Date.now();
  const row = db
    .prepare(
      `SELECT * FROM print_jobs
       WHERE status='queued' AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(now) as PrintJob | null;
  if (!row) return null;
  db.prepare(`UPDATE print_jobs SET status='sending' WHERE id=? AND status='queued'`).run(row.id);
  return { ...row, status: 'sending' };
}

async function processQueue(): Promise<void> {
  const job = claimNextJob();
  if (!job) return;
  // Process strictly one at a time to keep ordering per printer.
  try {
    const sender = transports.get(job.transport);
    if (!sender) {
      throw new Error(`No printer configured for transport "${job.transport}".`);
    }
    await sender(job.payload, job);
    db.prepare(`DELETE FROM print_jobs WHERE id=?`).run(job.id);
    log.info('job printed', { id: job.id, kind: job.kind });
  } catch (e) {
    const attempts = job.attempts + 1;
    const message = e instanceof Error ? e.message : String(e);
    if (attempts >= MAX_ATTEMPTS) {
      db.prepare(`UPDATE print_jobs SET status='failed', attempts=?, last_error=? WHERE id=?`).run(
        attempts,
        message,
        job.id,
      );
      log.error('job failed permanently', { id: job.id, error: message });
    } else {
      db.prepare(
        `UPDATE print_jobs SET status='queued', attempts=?, last_error=?, next_retry_at=? WHERE id=?`,
      ).run(attempts, message, Date.now() + backoffMs(attempts), job.id);
      log.warn('job failed, will retry', { id: job.id, attempts, error: message });
    }
  } finally {
    emitQueueChanged();
    // Drain the queue sequentially.
    const more = db
      .prepare(`SELECT 1 FROM print_jobs WHERE status='queued' AND (next_retry_at IS NULL OR next_retry_at <= ?) LIMIT 1`)
      .get(Date.now());
    if (more) void processQueue();
  }
}

function emitQueueChanged(): void {
  const status = getQueueStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('print-queue-changed', status);
  }
}
