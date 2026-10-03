/**
 * ESC/POS receipt builder — pure functions returning Buffers.
 *
 * No hardware, no side effects: trivially unit-testable. The spooler
 * (`printSpooler.ts`) feeds these bytes to whichever transport is online.
 *
 * Target: 80mm thermal printers (48 columns at font A). All text is
 * ASCII-folded because most firmware mangles non-Latin glyphs.
 */

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface ReceiptData {
  storeName: string;
  storeLines: string[];
  saleId?: number;
  cashier: string;
  customer?: string;
  lines: ReceiptLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  payments: Array<{ method: string; amountMinor: number }>;
  tenderedMinor: number;
  changeMinor: number;
  footerLines?: string[];
}

const ESC = 0x1b;
const GS = 0x1d;

const foldAscii = (s: string): string =>
  (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');

const money = (minor: number): string => `Rs. ${(minor / 100).toFixed(2)}`;

function bytes(...vals: number[]): Buffer {
  return Buffer.from(vals);
}

export const init = (): Buffer => bytes(ESC, 0x40); // Initialize
export const alignCenter = (): Buffer => bytes(ESC, 0x61, 0x01);
export const alignLeft = (): Buffer => bytes(ESC, 0x61, 0x00);
export const alignRight = (): Buffer => bytes(ESC, 0x61, 0x02);
export const boldOn = (): Buffer => bytes(ESC, 0x45, 0x01);
export const boldOff = (): Buffer => bytes(ESC, 0x45, 0x00);
export const doubleSizeOn = (): Buffer => bytes(GS, 0x21, 0x11);
export const doubleSizeOff = (): Buffer => bytes(GS, 0x21, 0x00);
export const feed = (n = 3): Buffer => bytes(ESC, 0x64, n);
export const cut = (): Buffer => bytes(GS, 0x56, 0x01); // partial cut

export const text = (s: string): Buffer =>
  Buffer.concat([Buffer.from(foldAscii(s), 'ascii'), bytes(0x0a)]);

export const divider = (char = '-'): Buffer => text(char.repeat(48));

/** CODE128 barcode. Returns bytes; caller should center first. */
export function barcode(code128: string): Buffer {
  const data = Buffer.from(foldAscii(code128), 'ascii');
  return Buffer.concat([
    bytes(GS, 0x68, 80), // height
    bytes(GS, 0x77, 2), // width
    bytes(GS, 0x6b, 73, data.length),
    data,
  ]);
}

/** Two-column row: left label, right amount, padded to 48 cols. */
function row(label: string, value: string): Buffer {
  const l = foldAscii(label);
  const v = foldAscii(value);
  const spaces = Math.max(1, 48 - l.length - v.length);
  return text(l + ' '.repeat(spaces) + v);
}

export function buildReceiptBytes(r: ReceiptData): Buffer {
  const parts: Buffer[] = [init(), alignCenter(), doubleSizeOn()];
  parts.push(text(r.storeName.toUpperCase()));
  parts.push(doubleSizeOff());
  for (const line of r.storeLines) parts.push(text(line));
  parts.push(divider());

  parts.push(alignLeft());
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  parts.push(row(`Inv #: ${r.saleId ? String(r.saleId).padStart(5, '0') : 'WALK-IN'}`, `Date: ${dateStr}`));
  parts.push(row(`Cashier: ${r.cashier}`, `Time: ${timeStr}`));
  if (r.customer) parts.push(row('Customer:', r.customer));
  parts.push(divider());

  for (const item of r.lines) {
    parts.push(boldOn(), text(item.name.toUpperCase().slice(0, 48)), boldOff());
    parts.push(
      row(
        `${(item.unitPriceMinor / 100).toFixed(2)} x ${item.qty}`,
        (item.lineTotalMinor / 100).toFixed(2),
      ),
    );
  }
  parts.push(divider());

  parts.push(row('Subtotal:', money(r.subtotalMinor)));
  if (r.discountMinor > 0) parts.push(row('Discount:', `-${money(r.discountMinor)}`));
  if (r.taxMinor > 0) parts.push(row('Tax:', money(r.taxMinor)));
  parts.push(divider('='));
  parts.push(boldOn(), doubleSizeOn(), alignCenter());
  parts.push(text(`TOTAL: ${money(r.totalMinor)}`));
  parts.push(doubleSizeOff(), boldOff(), alignLeft());
  parts.push(divider('='));

  for (const p of r.payments) parts.push(row(`Paid via ${p.method}:`, money(p.amountMinor)));
  parts.push(row('Tendered:', money(r.tenderedMinor)));
  if (r.changeMinor > 0) parts.push(row('Change:', money(r.changeMinor)));

  parts.push(divider());
  parts.push(alignCenter());
  if (r.saleId) {
    parts.push(barcode(`SSM${String(r.saleId).padStart(8, '0')}`));
    parts.push(text(''));
  }
  parts.push(text('Thank you for shopping with us!'));
  for (const f of r.footerLines ?? []) parts.push(text(f));
  parts.push(feed(4), cut());
  return Buffer.concat(parts);
}

/** A4 barcode label sheet (text fallback for non-ESC/POS label printers). */
export function buildBarcodeLabelText(name: string, barcode: string, priceMinor: number): string {
  return `${foldAscii(name).toUpperCase().slice(0, 32)}\n${foldAscii(barcode)}\nRs. ${(priceMinor / 100).toFixed(2)}`;
}
