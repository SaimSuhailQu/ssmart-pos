/**
 * Money — integer minor-unit currency arithmetic for the POS.
 *
 * Floating point is banned from money math in this codebase. Every rupee
 * amount is stored and computed as an integer number of paisa
 * (`minor = rupees * 100`). A `Money` value is an opaque branded object:
 * construct it with `fromMajor`/`fromMinor`, combine with `add`/`sub`,
 * and render with `formatMoney`.
 *
 * Migration rule: `db.ts`, the cart, and all tender math must speak Money
 * at the boundary. Convert to plain numbers only when calling legacy IPC
 * (`toMajor`) and convert back immediately on return.
 */

import { money as formatNumber } from './format';

/** Runtime brand key. Unique per module load; never serialized. */
const moneyBrand: unique symbol = Symbol('Money');

/** An amount of money in integer minor units (paisa). Opaque by design. */
export type Money = {
  readonly minor: number;
  readonly [moneyBrand]: 'Money';
};

export const CURRENCY_CODE = 'PKR' as const;
export const MINOR_PER_MAJOR = 100;

/** Build from a major-unit number (e.g. 1499.99). Rounds half away from zero. */
export function fromMajor(amount: number): Money {
  const safe = Number.isFinite(amount) ? amount : 0;
  return fromMinor(Math.round(safe * MINOR_PER_MAJOR));
}

/** Build directly from integer minor units (e.g. 149999 paisa). */
export function fromMinor(minor: number): Money {
  const safe = Number.isFinite(minor) ? Math.trunc(minor) : 0;
  return { minor: safe, [moneyBrand]: 'Money' } as Money;
}

export const zero = (): Money => fromMinor(0);

export const isMoney = (v: unknown): v is Money =>
  typeof v === 'object' && v !== null && typeof (v as Money).minor === 'number';

/** Major units as a float — use ONLY at legacy boundaries (IPC, CSV). */
export function toMajor(m: Money): number {
  return m.minor / MINOR_PER_MAJOR;
}

/** Raw minor units — for database columns that store integer paisa. */
export function toMinor(m: Money): number {
  return m.minor;
}

export function add(a: Money, b: Money): Money {
  return fromMinor(a.minor + b.minor);
}

export function sub(a: Money, b: Money): Money {
  return fromMinor(a.minor - b.minor);
}

/** Multiply by an integer quantity (line totals). Exact, no rounding. */
export function mulQty(unit: Money, qty: number): Money {
  const q = Number.isFinite(qty) ? Math.trunc(qty) : 0;
  return fromMinor(unit.minor * q);
}

/**
 * Percentage of an amount using integer basis points (1% = 100 bps).
 * Rounds half away from zero. Exact for whole-rupee amounts.
 */
export function percentOf(amount: Money, rateBps: number): Money {
  const bps = Number.isFinite(rateBps) ? Math.trunc(rateBps) : 0;
  return fromMinor(Math.round((amount.minor * bps) / 10_000));
}

/** Clamp to >= 0. Totals must never go negative. */
export function nonNegative(m: Money): Money {
  return m.minor < 0 ? zero() : m;
}

export const isZero = (m: Money): boolean => m.minor === 0;
export const isPositive = (m: Money): boolean => m.minor > 0;

/** Compare two amounts: -1 | 0 | 1. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0;
}

/** Render for the cashier: "1,499.99". Delegates to the shared formatter. */
export function formatMoney(m: Money, opts: { decimals?: number } = {}): string {
  return formatNumber(toMajor(m), opts);
}

/** Render with currency prefix for receipts/messages: "Rs. 1,499.99". */
export function formatMoneyWithPrefix(m: Money, prefix = 'Rs. '): string {
  return `${prefix}${formatMoney(m)}`;
}

/** Sum a list of amounts. */
export function sum(list: Iterable<Money>): Money {
  let total = 0;
  for (const m of list) total += m.minor;
  return fromMinor(total);
}

export interface TotalsInput {
  /** Line totals before discount. */
  subtotal: Money;
  /** Flat discount in minor units. Clamped to subtotal. */
  discountMinor?: number;
  /** Tax rate in basis points applied AFTER discount. 0 = tax disabled. */
  taxRateBps?: number;
}

export interface Totals {
  subtotal: Money;
  discount: Money;
  taxable: Money;
  tax: Money;
  total: Money;
}

/**
 * The single source of truth for sale totals.
 * Order of operations: subtotal -> discount -> tax on the discounted amount.
 */
export function computeTotals(input: TotalsInput): Totals {
  const subtotal = nonNegative(input.subtotal);
  const discount = nonNegative(fromMinor(input.discountMinor ?? 0));
  const clampedDiscount = compare(discount, subtotal) > 0 ? subtotal : discount;
  const taxable = sub(subtotal, clampedDiscount);
  const tax = percentOf(taxable, input.taxRateBps ?? 0);
  return {
    subtotal,
    discount: clampedDiscount,
    taxable,
    tax,
    total: add(taxable, tax),
  };
}
