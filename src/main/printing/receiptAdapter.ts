/**
 * receiptAdapter — bridges the legacy HTML-driver print calls to the
 * fail-safe ESC/POS print spooler.
 *
 * When a thermal printer transport is configured
 * (`printer.transport` setting, e.g. `network:192.168.1.50:9100`), receipt
 * jobs are built as pure ESC/POS bytes and persisted to the SQLite queue
 * before any hardware is touched. When nothing is configured the adapter
 * returns null and the caller falls back to the legacy Windows-driver
 * HTML path, so existing installs keep printing exactly as before.
 */

import { buildReceiptBytes, ReceiptData } from './escposBuilder';
import { enqueuePrintJob } from './printSpooler';
import { getSetting } from '../../db';
import { createLogger } from '../../core/logger';

const log = createLogger('print:adapter');

const toMinor = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
};

export interface LegacyReceiptItem {
  name?: unknown;
  qty?: unknown;
  price?: unknown;
}

export interface LegacyPayment {
  subtotal?: unknown;
  discount?: unknown;
  tax?: unknown;
  total?: unknown;
  payments?: Array<{ method?: unknown; amount?: unknown }>;
  change?: unknown;
  customerName?: unknown;
}

/** The configured ESC/POS transport name, or null when printing via the OS driver. */
export function getConfiguredTransport(): string | null {
  const t = getSetting('printer.transport');
  const v = t && t.trim().length > 0 ? t.trim() : null;
  // Only network ESC/POS has a real desktop transport today. Anything else
  // (unset, 'usb', …) keeps the legacy OS-driver path.
  return v && v.startsWith('network:') ? v : null;
}

/**
 * Build an ESC/POS receipt from the legacy printReceipt() arguments and
 * enqueue it. Returns the job id, or null when no ESC/POS transport is
 * configured (caller should use the legacy driver path).
 */
export function enqueueReceiptJob(
  items: LegacyReceiptItem[],
  payment: LegacyPayment,
  saleId: number | undefined,
  cashierName: string | undefined,
): number | null {
  const transport = getConfiguredTransport();
  if (!transport) return null;

  const lines = (items ?? []).map((it) => {
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const unit = toMinor(it.price);
    return {
      name: String(it.name ?? 'Item'),
      qty,
      unitPriceMinor: unit,
      lineTotalMinor: qty * unit,
    };
  });

  const subtotal = toMinor(payment.subtotal ?? payment.total ?? 0);
  const discount = toMinor(payment.discount);
  const tax = toMinor(payment.tax);
  const total = toMinor(payment.total ?? subtotal - discount + tax);
  const payments = (Array.isArray(payment.payments) ? payment.payments : []).map((p) => ({
    method: String(p.method ?? 'Cash'),
    amountMinor: toMinor(p.amount),
  }));
  const tendered = payments.reduce((s, p) => s + p.amountMinor, 0);

  const data: ReceiptData = {
    storeName: getSetting('store.name') ?? 'SS MART',
    storeLines: (getSetting('store.address_lines') ?? '').split('|').filter(Boolean),
    saleId,
    cashier: cashierName ?? 'Cashier',
    customer: typeof payment.customerName === 'string' ? payment.customerName : undefined,
    lines,
    subtotalMinor: subtotal,
    discountMinor: discount,
    taxMinor: tax,
    totalMinor: total,
    payments,
    tenderedMinor: tendered,
    changeMinor: Math.max(0, toMinor(payment.change)),
  };

  const res = enqueuePrintJob('receipt', buildReceiptBytes(data), transport);
  if (!res.ok) {
    log.error('failed to enqueue receipt', { error: String(res.error) });
    return null;
  }
  return res.value;
}
