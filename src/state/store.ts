/**
 * Tiny typed store — the single state primitive for the renderer.
 *
 * A minimal zustand-style store with no dependencies, built on
 * `useSyncExternalStore` so selectors only re-render on the slices they
 * read. Replaces ad-hoc `useState` prop-drilling in `App.tsx`.
 *
 * Usage:
 *   const posStore = createStore({ cart: [], discount: 0 });
 *   posStore.setState({ discount: 100 });
 *   posStore.setState((s) => ({ cart: [...s.cart, line] }));
 *   const cart = useStore(posStore, (s) => s.cart);
 */

import { useSyncExternalStore } from 'react';

export type StateUpdater<T> = Partial<T> | ((prev: T) => Partial<T>);

export interface Store<T> {
  getState(): T;
  setState(updater: StateUpdater<T>): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state: T = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (updater) => {
      const partial = typeof updater === 'function' ? (updater as (p: T) => Partial<T>)(state) : updater;
      const next = { ...state, ...partial };
      if (next !== state) {
        state = next;
        listeners.forEach((l) => l());
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Subscribe to a slice of the store with referential stability. */
export function useStore<T extends object, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
