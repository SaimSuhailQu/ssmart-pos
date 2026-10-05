import React, { useState, useEffect, useMemo } from 'react';
import { PaymentData, Customer } from '../types';
import { X, CreditCard, Printer, BookOpen, UserCheck, Search, Save } from 'lucide-react';
import { moneyCompact } from '../core/format';
import { Money, fromMinor, add, sub } from '../core/money';
import { CartState } from '../domain/cart';
import { TenderPadBody, TenderLine, TENDER_METHODS, TenderMethod } from './pos/QuickTenderPad';

interface PaymentModalProps {
  total: Money;
  subtotal: Money;
  tax: Money;
  discount: Money;
  items: CartState;
  onClose: () => void;
  onConfirm: (data: PaymentData) => Promise<void>;
  nextSaleId?: number;
}

const KHATA_METHOD: TenderMethod = { id: 'Credit / Loan', label: 'Khata', icon: <BookOpen size={18} /> };
const PAYMENT_METHODS: TenderMethod[] = [...TENDER_METHODS, KHATA_METHOD];

/**
 * Terminal settlement modal.
 *
 * Tender math runs on the shared TenderPadBody (integer paisa — no float
 * drift). The khata/customer flow and thermal receipt preview are kept
 * around it: when any payment line uses Credit/Loan, a customer must be
 * selected before the sale can complete.
 */
export const PaymentModal: React.FC<PaymentModalProps> = ({
  total,
  subtotal,
  tax,
  discount,
  items,
  onClose,
  onConfirm,
  nextSaleId = 1,
}) => {
  const [lines, setLines] = useState<TenderLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Customer loan / Khata selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  useEffect(() => {
    window.api.getAllCustomers().then(setCustomers).catch(console.error);
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const tendered: Money = useMemo(
    () => lines.reduce((sum, l) => add(sum, l.amount), fromMinor(0)),
    [lines],
  );
  const remaining = useMemo(() => sub(total, tendered), [total, tendered]);
  const change: Money = useMemo(
    () => (remaining.minor < 0 ? fromMinor(-remaining.minor) : fromMinor(0)),
    [remaining],
  );

  const hasKhata = lines.some((l) => l.method === KHATA_METHOD.id);
  const isEnough =
    remaining.minor <= 0 && lines.length > 0 && (!hasKhata || !!selectedCustomerId);

  const toMajor = (m: Money): number => m.minor / 100;

  const handlePay = async (skipReceipt = false) => {
    if (!isEnough || isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm({
        subtotal: toMajor(subtotal),
        tax: toMajor(tax),
        discount: toMajor(discount),
        total: toMajor(total),
        payments: lines.map((l) => ({ method: l.method, amount: toMajor(l.amount) })),
        change: toMajor(change),
        customerId: selectedCustomerId || undefined,
        skipReceipt,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Esc closes; Enter pays (when enough). Digits are owned by the tender pad.
  // Re-subscribes every render — cheap for a modal and always uses fresh state.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isInputFocused) {
        e.preventDefault();
        if (isEnough) void handlePay(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch)),
  );

  // Tactical torn edge for receipt bottom
  const receiptClipPath =
    'polygon(0% 0%, 100% 0%, 100% 98%, 98% 100%, 96% 98%, 94% 100%, 92% 98%, 90% 100%, 88% 98%, 86% 100%, 84% 98%, 82% 100%, 80% 98%, 78% 100%, 76% 98%, 74% 100%, 72% 98%, 70% 100%, 68% 98%, 66% 100%, 64% 98%, 62% 100%, 60% 98%, 58% 100%, 56% 98%, 54% 100%, 52% 98%, 50% 100%, 48% 98%, 46% 100%, 44% 98%, 42% 100%, 40% 98%, 38% 100%, 36% 98%, 34% 100%, 32% 98%, 30% 100%, 28% 98%, 26% 100%, 24% 98%, 22% 100%, 20% 98%, 18% 100%, 16% 98%, 14% 100%, 12% 98%, 10% 100%, 8% 98%, 6% 100%, 4% 98%, 2% 100%, 0% 98%)';

  const discountMajor = toMajor(discount);
  const subtotalMajor = toMajor(subtotal);
  const totalMajor = toMajor(total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 overflow-y-auto">
      <div className="enterprise-card w-full max-w-6xl max-h-[95vh] flex rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border-canvas-hover">

        {/* Left 56%: Tender pad + Khata */}
        <div className="w-[56%] border-r border-canvas-card p-5 flex flex-col gap-3.5 relative overflow-y-auto bg-canvas-subtle/90">
          {/* Modal Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <CreditCard size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">TERMINAL SETTLEMENT</h2>
                <p className="text-[11px] text-content-secondary font-mono">Sale Order ID: #{nextSaleId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-content-secondary hover:text-white hover:bg-canvas-card flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Integer-money tender pad (shared with fast/mobile checkout) */}
          <TenderPadBody total={total} lines={lines} onLinesChange={setLines} methods={PAYMENT_METHODS} />

          {/* Khata customer picker — required when any line is Credit/Loan */}
          {hasKhata && (
            <div className="flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 bg-status-amber/20 border border-status-amber/30 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-status-amber uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} />
                  Select Customer For Khata / Loan
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-content-muted" size={13} />
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 glass-input rounded-lg text-xs"
                />
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-3 text-xs text-content-muted">
                    No customers found. Please add customer in Customers tab first.
                  </div>
                ) : (
                  filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`p-2 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${
                        selectedCustomerId === c.id
                          ? 'bg-status-amber/20 border-status-amber/60'
                          : 'bg-canvas/60 border-canvas-card hover:border-canvas-hover'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-content-primary flex items-center gap-1.5">
                          {c.name}
                          {selectedCustomerId === c.id && <UserCheck size={13} className="text-status-amber" />}
                        </div>
                        <div className="text-[10px] text-content-secondary font-mono">{c.phone || 'No phone'}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-content-secondary block">Prev Udhaar</span>
                        <span className="text-xs font-mono tabular-nums font-bold text-status-amber">
                          Rs. {moneyCompact(c.balance || 0)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedCustomer && (
                <div className="flex items-center justify-between bg-canvas/60 p-2 rounded-lg border border-status-amber/30 text-xs">
                  <span className="text-status-amber">
                    Total New Due:{' '}
                    <strong className="font-mono tabular-nums">
                      Rs. {moneyCompact((selectedCustomer.balance || 0) + totalMajor)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Main Action buttons row */}
          <div className="flex flex-col gap-2 mt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handlePay(false)}
                disabled={isProcessing || !isEnough}
                className="py-2.5 rounded-lg font-extrabold text-xs text-canvas bg-brand-200 hover:bg-brand-100 disabled:bg-canvas-card disabled:text-content-muted transition-all flex justify-center items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(237,237,234,0.2)]"
                title="Save bill and send receipt to thermal printer"
              >
                {isProcessing ? (
                  <span className="tracking-widest animate-pulse uppercase">PROCESSING...</span>
                ) : (
                  <span className="tracking-wider uppercase flex items-center gap-1.5">
                    <Printer size={15} /> {isEnough ? 'SAVE & PRINT (Enter)' : `NEED Rs. ${Math.max(0, remaining.minor / 100).toFixed(2)}`}
                  </span>
                )}
              </button>

              <button
                onClick={() => handlePay(true)}
                disabled={isProcessing || !isEnough}
                className="py-2.5 rounded-lg font-bold text-xs text-status-emerald bg-status-emerald/20 hover:bg-status-emerald/30 border border-status-emerald/40 disabled:border-canvas-card disabled:bg-canvas-card/40 disabled:text-content-muted transition-all flex justify-center items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
                title="Save bill to database and ledger without printing paper receipt"
              >
                <Save size={15} />
                <span className="tracking-wider uppercase">SAVE (NO PRINT)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg font-medium text-xs text-content-secondary hover:text-white bg-canvas-card/80 border border-canvas-hover hover:bg-canvas-hover transition cursor-pointer"
            >
              CANCEL (Esc)
            </button>
          </div>
        </div>

        {/* Right 44%: Cybernetic Thermal Receipt Viewer */}
        <div className="w-[44%] bg-[#090b11] p-6 flex flex-col justify-between items-center relative overflow-y-auto">
          {/* Virtual Printer Slot Cover */}
          <div className="w-full bg-[#1b1e2a] h-3.5 rounded-full border border-white/10 relative z-20 flex justify-center items-center shadow-md shrink-0">
            <div className="w-[90%] bg-black h-1 rounded-full relative overflow-hidden">
              <div className="absolute inset-x-0 h-[2px] bg-content-faint"></div>
            </div>
          </div>

          {/* Thermal Receipt Body */}
          <div
            style={{ clipPath: receiptClipPath }}
            className="flex-1 w-full max-w-[320px] bg-[#f8f9fa] text-gray-800 p-4 mt-2 shadow-md relative flex flex-col justify-between select-none border-t-4 border-white/80 min-h-[380px] overflow-hidden"
          >
            {/* Header */}
            <div className="text-center font-mono border-b border-gray-400 pb-2 flex flex-col items-center">
              <span className="font-black text-sm text-canvas tracking-wider">SS MART</span>
              <span className="text-[8px] text-gray-600 font-medium">Old Lakar Mandi</span>
              <span className="text-[8px] text-gray-600 font-medium">Opposite Railway Station, Havelian</span>
              <span className="text-[8px] text-gray-600 font-medium">Ph: 0316-5915787</span>

              <div className="w-full text-left text-[8px] text-gray-700 mt-2 flex justify-between">
                <span>Invoice # {nextSaleId}</span>
                <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
              </div>
              <div className="w-full text-left text-[8px] text-gray-700 flex justify-between">
                <span>User : SS Mart</span>
                <span>Time: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </div>
            </div>

            {/* Table Header */}
            <div className="font-mono text-[8px] border-b border-gray-400 py-1 grid grid-cols-6 font-bold text-canvas text-right">
              <span className="col-span-2 text-left">Description</span>
              <span>O.Price</span>
              <span>Disc%</span>
              <span>Qty</span>
              <span>Amount</span>
            </div>

            {/* Cart Items List */}
            <div className="font-mono text-[8px] flex-1 py-1 overflow-y-auto border-b border-gray-400 scrollbar-none max-h-48 divide-y divide-gray-200">
              {items.map((item, idx) => {
                const unitMajor = item.unitPrice.minor / 100;
                const itemDiscPercent = discountMajor > 0 && subtotalMajor > 0 ? (discountMajor / subtotalMajor) * 100 : 0;
                const finalPrice = unitMajor * (1 - itemDiscPercent / 100);
                return (
                  <div key={idx} className="py-1">
                    <div className="font-bold text-canvas leading-tight mb-0.5">{item.name}</div>
                    <div className="grid grid-cols-6 text-right text-gray-700">
                      <span className="col-span-2"></span>
                      <span>{unitMajor.toFixed(2)}</span>
                      <span>{itemDiscPercent > 0 ? itemDiscPercent.toFixed(1) + '%' : '0.0%'}</span>
                      <span>{item.qty}</span>
                      <span className="font-bold text-canvas">{(finalPrice * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sub Total / Totals */}
            <div className="font-mono text-[8px] py-1 border-b border-gray-400 flex flex-col gap-0.5">
              <div className="flex justify-between font-bold text-canvas">
                <span>Sub Total {subtotalMajor.toFixed(2)}</span>
                <span>{totalMajor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-800">
                <span>Cash Received</span>
                <span>{(tendered.minor / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-800">
                <span>Balance</span>
                <span>{(change.minor / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Discount Box */}
            {discountMajor > 0 && (
              <div className="font-mono text-[8px] my-1 py-1 border-y border-gray-900 bg-gray-200 flex justify-between font-bold px-2 text-canvas">
                <span>Total Discount</span>
                <span>{discountMajor.toFixed(2)}</span>
              </div>
            )}

            {/* Note & Footer */}
            <div className="text-center font-mono text-[7px] pt-1 text-gray-600 flex flex-col items-center leading-tight">
              <span className="font-bold text-canvas tracking-wider mt-1">THANKS FOR YOUR VISIT</span>
              <span className="text-[6px] text-gray-500 mt-0.5">Software Developed By: SSQ</span>
            </div>
          </div>

          {/* Quick thermal print status banner & Print Receipt Trigger */}
          <div className="w-full flex items-center justify-between gap-2 relative z-20 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono text-content-secondary border border-canvas-card bg-canvas-subtle/80 uppercase select-none">
              <Printer size={11} className="text-indigo-400" /> Thermal Preview
            </span>
            <button
              onClick={() => {
                if (window.api && window.api.printReceipt) {
                  window.api.printReceipt({
                    items: items.map((l) => ({
                      id: l.productId,
                      name: l.name,
                      qty: l.qty,
                      price: l.unitPrice.minor / 100,
                    })),
                    paymentData: {
                      subtotal: subtotalMajor,
                      tax: tax.minor / 100,
                      discount: discountMajor,
                      total: totalMajor,
                      payments: lines.map((l) => ({ method: l.method, amount: l.amount.minor / 100 })),
                      change: change.minor / 100,
                    },
                    saleId: nextSaleId,
                  });
                } else {
                  window.print();
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-canvas-card hover:bg-canvas-hover border border-canvas-hover shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <Printer size={13} /> Print Bill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
