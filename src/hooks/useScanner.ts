import { useEffect, useRef } from 'react';

export function useScanner(onScan: (barcode: string) => void) {
  const buffer = useRef('');
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const currentTime = Date.now();
      
      // If time between keystrokes is too long, clear the buffer
      // Real scanners act as fast keyboards (e.g. < 50ms per keystroke)
      if (currentTime - lastKeyTime.current > 100) {
        buffer.current = '';
      }
      
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        if (buffer.current.length > 0) {
          onScan(buffer.current);
          buffer.current = '';
        }
      } else if (e.key.length === 1) { // ignore shift, ctrl, etc.
        buffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}
