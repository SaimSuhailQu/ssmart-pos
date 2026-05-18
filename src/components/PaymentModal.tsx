import React, { useState } from 'react';
import { PaymentData, PaymentEntry } from '../types';
import { X, DollarSign, CreditCard, Smartphone, Gift, CheckCircle, Delete, Plus } from 'lucide-react';

interface PaymentModalProps {
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  onClose: () => void;
  onConfirm: (data: PaymentData) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ total, subtotal, tax, discount, onClose, onConfirm }) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-5xl h-[650px] flex rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.15)] animate-in zoom-in-95 duration-300">
        
        {/* Left Side: Summary & Payments */}
        <div className="w-1/3 bg-black/40 border-r border-white/5 p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/20 blur-[50px] -ml-10 -mt-10 rounded-full"></div>
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center gap-3 text-cyan-400 mb-8 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
              <CreditCard size={28} />
              <h2 className="text-2xl font-bold tracking-tight">Checkout</h2>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-gray-400 text-sm font-medium">
                <span>Subtotal</span>
                <span className="text-gray-200">Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-sm font-medium">
                <span>Tax</span>
                <span className="text-gray-200">Rs. {tax.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-400 text-sm font-medium">
                  <span>Discount</span>
                  <span>-Rs. {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-gray-300 text-lg font-medium">Total</span>
                  <span className="text-4xl font-extrabold text-white drop-shadow-md">Rs. {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Split Payments List */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {payments.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 glass-panel rounded-xl border border-white/5 bg-white/5">
                  <div className="flex items-center gap-2 text-cyan-300">
                    {p.method === 'Cash' && <DollarSign size={16} />}
                    {p.method === 'Card' && <CreditCard size={16} />}
                    {p.method === 'Mobile' && <Smartphone size={16} />}
                    {p.method === 'Gift Card' && <Gift size={16} />}
                    <span className="text-sm font-medium">{p.method}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold">Rs. {p.amount.toFixed(2)}</span>
                    <button onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-300 transition">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 glass-panel rounded-2xl border-cyan-500/20 mb-4">
              <div className="flex justify-between text-gray-400 text-sm mb-2 font-medium">
                <span>Remaining Balance</span>
                <span className="text-orange-400 text-lg">Rs. {remaining.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-white/10">
                <span className="text-gray-300 font-medium">Change Due</span>
                <span className={`text-2xl font-bold drop-shadow-md ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Rs. {Math.max(0, change).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-gray-400 glass-button relative z-10 hover:text-white"
          >
            Cancel Order
          </button>
        </div>

        {/* Right Side: Payment Methods & Keypad */}
        <div className="w-2/3 p-8 flex flex-col bg-transparent">
          {/* Method Selection */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {(['Cash', 'Card', 'Mobile', 'Gift Card'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMethod(m); setTenderedStr(''); }}
                className={`py-3 rounded-2xl font-bold text-sm transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                  method === m
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_20px_rgba(0,240,255,0.2)] scale-105'
                    : 'glass-button text-gray-400'
                }`}
              >
                {m === 'Cash' && <DollarSign size={20} />}
                {m === 'Card' && <CreditCard size={20} />}
                {m === 'Mobile' && <Smartphone size={20} />}
                {m === 'Gift Card' && <Gift size={20} />}
                {m}
              </button>
            ))}
          </div>

          {/* Dynamic Content based on method */}
          <div className="flex-1 flex flex-col">
            {method === 'Cash' ? (
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-gray-300 font-medium">Cash Tendered</h3>
                  <div className="text-3xl font-mono text-white tracking-widest bg-black/40 px-6 py-2 rounded-xl border border-white/10 shadow-inner">
                    Rs. {tenderedStr || '0.00'}
                  </div>
                </div>

                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {QUICK_CASH.map(amount => (
                    <button
                      key={amount}
                      onClick={() => handleQuickAdd(amount)}
                      className="py-3 rounded-xl font-bold text-cyan-100 bg-cyan-900/40 border border-cyan-500/30 hover:bg-cyan-800/60 transition-colors shadow-lg"
                    >
                      Rs. {amount}
                    </button>
                  ))}
                  <button
                    onClick={() => handleQuickAdd(Math.ceil(remaining))}
                    className="py-3 rounded-xl font-bold text-emerald-100 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-800/60 transition-colors shadow-lg"
                  >
                    Exact
                  </button>
                </div>

                {/* Numeric Keypad & Split Add */}
                <div className="grid grid-cols-4 gap-3 flex-1">
                  <div className="col-span-3 grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(num => (
                      <button
                        key={num}
                        onClick={() => handleKeypad(num.toString())}
                        className="glass-button rounded-xl text-2xl font-bold text-gray-200 shadow-md"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => handleKeypad('C')}
                      className="glass-button rounded-xl flex items-center justify-center text-red-400 shadow-md"
                    >
                      <Delete size={28} />
                    </button>
                  </div>
                  <div className="col-span-1 flex flex-col gap-3">
                    <button 
                      onClick={handleAddPayment}
                      disabled={currentTenderedAmount <= 0}
                      className="flex-1 rounded-xl bg-cyan-600/30 hover:bg-cyan-500/50 border border-cyan-500/50 text-cyan-100 font-bold flex flex-col items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      <Plus size={24} />
                      <span className="text-sm">Add Part</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 animate-in fade-in duration-500 relative">
                <div className="w-24 h-24 mb-6 rounded-full glass-panel flex items-center justify-center border-cyan-500/30 shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-pulse">
                  {method === 'Card' && <CreditCard size={40} className="text-cyan-400" />}
                  {method === 'Mobile' && <Smartphone size={40} className="text-cyan-400" />}
                  {method === 'Gift Card' && <Gift size={40} className="text-cyan-400" />}
                </div>
                <h3 className="text-xl text-white font-medium mb-2">Process {method}</h3>
                <p>Charging remaining balance: <strong className="text-cyan-300">Rs. {remaining.toFixed(2)}</strong></p>
                
                <button 
                  onClick={handleAddPayment}
                  disabled={remaining <= 0}
                  className="mt-8 px-8 py-3 rounded-xl bg-cyan-600/30 hover:bg-cyan-500/50 border border-cyan-500/50 text-cyan-100 font-bold transition shadow-lg disabled:opacity-50"
                >
                  Mark as Paid
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-white/5">
            <button
              onClick={handlePay}
              disabled={isProcessing || !isEnough}
              className="w-full py-4 rounded-xl font-extrabold text-xl text-white shadow-[0_0_20px_rgba(0,240,255,0.3)] bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:shadow-none transition-all flex justify-center items-center gap-3 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              {isProcessing ? (
                <span className="relative z-10 tracking-widest animate-pulse">PROCESSING...</span>
              ) : (
                <span className="relative z-10 tracking-widest flex items-center gap-2">
                  <CheckCircle size={24} /> {isEnough ? 'CONFIRM PAYMENT' : `NEED Rs. ${remaining.toFixed(2)}`}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
