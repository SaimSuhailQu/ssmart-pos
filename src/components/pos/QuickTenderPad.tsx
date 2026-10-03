import React, { useMemo, useState } from 'react';
import { Banknote, CreditCard, Smartphone, Landmark, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumericKeypad } from '../ui/NumericKeypad';
import { Money, fromMajor, fromMinor, add, sub, formatMoneyWithPrefix, isPositive } from '../../core/money';
import { toast } from '../../state/toast';

export interface TenderMethod {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const TENDER_METHODS: TenderMethod[] = [
  { id: 'Cash', label: 'Cash', icon: <Banknote size={18} /> },
  { id: 'Card', label: 'Card', icon: <CreditCard size={18} /> },
  { id: 'Easypaisa', label: 'Easypaisa', icon: <Smartphone size={18} /> },
  { id: 'JazzCash', label: 'JazzCash', icon: <Smartphone size={18} /> },
  { id: 'Bank Transfer', label: 'Bank', icon: <Landmark size={18} /> },
];

export interface TenderLine {
  method: string;
  amount: Money;
}

interface QuickTenderPadProps {
  open: boolean;
  onClose: () => void;
  total: Money;
  onConfirm: (payments: TenderLine[], tendered: Money, change: Money) => void;
}

export interface TenderPadBodyProps {
  total: Money;
  lines: TenderLine[];
  onLinesChange: (lines: TenderLine[]) => void;
  /** Override the method list (e.g. to add Khata/Loan). Defaults to TENDER_METHODS. */
  methods?: TenderMethod[];
}

/**
 * The tender pad without the modal chrome — embeddable in larger flows
 * (e.g. PaymentModal) that need the customer picker / receipt preview
 * around it. Fully controlled: the parent owns the payment lines.
 */
export const TenderPadBody: React.FC<TenderPadBodyProps> = ({
  total,
  lines,
  onLinesChange,
  methods = TENDER_METHODS,
}) => {
  const [method, setMethod] = useState(methods[0]?.id ?? 'Cash');
  const [entry, setEntry] = useState('');

  const tenderedMoney: Money = useMemo(
    () => lines.reduce((sum, l) => add(sum, l.amount), fromMinor(0)),
    [lines],
  );
  const remaining = useMemo(() => sub(total, tenderedMoney), [total, tenderedMoney]);

  const entryAmount = entry ? fromMajor(Number(entry) || 0) : null;

  const addLine = () => {
    const amount = entry ? fromMajor(Number(entry) || 0) : remaining.minor > 0 ? remaining : null;
    if (!amount || !isPositive(amount)) {
      toast.warning('Enter an amount greater than zero.');
      return;
    }
    onLinesChange([...lines, { method, amount }]);
    setEntry('');
  };

  const exactAmount = () => {
    if (remaining.minor <= 0) return;
    onLinesChange([...lines, { method, amount: remaining }]);
    setEntry('');
  };

  const removeLine = (idx: number) => onLinesChange(lines.filter((_, i) => i !== idx));

  const changeDue: Money = remaining.minor < 0 ? ({ minor: -remaining.minor } as Money) : ({ minor: 0 } as Money);

  const quickAmounts = useMemo(() => {
    const t = total.minor / 100;
    const round = (n: number) => Math.ceil(n);
    const set = new Set<number>([round(t)]);
    if (t <= 1000) set.add(1000);
    if (t <= 5000) set.add(5000);
    set.add(round(t / 500) * 500 || 500);
    return [...set].filter((n) => n >= t).sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: totals + split lines */}
      <div>
        <div className="rounded-xl bg-canvas border border-canvas-border p-4 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-content-faint font-bold mb-1">Total due</p>
          <p className="text-4xl font-extrabold text-content-primary tabular-nums">{formatMoneyWithPrefix(total)}</p>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-content-muted">Tendered</span>
            <span className="text-status-emerald font-bold tabular-nums">{formatMoneyWithPrefix(tenderedMoney)}</span>
          </div>
          <div className="flex justify-between mt-1 text-sm">
            <span className="text-content-muted">{remaining.minor > 0 ? 'Remaining' : 'Change due'}</span>
            <span className={`font-bold tabular-nums ${remaining.minor > 0 ? 'text-status-amber' : 'text-content-primary'}`}>
              {formatMoneyWithPrefix(remaining.minor > 0 ? remaining : changeDue)}
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-canvas-card border border-canvas-border">
              <span className="text-xs font-bold text-content-secondary uppercase tracking-wide flex-1">{l.method}</span>
              <span className="text-sm font-bold text-content-primary tabular-nums">{formatMoneyWithPrefix(l.amount)}</span>
              <button onClick={() => removeLine(i)} aria-label="Remove payment line" className="text-status-coral hover:text-status-coral/80 transition cursor-pointer p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {lines.length === 0 ? (
            <p className="text-xs text-content-faint text-center py-3">No payments added yet.</p>
          ) : null}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition cursor-pointer active:scale-95 ${
                method === m.id
                  ? 'bg-brand-600/20 border-brand-500/50 text-brand-300'
                  : 'bg-canvas-card border-canvas-border text-content-muted hover:text-content-primary'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: keypad */}
      <div>
        <div className="rounded-xl bg-canvas border border-canvas-border px-4 py-3 mb-3 text-right">
          <p className="text-[10px] uppercase tracking-widest text-content-faint font-bold">Amount · {method}</p>
          <p className="text-3xl font-extrabold text-content-primary tabular-nums min-h-[2.5rem]">
            {entry || '0'}
          </p>
        </div>
        <NumericKeypad
          value={entry}
          onChange={setEntry}
          quickAmounts={quickAmounts}
          onQuickAmount={(q) => setEntry(String(q))}
        />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant="secondary" size="lg" onClick={addLine} disabled={!entryAmount || !isPositive(entryAmount)}>
            <Plus size={16} /> Add {method}
          </Button>
          <Button variant="success" size="lg" onClick={exactAmount} disabled={remaining.minor <= 0}>
            Exact {formatMoneyWithPrefix(remaining.minor > 0 ? remaining : total)}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Fast-checkout tender pad — the heart of the mobile/fast POS flow.
 *
 *  - Big readable total, numeric keypad, exact-amount quick chips
 *  - Split payments across methods (Cash + Card, etc.)
 *  - Live tendered/change math in integer paisa — no float drift
 *  - Thumb-zone layout: keypad bottom, confirm action 56px tall
 */
/**
 * Fast-checkout tender pad — the heart of the mobile/fast POS flow.
 *
 *  - Big readable total, numeric keypad, exact-amount quick chips
 *  - Split payments across methods (Cash + Card, etc.)
 *  - Live tendered/change math in integer paisa — no float drift
 *  - Thumb-zone layout: keypad bottom, confirm action 56px tall
 *
 * For embedding inside larger flows (PaymentModal), use TenderPadBody
 * directly with controlled lines.
 */
export const QuickTenderPad: React.FC<QuickTenderPadProps> = ({ open, onClose, total, onConfirm }) => {
  const [lines, setLines] = useState<TenderLine[]>([]);

  const tenderedMoney: Money = useMemo(
    () => lines.reduce((sum, l) => add(sum, l.amount), fromMinor(0)),
    [lines],
  );
  const remaining = useMemo(() => sub(total, tenderedMoney), [total, tenderedMoney]);
  const canConfirm = remaining.minor <= 0 && lines.length > 0;
  const changeDue: Money = remaining.minor < 0 ? ({ minor: -remaining.minor } as Money) : ({ minor: 0 } as Money);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tender Payment"
      subtitle="Split across methods if needed"
      size="lg"
      dismissable={false}
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancel (Esc)
          </Button>
          <Button variant="primary" size="touch" disabled={!canConfirm} onClick={() => onConfirm(lines, tenderedMoney, changeDue)}>
            Complete Sale · {formatMoneyWithPrefix(total)}
          </Button>
        </>
      }
    >
      <TenderPadBody total={total} lines={lines} onLinesChange={setLines} />
    </Modal>
  );
};
