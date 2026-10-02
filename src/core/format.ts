/**
 * Centralized formatters — the single source of truth for money and dates.
 *
 * Before this module, currency formatting was hand-rolled at 133 call sites
 * with two competing conventions (`toLocaleString()` and a 2-decimal variant).
 * Both are preserved here verbatim, including the system locale, so existing
 * screens render byte-identically after migration.
 *
 * Rules for new code:
 *  - Money shown to the cashier on a KPI/receipt → `money(amount)` (2 dp).
 *  - Money in a compact balance/quick-look chip  → `money(amount, { decimals: 0 })`.
 *  - Timestamps in exports/logs                  → `dateTime(value)`.
 *  - Never call `toLocaleString` directly in a component.
 */

/** Default 2-dp money, e.g. 1234.5 -> "1,234.50". */
export function money(
  amount: number,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 2;
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Whole-number money, e.g. 1234.9 -> "1,235". Matches the legacy balance format. */
export function moneyCompact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return Math.round(safe).toLocaleString();
}

/** Prefix-aware money for copy/paste receipts and WhatsApp messages. */
export function moneyWithPrefix(amount: number, prefix = 'Rs. '): string {
  return `${prefix}${money(amount)}`;
}

/** "2026-10-02, 6:17:24 PM" — identical to the legacy `toLocaleString()` output. */
export function dateTime(value: Date | number | string = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

/** Local YYYY-MM-DD for filenames, keys and CSV grouping. */
export function isoDate(value: Date | number | string = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
