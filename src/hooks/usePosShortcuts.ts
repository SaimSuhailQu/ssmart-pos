import { useEffect, useRef } from 'react';

/**
 * Desktop POS keyboard shortcuts.
 *
 * Mapping matches the on-screen shortcut bar (cashier muscle memory):
 *   F1 / Space — open tender / payment modal
 *   F9         — tender (alias)
 *   F2         — hold / resume order
 *   F3         — custom-item dialog
 *   F4         — product catalog drawer
 *   F5         — refresh product catalog (preventDefault: blocks browser reload)
 *   Esc        — close topmost modal, else void-order confirm
 *
 * NOTE: Enter is deliberately NOT mapped. Hardware barcode scanners
 * terminate every scan with Enter (see useScanner) — binding Enter to
 * tender would open the payment modal after every single scan.
 *
 * Binds on `keydown` at the window level, like the engine it replaces.
 * Handlers are ref-forwarded so the listener never goes stale.
 */

export interface PosShortcutHandlers {
  onTender?: () => void;
  onHoldResume?: () => void;
  onCustomItem?: () => void;
  onToggleCatalog?: () => void;
  onRefreshCatalog?: () => void;
  onEscape?: () => void;
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
}

export function usePosShortcuts(handlers: PosShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current;
      const typing = isTypingTarget(e);

      if (e.key === 'Escape') {
        h.onEscape?.();
        return;
      }

      switch (e.key) {
        case 'F1':
        case 'F9':
          e.preventDefault();
          if (!typing) h.onTender?.();
          break;
        case ' ':
          if (!typing) {
            e.preventDefault();
            h.onTender?.();
          }
          break;
        case 'F2':
          e.preventDefault();
          h.onHoldResume?.();
          break;
        case 'F3':
          e.preventDefault();
          h.onCustomItem?.();
          break;
        case 'F4':
          e.preventDefault();
          h.onToggleCatalog?.();
          break;
        case 'F5':
          e.preventDefault();
          h.onRefreshCatalog?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
