import { useEffect, useRef } from 'react';

export function useScanner(onScan: (barcode: string) => void, validBarcodes: string[] = [], activeView = 'POS') {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const validBarcodesRef = useRef(validBarcodes);
  validBarcodesRef.current = validBarcodes;
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  const buffer = useRef('');
  const timeoutId = useRef<any>(null);
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isModalOrFormInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      
      // If user is inside an input field in another screen (e.g. Add Product modal, CRM, Inventory), let normal typing/scanning fill that input!
      const isPosScreen = activeViewRef.current === 'POS';
      const isPosSearchBar = target && target.tagName === 'INPUT' && (target as HTMLInputElement).placeholder?.includes('Barcode');

      if (isModalOrFormInput && !isPosSearchBar) {
        // Allow the modal input to receive the scan/text normally
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      // If user paused typing for > 250ms, start fresh
      if (timeDiff > 250 && buffer.current.length > 0) {
        buffer.current = '';
      }

      // 1. Enter key trigger (if scanner emits Enter)
      if (e.key === 'Enter') {
        const code = buffer.current.trim();
        if (code.length >= 1) {
          buffer.current = '';
          if (timeoutId.current) clearTimeout(timeoutId.current);
          if (isPosSearchBar && target) {
            (target as HTMLInputElement).value = '';
            (target as HTMLInputElement).blur();
          }
          if (isPosScreen) {
            e.preventDefault();
            e.stopPropagation();
            onScanRef.current(code);
          }
        }
        return;
      }

      // 2. Character-by-character instant matching for POS screen
      if (e.key && e.key.length === 1 && isPosScreen) {
        buffer.current += e.key;
        const currentBuffer = buffer.current.trim();

        // Check if the current buffer exactly matches an existing product barcode
        if (currentBuffer.length >= 3 && validBarcodesRef.current.includes(currentBuffer)) {
          const matchedCode = currentBuffer;
          buffer.current = '';
          if (timeoutId.current) clearTimeout(timeoutId.current);
          if (isPosSearchBar && target) {
            (target as HTMLInputElement).value = '';
            (target as HTMLInputElement).blur();
          }
          onScanRef.current(matchedCode);
          return;
        }

        // 3. Fallback auto-timer: if scanner emits unknown barcode without Enter in POS screen
        if (timeoutId.current) clearTimeout(timeoutId.current);
        timeoutId.current = setTimeout(() => {
          if (buffer.current.length >= 4) {
            const barcode = buffer.current.trim();
            buffer.current = '';
            if (isPosSearchBar && target) {
              (target as HTMLInputElement).value = '';
            }
            onScanRef.current(barcode);
          } else {
            buffer.current = '';
          }
        }, 80);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, []);
}
