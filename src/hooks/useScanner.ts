import { useEffect, useRef } from 'react';

export function useScanner(
  onScan: (barcode: string) => void,
  validBarcodes: Set<string> | string[] = new Set(),
  activeView = 'POS'
) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const validBarcodesRef = useRef(validBarcodes);
  validBarcodesRef.current = validBarcodes;
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  const buffer = useRef('');
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isModalOrFormInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      
      const isPosScreen = activeViewRef.current === 'POS';
      const placeholder = (target && (target as HTMLInputElement).placeholder) || '';
      const isPosSearchBar = target && target.tagName === 'INPUT' && /barcode|search/i.test(placeholder);

      // If user is inside an input field in another screen (e.g. Add Product modal, CRM, Inventory), let normal typing/scanning fill that input!
      if (isModalOrFormInput && !isPosSearchBar) {
        return;
      }

      console.log('[Scanner KeyDown]', { key: e.key, code: e.code, isPosSearchBar, targetTag: target?.tagName });

      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      // If user paused typing for > 600ms, start fresh buffer
      if (timeDiff > 600 && buffer.current.length > 0) {
        buffer.current = '';
      }

      // 1. Enter key trigger (Standard for 99% of hardware barcode scanners)
      if (e.key === 'Enter') {
        // If the scanner typed into the POS search bar, take its value if buffer is empty
        let code = buffer.current.trim();
        if (!code && isPosSearchBar && target) {
          code = (target as HTMLInputElement).value.trim();
        }

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

      // Ignore non-printable modifier/navigation keys
      if (!e.key || e.key.length !== 1) {
        return;
      }

      // 2. Buffer printable character
      if (isPosScreen) {
        buffer.current += e.key;
        const currentBuffer = buffer.current.trim();

        // 3. Exact match lookup (only if barcode is at least 3 chars long)
        const vb = validBarcodesRef.current;
        const hasMatch = vb instanceof Set ? vb.has(currentBuffer) : vb.includes(currentBuffer);

        if (currentBuffer.length >= 3 && hasMatch) {
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

        // 4. Fallback timer for scanners that do not send an Enter key suffix
        if (timeoutId.current) clearTimeout(timeoutId.current);
        timeoutId.current = setTimeout(() => {
          const scannedCode = buffer.current.trim();
          if (scannedCode.length >= 3) {
            buffer.current = '';
            if (isPosSearchBar && target) {
              (target as HTMLInputElement).value = '';
            }
            onScanRef.current(scannedCode);
          } else {
            buffer.current = '';
          }
        }, 250);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, []);
}
