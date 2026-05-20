import React, { useState } from 'react';
import { PaymentData, PaymentEntry, CartItem } from '../types';
import { X, DollarSign, CreditCard, Smartphone, Gift, CheckCircle, Delete, Plus, Printer, Sparkles } from 'lucide-react';

interface PaymentModalProps {
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  items: CartItem[];
  onClose: () => void;
  onConfirm: (data: PaymentData) => Promise<void>;
  nextSaleId?: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ total, subtotal, tax, discount, items, onClose, onConfirm, nextSaleId = 1 }) => {
  const [method, setMethod] = useState<string>('Cash');
  const [tenderedStr, setTenderedStr] = useState<string>('');
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);

  const currentTenderedAmount = method === 'Cash' 
    ? (tenderedStr ? parseFloat(tenderedStr) : 0)
    : remaining; // Default to remaining balance for digital methods

  const change = Math.max(0, totalPaid + currentTenderedAmount - total);
  const isEnough = totalPaid + currentTenderedAmount >= total;

  const handleKeypad = (num: string) => {
    if (num === 'C') {
      setTenderedStr('');
    } else if (num === '.') {
      if (!tenderedStr.includes('.')) setTenderedStr(tenderedStr + '.');
    } else {
      if (tenderedStr.includes('.')) {
        const decimals = tenderedStr.split('.')[1];
        if (decimals && decimals.length >= 2) return;
      }
      setTenderedStr(tenderedStr + num);
    }
  };

  const handleQuickAdd = (amount: number) => {
    setTenderedStr(amount.toString());
  };

  const handleAddPayment = () => {
    if (currentTenderedAmount <= 0) return;
    setPayments([...payments, { method, amount: currentTenderedAmount }]);
    setTenderedStr('');
  };

  const removePayment = (index: number) => {
    const newPayments = [...payments];
    newPayments.splice(index, 1);
    setPayments(newPayments);
  };

  const handlePay = async () => {
    if (!isEnough) return;
    setIsProcessing(true);
    try {
      const finalPayments = [...payments];
      if (currentTenderedAmount > 0 && totalPaid < total) {
        finalPayments.push({ method, amount: currentTenderedAmount });
      }
      
      await onConfirm({
        subtotal,
        tax,
        discount,
        total,
        payments: finalPayments,
        change
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const QUICK_CASH = [100, 500, 1000, 5000];

  // Tactical torn edge for receipt bottom
  const receiptClipPath = 'polygon(0% 0%, 100% 0%, 100% 98%, 98% 100%, 96% 98%, 94% 100%, 92% 98%, 90% 100%, 88% 98%, 86% 100%, 84% 98%, 82% 100%, 80% 98%, 78% 100%, 76% 98%, 74% 100%, 72% 98%, 70% 100%, 68% 98%, 66% 100%, 64% 98%, 62% 100%, 60% 98%, 58% 100%, 56% 98%, 54% 100%, 52% 98%, 50% 100%, 48% 98%, 46% 100%, 44% 98%, 42% 100%, 40% 98%, 38% 100%, 36% 98%, 34% 100%, 32% 98%, 30% 100%, 28% 98%, 26% 100%, 24% 98%, 22% 100%, 20% 98%, 18% 100%, 16% 98%, 14% 100%, 12% 98%, 10% 100%, 8% 98%, 6% 100%, 4% 98%, 2% 100%, 0% 98%)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-6xl h-[680px] flex rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,240,255,0.2)] animate-in zoom-in-95 duration-300 border-white/5">
        
        {/* Left 3/5: Checkout Summary, Methods, & Keypad */}
        <div className="w-[58%] border-r border-white/5 p-8 flex flex-col justify-between relative overflow-hidden bg-black/35">
          <div className="absolute top-0 left-0 w-48 h-48 bg-cyan-500/10 blur-[60px] -ml-20 -mt-20 rounded-full"></div>
          
          <div className="relative z-10 flex-1 flex flex-col gap-5">
            {/* Modal Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                <CreditCard size={26} />
                <h2 className="text-2xl font-black uppercase tracking-wider">Terminal Checkout</h2>
              </div>
              <button 
                onClick={onClose} 
                className="w-9 h-9 rounded-xl glass-button flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-4 gap-3">
              {(['Cash', 'Card', 'Mobile', 'Gift Card'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setTenderedStr(''); }}
                  className={`py-3.5 rounded-2xl font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                    method === m
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] scale-[1.03]'
                      : 'glass-button text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m === 'Cash' && <DollarSign size={18} />}
                  {m === 'Card' && <CreditCard size={18} />}
                  {m === 'Mobile' && <Smartphone size={18} />}
                  {m === 'Gift Card' && <Gift size={18} />}
                  {m}
                </button>
              ))}
            </div>

            {/* Main Interactive Control Area */}
            <div className="flex-1 flex flex-col justify-center">
              {method === 'Cash' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center bg-black/45 p-4 rounded-2xl border border-white/5 shadow-inner">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Cash Tendered</span>
                    <div className="text-3xl font-black text-cyan-400 font-mono tracking-wider">
                      Rs. {tenderedStr || '0.00'}
                    </div>
                  </div>

                  {/* Quick Cash row */}
                  <div className="grid grid-cols-5 gap-2">
                    {QUICK_CASH.map(amount => (
                      <button
                        key={amount}
                        onClick={() => handleQuickAdd(amount)}
                        className="py-2.5 rounded-xl font-black text-[11px] text-cyan-200 bg-cyan-950/40 border border-cyan-500/20 hover:bg-cyan-900/60 hover:border-cyan-400/50 transition-all shadow-md active:scale-95"
                      >
                        +Rs. {amount}
                      </button>
                    ))}
                    <button
                      onClick={() => handleQuickAdd(Math.ceil(remaining))}
                      className="py-2.5 rounded-xl font-black text-[11px] text-emerald-200 bg-emerald-950/40 border border-emerald-500/20 hover:bg-emerald-900/60 hover:border-emerald-400/50 transition-all shadow-md active:scale-95"
                    >
                      Exact Cash
                    </button>
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <div className="col-span-3 grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(num => (
                        <button
                          key={num}
                          onClick={() => handleKeypad(num.toString())}
                          className="glass-button h-12 rounded-xl text-xl font-extrabold text-white hover:text-cyan-300 transition-all"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        onClick={() => handleKeypad('C')}
                        className="glass-button h-12 rounded-xl flex items-center justify-center text-red-400"
                      >
                        <Delete size={20} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={handleAddPayment}
                      disabled={currentTenderedAmount <= 0}
                      className="col-span-1 rounded-xl bg-cyan-600/20 hover:bg-cyan-500/40 border border-cyan-500/40 text-cyan-200 font-extrabold flex flex-col items-center justify-center gap-2 transition disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                    >
                      <Plus size={20} />
                      <span className="text-[10px] uppercase tracking-wider">Add Part</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 mb-4 rounded-full glass-panel flex items-center justify-center border-cyan-500/30 shadow-[0_0_25px_rgba(0,240,255,0.25)] animate-pulse">
                    {method === 'Card' && <CreditCard size={32} className="text-cyan-400" />}
                    {method === 'Mobile' && <Smartphone size={32} className="text-cyan-400" />}
                    {method === 'Gift Card' && <Gift size={32} className="text-cyan-400" />}
                  </div>
                  <h3 className="text-lg font-extrabold text-white uppercase tracking-wider mb-1">Process {method}</h3>
                  <p className="text-sm text-gray-400">Total charge: <strong className="text-cyan-300 font-mono">Rs. {remaining.toFixed(2)}</strong></p>
                  
                  <button 
                    onClick={handleAddPayment}
                    disabled={remaining <= 0}
                    className="mt-6 px-8 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/40 text-cyan-200 font-black uppercase text-xs tracking-widest shadow-md transition disabled:opacity-20 active:scale-95"
                  >
                    Confirm & Complete
                  </button>
                </div>
              )}
            </div>

            {/* Split Payments Tracker Table */}
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4 flex flex-col gap-3">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Transaction Records</span>
              <div className="max-h-24 overflow-y-auto pr-1 space-y-2 scrollbar-none">
                {payments.length === 0 ? (
                  <div className="text-center py-2 text-xs text-gray-500 italic">No payments logged yet</div>
                ) : (
                  payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 glass-panel rounded-xl bg-white/[0.02]">
                      <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                        {p.method === 'Cash' && <DollarSign size={14} />}
                        {p.method === 'Card' && <CreditCard size={14} />}
                        {p.method === 'Mobile' && <Smartphone size={14} />}
                        {p.method === 'Gift Card' && <Gift size={14} />}
                        <span>{p.method}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-white font-mono font-bold">Rs. {p.amount.toFixed(2)}</span>
                        <button onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-300 transition">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Action buttons row */}
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={onClose}
                className="col-span-1 py-3.5 rounded-xl font-bold text-xs text-gray-400 glass-button hover:text-red-300 hover:border-red-500/20 active:scale-95"
              >
                VOID ORDER
              </button>
              
              <button
                onClick={handlePay}
                disabled={isProcessing || !isEnough}
                className="col-span-2 py-3.5 rounded-xl font-black text-sm text-white shadow-[0_0_20px_rgba(0,240,255,0.35)] bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:shadow-none transition-all flex justify-center items-center gap-2 relative overflow-hidden group active:scale-95"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none"></div>
                {isProcessing ? (
                  <span className="relative z-10 tracking-widest animate-pulse uppercase">PROCESSING...</span>
                ) : (
                  <span className="relative z-10 tracking-widest uppercase flex items-center gap-1.5">
                    <CheckCircle size={18} /> {isEnough ? 'CONFIRM PAY' : `NEED Rs. ${remaining.toFixed(2)}`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 2/5: Cybernetic Thermal Receipt Viewer */}
        <div className="w-[42%] bg-[#090b11] p-8 flex flex-col justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-[60px] -mr-20 -mt-20 rounded-full"></div>
          
          {/* Virtual Printer Slot Cover */}
          <div className="w-full bg-[#1b1e2a] h-3.5 rounded-full border border-white/10 relative z-20 flex justify-center items-center shadow-md">
            <div className="w-[90%] bg-black h-1 rounded-full relative overflow-hidden">
              <div className="absolute inset-x-0 h-[2px] bg-cyan-400 shadow-[0_0_5px_#00f0ff] animate-pulse"></div>
            </div>
          </div>

          {/* Thermal Receipt Body */}
          <div 
            style={{ clipPath: receiptClipPath }}
            className="flex-1 w-full max-w-[310px] bg-[#f8f9fa] text-gray-800 p-5 mt-3 shadow-2xl relative flex flex-col justify-between select-none animate-receipt border-t-4 border-cyan-500/80 min-h-[460px] overflow-hidden"
          >
            {/* Glowing print sweep scanline */}
            <div className="absolute left-0 right-0 h-[1px] bg-cyan-500 shadow-[0_0_6px_#06b6d4] opacity-50 pointer-events-none animate-print-scan"></div>
            
            {/* Header */}
            <div className="text-center font-mono border-b border-dashed border-gray-400/50 pb-3 flex flex-col items-center">
              <div className="flex items-center gap-1.5 justify-center font-black text-xs text-gray-900 tracking-wider">
                <Sparkles size={12} className="text-cyan-600" />
                <span>SS MART</span>
              </div>
              <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Havelian</span>
              <span className="text-[7px] text-gray-400 mt-1 font-bold">Invoice No: INV-{nextSaleId}</span>
              <span className="text-[7px] text-gray-400 font-bold">{new Date().toLocaleString('en-US', { hour12: true })}</span>
            </div>

            {/* Cart Items List */}
            <div className="font-mono text-[9px] flex-1 py-3 overflow-y-auto pr-0.5 border-b border-dashed border-gray-400/50 scrollbar-none max-h-48">
              <div className="flex justify-between font-bold text-gray-950 border-b border-gray-300 pb-1 mb-1.5">
                <span>DESC & QTY</span>
                <span>PRICE</span>
              </div>
              
              {items && items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start my-1 text-gray-700">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 leading-tight">{item.name}</span>
                    <span className="text-[7px] text-gray-500 font-mono">Rs. {item.price.toFixed(2)} x {item.qty}</span>
                  </div>
                  <span className="font-bold text-gray-900">Rs. {(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Pricing calculations */}
            <div className="font-mono text-[9px] py-2 border-b border-dashed border-gray-400/50 flex flex-col gap-1">
              <div className="flex justify-between font-medium">
                <span>SUBTOTAL:</span>
                <span>Rs. {subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>DISCOUNT:</span>
                  <span>-Rs. {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-gray-900 text-xs pt-1 border-t border-dashed border-gray-300">
                <span>TOTAL:</span>
                <span>Rs. {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Split/Tender Payments log */}
            <div className="font-mono text-[8px] py-2 border-b border-dashed border-gray-400/50 flex flex-col gap-1">
              <span className="font-black text-gray-500 uppercase tracking-widest text-[7px] mb-1">Receipt Ledger</span>
              {payments.map((p, idx) => (
                <div key={idx} className="flex justify-between text-gray-700">
                  <span>TENDERED ({p.method.toUpperCase()}):</span>
                  <span>Rs. {p.amount.toFixed(2)}</span>
                </div>
              ))}
              {currentTenderedAmount > 0 && totalPaid < total && (
                <div className="flex justify-between text-gray-700 italic">
                  <span>TENDERED ({method.toUpperCase()}):</span>
                  <span>Rs. {currentTenderedAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between font-black text-gray-900 pt-1 border-t border-dashed border-gray-300">
                <span>TOTAL PAID:</span>
                <span>Rs. {Math.max(totalPaid + currentTenderedAmount, totalPaid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-emerald-700">
                <span>CHANGE RETURNED:</span>
                <span>Rs. {change.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center font-mono text-[7px] pt-3 text-gray-500 flex flex-col items-center gap-1">
              <span className="font-bold text-gray-900 tracking-wider">*** THANK YOU FOR SHOPPING ***</span>
              <span className="text-[6px]">POWERED BY SS SMART SYNC ENGINE v1.0</span>
              <div className="flex justify-center mt-1 scale-x-125 opacity-70">
                {/* Simulated barcode */}
                ||||| | |||| ||| ||| | ||| |||| | | ||
              </div>
            </div>
          </div>

          {/* Quick thermal print status banner */}
          <div className="w-full text-center relative z-20">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest text-cyan-400 border border-cyan-500/30 bg-cyan-950/20 uppercase shadow-[0_0_12px_rgba(0,240,255,0.15)] select-none">
              <Printer size={10} className="animate-bounce" /> Virtual Print Ready
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};
