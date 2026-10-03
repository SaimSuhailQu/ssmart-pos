import React, { useCallback } from 'react';
import { Delete } from 'lucide-react';
import { touch } from '../../design/tokens';

interface NumericKeypadProps {
  /** Current display value (major units, as typed). */
  value: string;
  onChange: (next: string) => void;
  /** Compact mode for the fast-checkout drawer; full for the tender modal. */
  onQuickAmount?: (amount: number) => void;
  quickAmounts?: number[];
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'];

/**
 * Tender numeric keypad. Thumb-zone friendly: every key meets the 56px
 * comfortable target. Emits a validated numeric string; parsing is the
 * caller's job (`Number()` + `fromMajor`).
 */
export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  onQuickAmount,
  quickAmounts,
  disabled,
}) => {
  const press = useCallback(
    (key: string) => {
      if (disabled) return;
      if (key === '.' && value.includes('.')) return;
      // Max two decimal places.
      if (value.includes('.') && value.split('.')[1]?.length >= 2 && key !== '00' && key !== '.') return;
      const next = (value === '0' && key !== '.' ? '' : value) + key;
      if (next.replace('.', '').length > 9) return;
      onChange(next);
    },
    [value, onChange, disabled],
  );

  const backspace = useCallback(() => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }, [value, onChange, disabled]);

  return (
    <div className="select-none">
      {quickAmounts && quickAmounts.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {quickAmounts.map((q) => (
            <button
              key={q}
              disabled={disabled}
              onClick={() => onQuickAmount?.(q)}
              className="h-11 rounded-lg bg-canvas-card border border-canvas-border text-content-secondary text-xs font-bold hover:bg-canvas-hover hover:text-content-primary active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {q.toLocaleString()}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            disabled={disabled}
            onClick={() => press(k)}
            style={{ minHeight: touch.comfortable }}
            className="rounded-xl bg-canvas-card border border-canvas-border text-content-primary text-xl font-bold hover:bg-canvas-hover active:scale-95 active:bg-brand-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {k}
          </button>
        ))}
        <button
          disabled={disabled}
          onClick={backspace}
          aria-label="Backspace"
          style={{ minHeight: touch.comfortable }}
          className="rounded-xl bg-status-coral/10 border border-status-coral/25 text-status-coral hover:bg-status-coral/20 active:scale-95 transition cursor-pointer disabled:opacity-50 flex items-center justify-center col-span-3"
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
};
