/**
 * POS store — the session + basket state for the terminal.
 *
 * This replaces the ~20 useState hooks in App.tsx (cart, heldCart,
 * discount, user, view) with one typed store. Business rules live in
 * `src/domain/cart.ts`; this module only wires them to state and toasts.
 *
 * Migration path for App.tsx:
 *   const cart = useStore(posStore, (s) => s.cart);
 *   const totals = useStore(posStore, (s) => s.totals);
 *   posActions.addToCart(product);
 */

import { createStore, useStore } from './store';
import {
  CartState,
  CartProduct,
  CartTotals,
  emptyCart,
  addLine,
  setLineQty,
  removeLine,
  cartTotals,
} from '../domain/cart';
import { fromMajor } from '../core/money';
import { toast } from './toast';
import { resultMessage } from '../core/result';

export type PosView =
  | 'POS'
  | 'INVENTORY'
  | 'CUSTOMERS'
  | 'ANALYTICS'
  | 'SALES_RECORD'
  | 'EXPENSES'
  | 'VENDORS'
  | 'BARCODE_PRINT';

export interface SessionUser {
  id: number;
  name: string;
  role: 'Cashier' | 'Manager' | 'Admin' | string;
}

interface PosState {
  cart: CartState;
  heldCart: CartState | null;
  /** Discount in minor units (paisa). */
  discountMinor: number;
  /** Tax rate in basis points. 0 = tax disabled (current policy). */
  taxRateBps: number;
  totals: CartTotals;
  user: SessionUser | null;
  view: PosView;
}

function withTotals(s: Omit<PosState, 'totals'>): PosState {
  return { ...s, totals: cartTotals(s.cart, s.discountMinor, s.taxRateBps) };
}

const initial: PosState = withTotals({
  cart: emptyCart(),
  heldCart: null,
  discountMinor: 0,
  taxRateBps: 0,
  user: null,
  view: 'POS',
});

export const posStore = createStore<PosState>(initial);

/** Read a slice of POS state in a component (re-renders only on change). */
export function usePos<T>(selector: (s: PosState) => T): T {
  return useStore(posStore, selector);
}

function update(fn: (s: PosState) => Partial<PosState>): void {
  posStore.setState((s) => {
    const partial = fn(s);
    const merged = { ...s, ...partial };
    return withTotals(merged);
  });
}

export const posActions = {
  /** Returns true when the line was added (false = rejected with a toast). */
  addToCart(product: CartProduct, qty = 1): boolean {
    const res = addLine(posStore.getState().cart, product, qty);
    if (!res.ok) {
      toast.error(resultMessage(res));
      return false;
    }
    update(() => ({ cart: res.value }));
    return true;
  },

  setQty(productId: number, qty: number): void {
    const res = setLineQty(posStore.getState().cart, productId, qty);
    if (!res.ok) {
      toast.error(resultMessage(res));
      return;
    }
    update(() => ({ cart: res.value }));
  },

  removeItem(productId: number): void {
    update((s) => ({ cart: removeLine(s.cart, productId) }));
  },

  clearCart(): void {
    update(() => ({ cart: emptyCart(), discountMinor: 0 }));
  },

  holdCart(): void {
    const { cart } = posStore.getState();
    if (cart.length === 0) {
      toast.warning('Cart is empty — nothing to hold.');
      return;
    }
    update(() => ({ heldCart: cart, cart: emptyCart(), discountMinor: 0 }));
    toast.info('Order placed on hold.');
  },

  resumeHeldCart(): void {
    const { heldCart } = posStore.getState();
    if (!heldCart) {
      toast.warning('No held order to resume.');
      return;
    }
    update(() => ({ cart: heldCart, heldCart: null, discountMinor: 0 }));
    toast.info('Held order resumed.');
  },

  /** Discount in major units (rupees) from the UI. */
  setDiscountMajor(rupees: number): void {
    const minor = fromMajor(rupees).minor;
    const { totals } = posStore.getState();
    if (minor < 0 || minor > totals.subtotal.minor) {
      toast.error('Discount must be between 0 and the subtotal.');
      return;
    }
    update(() => ({ discountMinor: minor }));
  },

  setUser(user: SessionUser | null): void {
    posStore.setState({ user });
    if (user) {
      // Role-based view bounds, previously an effect in App.tsx.
      const { view } = posStore.getState();
      if (view === 'ANALYTICS' && user.role !== 'Admin') posStore.setState({ view: 'POS' });
      if (
        (view === 'INVENTORY' || view === 'CUSTOMERS' || view === 'VENDORS' || view === 'BARCODE_PRINT') &&
        user.role === 'Cashier'
      ) {
        posStore.setState({ view: 'POS' });
      }
    }
  },

  setView(view: PosView): void {
    const { user } = posStore.getState();
    if (user) {
      if (view === 'ANALYTICS' && user.role !== 'Admin') return;
      if (
        (view === 'INVENTORY' || view === 'CUSTOMERS' || view === 'VENDORS' || view === 'BARCODE_PRINT') &&
        user.role === 'Cashier'
      ) {
        return;
      }
    }
    posStore.setState({ view });
  },
};

export { ZERO_TOTALS } from '../domain/cart';
