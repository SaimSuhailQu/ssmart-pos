import React, { useState, useEffect } from 'react';
import { PaymentData, PaymentEntry, CartItem, Customer } from '../types';
import { X, DollarSign, CreditCard, Smartphone, Gift, CheckCircle, Delete, Plus, Printer, Sparkles, BookOpen, UserCheck, Search } from 'lucide-react';

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

  // Customer loan / Khata selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [loanNotes, setLoanNotes] = useState<string>('');

  useEffect(() => {
    window.api.getAllCustomers().then(setCustomers).catch(console.error);
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);

  const currentTenderedAmount = method === 'Cash' 
    ? (tenderedStr ? parseFloat(tenderedStr) : 0)
    : remaining; // Default to remaining balance for digital or credit methods

  const change = Math.max(0, totalPaid + currentTenderedAmount - total);
  
  // Is enough: if Credit/Loan, customer must be selected
  const isCreditLoan = method === 'Credit / Loan' || payments.some(p => p.method === 'Credit / Loan');
  const isEnough = (totalPaid + currentTenderedAmount >= total) && (!isCreditLoan || !!selectedCustomerId);

  // Keyboard shortcut listener for Payment Modal (Enter to pay, Esc to close, digits for cash)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isEnough) {
          handlePay();
        }
      } else if (method === 'Cash') {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
          handleKeypad(e.key);
        } else if (e.key === 'Backspace') {
          setTenderedStr(prev => prev.slice(0, -1));
        } else if (e.key === 'c' || e.key === 'C') {
          setTenderedStr('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, isEnough, method, tenderedStr, payments, currentTenderedAmount, total, subtotal, tax, discount, selectedCustomerId]);

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
        change,
        customerId: selectedCustomerId || undefined
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const QUICK_CASH = [100, 500, 1000, 5000];

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.phone && c.phone.includes(customerSearch))
  );

  // Tactical torn edge for receipt bottom
  const receiptClipPath = 'polygon(0% 0%, 100% 0%, 100% 98%, 98% 100%, 96% 98%, 94% 100%, 92% 98%, 90% 100%, 88% 98%, 86% 100%, 84% 98%, 82% 100%, 80% 98%, 78% 100%, 76% 98%, 74% 100%, 72% 98%, 70% 100%, 68% 98%, 66% 100%, 64% 98%, 62% 100%, 60% 98%, 58% 100%, 56% 98%, 54% 100%, 52% 98%, 50% 100%, 48% 98%, 46% 100%, 44% 98%, 42% 100%, 40% 98%, 38% 100%, 36% 98%, 34% 100%, 32% 98%, 30% 100%, 28% 98%, 26% 100%, 24% 98%, 22% 100%, 20% 98%, 18% 100%, 16% 98%, 14% 100%, 12% 98%, 10% 100%, 8% 98%, 6% 100%, 4% 98%, 2% 100%, 0% 98%)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200 p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-6xl max-h-[95vh] flex rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(255,255,255,0.2)] animate-in zoom-in-95 duration-300 border-white/5">
        
        {/* Left 56%: Checkout Summary, Methods, & Keypad */}
        <div className="w-[56%] border-r border-white/5 p-5 flex flex-col justify-between relative overflow-y-auto bg-black/35">
          <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 blur-[60px] -ml-20 -mt-20 rounded-full"></div>
          
          <div className="relative z-10 flex-1 flex flex-col gap-3.5">
            {/* Modal Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-neutral-200 drop-shadow-[0_0_8px_rgba(255, 255, 255, 0.5)]">
                <CreditCard size={22} />
                <h2 className="text-xl font-black uppercase tracking-wider">Terminal Checkout</h2>
              </div>
              <button 
                onClick={onClose} 
                className="w-8 h-8 rounded-xl glass-button flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-5 gap-2">
              {(['Cash', 'Card', 'Mobile', 'Gift Card', 'Credit / Loan'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setTenderedStr(''); }}
                  className={`py-2 rounded-xl font-bold text-[11px] transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
                    method === m
                      ? m === 'Credit / Loan'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02]'
                        : 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_15px_rgba(255, 255, 255, 0.2)] scale-[1.02]'
                      : 'glass-button text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m === 'Cash' && <DollarSign size={15} />}
                  {m === 'Card' && <CreditCard size={15} />}
                  {m === 'Mobile' && <Smartphone size={15} />}
                  {m === 'Gift Card' && <Gift size={15} />}
                  {m === 'Credit / Loan' && <BookOpen size={15} />}
                  <span>{m === 'Credit / Loan' ? 'Khata / Loan' : m}</span>
                </button>
              ))}
            </div>

            {/* Main Interactive Control Area */}
            <div className="flex-1 flex flex-col justify-center">
              {method === 'Cash' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-black/45 p-3 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cash Tendered</span>
                    <div className="text-2xl font-black text-neutral-200 font-mono tracking-wider">
                      Rs. {tenderedStr || '0.00'}
                    </div>
                  </div>

                  {/* Quick Cash row */}
                  <div className="grid grid-cols-5 gap-2">
                    {QUICK_CASH.map(amount => (
                      <button
                        key={amount}
                        onClick={() => handleQuickAdd(amount)}
                        className="py-2 rounded-lg font-black text-[10px] text-cyan-200 bg-cyan-950/40 border border-white/20 hover:bg-cyan-900/60 hover:border-cyan-400/50 transition-all shadow-md active:scale-95"
                      >
                        +Rs. {amount}
                      </button>
                    ))}
                    <button
                      onClick={() => handleQuickAdd(Math.ceil(remaining))}
                      className="py-2 rounded-lg font-black text-[10px] text-emerald-200 bg-emerald-950/40 border border-emerald-500/20 hover:bg-emerald-900/60 hover:border-emerald-400/50 transition-all shadow-md active:scale-95"
                    >
                      Exact Cash
                    </button>
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-3 grid grid-cols-3 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(num => (
                        <button
                          key={num}
                          onClick={() => handleKeypad(num.toString())}
                          className="glass-button h-10 rounded-lg text-lg font-extrabold text-white hover:text-neutral-200 transition-all"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        onClick={() => handleKeypad('C')}
                        className="glass-button h-10 rounded-lg flex items-center justify-center text-red-400"
                      >
                        <Delete size={18} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={handleAddPayment}
                      disabled={currentTenderedAmount <= 0}
                      className="col-span-1 rounded-lg bg-cyan-600/20 hover:bg-white/40 border border-white/40 text-cyan-200 font-extrabold flex flex-col items-center justify-center gap-1 transition disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                    >
                      <Plus size={18} />
                      <span className="text-[9px] uppercase tracking-wider">Add Part</span>
                    </button>
                  </div>
                </div>
              ) : method === 'Credit / Loan' ? (
                <div className="flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-200 bg-amber-950/20 border border-amber-500/20 p-3 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen size={15} />
                      Select Customer For Khata / Loan
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-200">
                      Loan Amount: Rs. {remaining.toFixed(2)}
                    </span>
                  </div>

                  {/* Customer search filter */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
                    <input 
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 glass-input rounded-xl text-xs"
                    />
                  </div>

                  {/* Customer selection list */}
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center py-3 text-xs text-gray-500">
                        No customers found. Please add customer in Customers tab first.
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <div 
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`p-2 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${
                            selectedCustomerId === c.id
                              ? 'bg-amber-500/20 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                              : 'bg-black/30 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              {c.name}
                              {selectedCustomerId === c.id && <UserCheck size={13} className="text-amber-400" />}
                            </div>
                            <div className="text-[10px] text-gray-400">{c.phone || 'No phone'}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block">Prev Udhaar</span>
                            <span className="text-xs font-mono font-black text-amber-400">
                              Rs. {(c.balance || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedCustomer && (
                    <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-amber-500/30 text-xs">
                      <span className="text-amber-200">
                        Total New Due: <strong>Rs. {((selectedCustomer.balance || 0) + remaining).toLocaleString()}</strong>
                      </span>
                      <button
                        onClick={handleAddPayment}
                        disabled={remaining <= 0}
                        className="px-4 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 text-amber-200 font-bold text-xs active:scale-95 transition"
                      >
                        Add to Udhaar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 mb-3 rounded-full glass-panel flex items-center justify-center border-white/30 shadow-[0_0_25px_rgba(255, 255, 255, 0.25)] animate-pulse">
                    {method === 'Card' && <CreditCard size={28} className="text-neutral-200" />}
                    {method === 'Mobile' && <Smartphone size={28} className="text-neutral-200" />}
                    {method === 'Gift Card' && <Gift size={28} className="text-neutral-200" />}
                  </div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-wider mb-1">Process {method}</h3>
                  <p className="text-xs text-gray-400">Total charge: <strong className="text-neutral-200 font-mono">Rs. {remaining.toFixed(2)}</strong></p>
                  
                  <button 
                    onClick={handleAddPayment}
                    disabled={remaining <= 0}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-white/20 hover:bg-white/40 border border-white/40 text-cyan-200 font-black uppercase text-xs tracking-widest shadow-md transition disabled:opacity-20 active:scale-95"
                  >
                    Confirm & Complete
                  </button>
                </div>
              )}
            </div>

            {/* Split Payments Tracker Table */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-3 flex flex-col gap-2">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Transaction Records</span>
              <div className="max-h-20 overflow-y-auto pr-1 space-y-1.5 scrollbar-none">
                {payments.length === 0 ? (
                  <div className="text-center py-1 text-xs text-gray-500 italic">No payments logged yet</div>
                ) : (
                  payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 glass-panel rounded-lg bg-white/[0.02]">
                      <div className="flex items-center gap-2 text-neutral-200 text-xs font-bold">
                        {p.method === 'Cash' && <DollarSign size={14} />}
                        {p.method === 'Card' && <CreditCard size={14} />}
                        {p.method === 'Mobile' && <Smartphone size={14} />}
                        {p.method === 'Gift Card' && <Gift size={14} />}
                        {p.method === 'Credit / Loan' && <BookOpen size={14} className="text-amber-400" />}
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
            <div className="grid grid-cols-3 gap-2.5 mt-1">
              <button 
                onClick={onClose}
                className="col-span-1 py-3 rounded-xl font-bold text-xs text-gray-400 glass-button hover:text-red-300 hover:border-red-500/20 active:scale-95"
              >
                VOID ORDER
              </button>
              
              <button
                onClick={handlePay}
                disabled={isProcessing || !isEnough}
                className="col-span-2 py-3 rounded-xl font-black text-sm text-white shadow-[0_0_20px_rgba(255, 255, 255, 0.35)] bg-gradient-to-r from-neutral-200 to-neutral-500 hover:from-neutral-200 hover:to-neutral-500 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:shadow-none transition-all flex justify-center items-center gap-2 relative overflow-hidden group active:scale-95"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none"></div>
                {isProcessing ? (
                  <span className="relative z-10 tracking-widest animate-pulse uppercase">PROCESSING...</span>
                ) : (
                  <span className="relative z-10 tracking-widest uppercase flex items-center gap-1.5">
                    <CheckCircle size={16} /> {isEnough ? 'CONFIRM PAY' : `NEED Rs. ${remaining.toFixed(2)}`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 44%: Cybernetic Thermal Receipt Viewer */}
        <div className="w-[44%] bg-[#090b11] p-6 flex flex-col justify-between items-center relative overflow-y-auto">
          {/* Virtual Printer Slot Cover */}
          <div className="w-full bg-[#1b1e2a] h-3.5 rounded-full border border-white/10 relative z-20 flex justify-center items-center shadow-md shrink-0">
            <div className="w-[90%] bg-black h-1 rounded-full relative overflow-hidden">
              <div className="absolute inset-x-0 h-[2px] bg-neutral-400"></div>
            </div>
          </div>

          {/* Thermal Receipt Body */}
          <div 
            style={{ clipPath: receiptClipPath }}
            className="flex-1 w-full max-w-[320px] bg-[#f8f9fa] text-gray-800 p-4 mt-2 shadow-md relative flex flex-col justify-between select-none border-t-4 border-white/80 min-h-[380px] overflow-hidden"
          >
            
            {/* Header */}
            <div className="text-center font-mono border-b border-gray-400 pb-2 flex flex-col items-center">
              <span className="font-black text-sm text-gray-900 tracking-wider">SS MART</span>
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
            <div className="font-mono text-[8px] border-b border-gray-400 py-1 grid grid-cols-6 font-bold text-gray-900 text-right">
              <span className="col-span-2 text-left">Description</span>
              <span>O.Price</span>
              <span>Disc%</span>
              <span>Qty</span>
              <span>Amount</span>
            </div>

            {/* Cart Items List */}
            <div className="font-mono text-[8px] flex-1 py-1 overflow-y-auto border-b border-gray-400 scrollbar-none max-h-48 divide-y divide-gray-200">
              {items && items.map((item, idx) => {
                const itemDiscPercent = discount > 0 && subtotal > 0 ? (discount / subtotal) * 100 : 0;
                const finalPrice = item.price * (1 - itemDiscPercent / 100);
                return (
                  <div key={idx} className="py-1">
                    <div className="font-bold text-gray-900 leading-tight mb-0.5">{item.name}</div>
                    <div className="grid grid-cols-6 text-right text-gray-700">
                      <span className="col-span-2"></span>
                      <span>{item.price.toFixed(2)}</span>
                      <span>{itemDiscPercent > 0 ? itemDiscPercent.toFixed(1) + '%' : '0.0%'}</span>
                      <span>{item.qty}</span>
                      <span className="font-bold text-gray-900">{(finalPrice * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sub Total / Totals */}
            <div className="font-mono text-[8px] py-1 border-b border-gray-400 flex flex-col gap-0.5">
              <div className="flex justify-between font-bold text-gray-900">
                <span>Sub Total {subtotal.toFixed(2)}</span>
                <span>{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-800">
                <span>Cash Received</span>
                <span>{(currentTenderedAmount > 0 ? Math.max(totalPaid + currentTenderedAmount, totalPaid) : totalPaid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-800">
                <span>Balance</span>
                <span>{change.toFixed(2)}</span>
              </div>
            </div>

            {/* Discount Box */}
            {discount > 0 && (
              <div className="font-mono text-[8px] my-1 py-1 border-y border-gray-900 bg-gray-200 flex justify-between font-bold px-2 text-gray-900">
                <span>Total Discount</span>
                <span>{discount.toFixed(2)}</span>
              </div>
            )}

            {/* Note & Footer */}
            <div className="text-center font-mono text-[7px] pt-1 text-gray-600 flex flex-col items-center leading-tight">
              <span className="font-bold text-gray-900 tracking-wider mt-1">THANKS FOR YOUR VISIT</span>
              <span className="text-[6px] text-gray-500 mt-0.5">Software Developed By: SSQ</span>
            </div>
          </div>

          {/* Quick thermal print status banner & Print Receipt Trigger */}
          <div className="w-full flex items-center justify-between gap-2 relative z-20 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest text-neutral-200 border border-white/30 bg-cyan-950/20 uppercase shadow-[0_0_12px_rgba(255,255,255,0.15)] select-none">
              <Printer size={10} className="animate-bounce text-cyan-400" /> Receipt Preview
            </span>
            <button
              onClick={() => {
                if (window.api && window.api.printReceipt) {
                  window.api.printReceipt({
                    items,
                    paymentData: {
                      subtotal,
                      tax,
                      discount,
                      total,
                      payments: payments.length > 0 ? payments : [{ method, amount: currentTenderedAmount }],
                      change
                    },
                    saleId: nextSaleId
                  });
                } else {
                  window.print();
                }
              }}
              className="px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold text-white bg-white/20 hover:bg-white/30 border border-white/40 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 uppercase tracking-wider"
            >
              <Printer size={12} /> Print Receipt
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

