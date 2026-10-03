/**
 * Cart domain — pure business logic for the POS basket.
 *
 * Zero React, zero IPC, zero side effects. The store (`src/state/posStore.ts`)
 * owns the mutable state; this module owns the rules:
 *
 *  - quantities are integers >= 1 and never exceed available stock
 *  - all money flows through the integer `Money` type (no floats)
 *  - totals come from `computeTotals` (discount clamped, tax after discount)
 *
 * Every mutating function returns a `Result` so the UI can show a friendly
 * message instead of silently mis-adding.
 */

import { Result, ok, err } from '../core/result';
import { Money, fromMajor, fromMinor, mulQty, computeTotals, Totals, zero } from '../core/money';

export interface CartProduct {
  id: number;
  name: string;
  barcode: string;
  /** Unit price in major units (legacy Product shape) — converted to Money once. */
  price: number;
  stock: number;
  category?: string;
}

export interface CartLine {
  productId: number;
  name: string;
  barcode: string;
  unitPrice: Money;
  qty: number;
  stock: number;
  category: string;
}

export type CartState = readonly CartLine[];

export const emptyCart = (): CartState => [];

export const cartItemCount = (cart: CartState): number =>
  cart.reduce((sum, line) => sum + line.qty, 0);

export interface CartTotals extends Totals {
  itemCount: number;
  lineCount: number;
}

/** Totals for the current cart. Tax rate is in basis points (0 = disabled). */
export function cartTotals(
  cart: CartState,
  discountMinor = 0,
  taxRateBps = 0,
): CartTotals {
  const subtotal = cart.reduce(
    (sum, line) => sum + mulQty(line.unitPrice, line.qty).minor,
    0,
  );
  const totals = computeTotals({
    subtotal: fromMinor(subtotal),
    discountMinor,
    taxRateBps,
  });
  return { ...totals, itemCount: cartItemCount(cart), lineCount: cart.length };
}

function toLine(product: CartProduct, qty: number): CartLine {
  return {
    productId: product.id,
    name: product.name,
    barcode: product.barcode,
    unitPrice: fromMajor(product.price),
    qty,
    stock: product.stock,
    category: product.category ?? 'General',
  };
}

/** Add a product (or bump qty). Fails when stock would be exceeded. */
export function addLine(cart: CartState, product: CartProduct, qtyToAdd = 1): Result<CartState> {
  const qty = Math.trunc(qtyToAdd);
  if (!Number.isFinite(qty) || qty < 1) return err(new Error('Quantity must be at least 1.'));

  const existing = cart.find((l) => l.productId === product.id);
  if (existing) {
    const nextQty = existing.qty + qty;
    if (nextQty > product.stock) {
      return err(new Error(`Only ${product.stock} × "${product.name}" in stock.`));
    }
    return ok(cart.map((l) => (l.productId === product.id ? { ...l, qty: nextQty } : l)));
  }
  if (qty > product.stock) {
    return err(new Error(`Only ${product.stock} × "${product.name}" in stock.`));
  }
  return ok([...cart, toLine(product, qty)]);
}

/** Set an absolute quantity. qty <= 0 removes the line. */
export function setLineQty(cart: CartState, productId: number, qty: number): Result<CartState> {
  const next = Math.trunc(qty);
  if (!Number.isFinite(next)) return err(new Error('Invalid quantity.'));
  const line = cart.find((l) => l.productId === productId);
  if (!line) return err(new Error('Item is not in the cart.'));
  if (next <= 0) return ok(cart.filter((l) => l.productId !== productId));
  if (next > line.stock) {
    return err(new Error(`Cannot exceed ${line.stock} × "${line.name}" in stock.`));
  }
  return ok(cart.map((l) => (l.productId === productId ? { ...l, qty: next } : l)));
}

export function removeLine(cart: CartState, productId: number): CartState {
  return cart.filter((l) => l.productId !== productId);
}

export function clearCart(): CartState {
  return emptyCart();
}

/** Serialize for the legacy checkout IPC (major-unit floats at the boundary). */
export function toCheckoutPayload(cart: CartState): Array<{
  id: number;
  name: string;
  barcode: string;
  price: number;
  qty: number;
  stock: number;
  cost_price: number;
}> {
  return cart.map((l) => ({
    id: l.productId,
    name: l.name,
    barcode: l.barcode,
    price: l.unitPrice.minor / 100,
    qty: l.qty,
    stock: l.stock,
    cost_price: l.unitPrice.minor / 100,
  }));
}

export const ZERO_TOTALS: CartTotals = {
  subtotal: zero(),
  discount: zero(),
  taxable: zero(),
  tax: zero(),
  total: zero(),
  itemCount: 0,
  lineCount: 0,
};
