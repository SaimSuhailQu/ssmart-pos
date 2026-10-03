/**
 * Toast notifications — the single user-facing feedback channel.
 *
 * Replaces the scattered `setError`/`setSuccess` + 5s timeout pattern in
 * App.tsx. Any module (including non-React code via `toast()`) can push a
 * notification; `ToastHost` renders them.
 */

import { createStore } from './store';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after ms. 0 = sticky. */
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
}

let nextId = 1;

export const toastStore = createStore<ToastState>({ toasts: [] });

function push(kind: ToastKind, message: string, durationMs = 4500): number {
  const id = nextId++;
  toastStore.setState((s) => ({ toasts: [...s.toasts, { id, kind, message, durationMs }] }));
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

export function dismiss(id: number): void {
  toastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export const toast = {
  success: (message: string, durationMs?: number) => push('success', message, durationMs),
  error: (message: string, durationMs = 7000) => push('error', message, durationMs),
  info: (message: string, durationMs?: number) => push('info', message, durationMs),
  warning: (message: string, durationMs?: number) => push('warning', message, durationMs),
};
