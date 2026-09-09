import React, { useState, useEffect } from 'react';
import { PaymentData, PaymentEntry, CartItem, Customer } from '../types';
import { X, DollarSign, CreditCard, Smartphone, Gift, CheckCircle, Delete, Plus, Printer, BookOpen, UserCheck, Search } from 'lucide-react';

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
      
      // If user is typing in a search or text input field, don't hijack alphanumeric keys
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isEnough) {
          handlePay();
        }
      } else if (method === 'Cash' && !isInputFocused) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 overflow-y-auto">
      <div className="enterprise-card w-full max-w-6xl max-h-[95vh] flex rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border-slate-700">
        
        {/* Left 56%: Checkout Summary, Methods, & Keypad */}
        <div className="w-[56%] border-r border-slate-800 p-5 flex flex-col justify-between relative overflow-y-auto bg-slate-900/90">
          
          <div className="relative z-10 flex-1 flex flex-col gap-3.5">
            {/* Modal Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-white">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">TERMINAL SETTLEMENT</h2>
                  <p className="text-[11px] text-slate-400 font-mono">Sale Order ID: #{nextSaleId}</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-5 gap-1.5">
              {(['Cash', 'Card', 'Mobile', 'Gift Card', 'Credit / Loan'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setTenderedStr(''); }}
                  className={`py-2 px-1 rounded-lg font-medium text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    method === m
                      ? m === 'Credit / Loan'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                        : 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {m === 'Cash' && <DollarSign size={14} />}
                  {m === 'Card' && <CreditCard size={14} />}
                  {m === 'Mobile' && <Smartphone size={14} />}
                  {m === 'Gift Card' && <Gift size={14} />}
                  {m === 'Credit / Loan' && <BookOpen size={14} />}
                  <span className="text-[10px]">{m === 'Credit / Loan' ? 'Khata/Loan' : m}</span>
                </button>
              ))}
            </div>

            {/* Main Interactive Control Area */}
            <div className="flex-1 flex flex-col justify-center">
              {method === 'Cash' ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cash Tendered</span>
                    <div className="text-2xl font-bold text-white font-mono tabular-nums tracking-tight">
                      Rs. {tenderedStr || '0.00'}
                    </div>
                  </div>

                  {/* Quick Cash row */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {QUICK_CASH.map(amount => (
                      <button
                        key={amount}
                        onClick={() => handleQuickAdd(amount)}
                        className="py-2 rounded-lg font-mono tabular-nums text-xs font-semibold text-slate-200 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        +Rs. {amount}
                      </button>
                    ))}
                    <button
                      onClick={() => handleQuickAdd(Math.ceil(remaining))}
                      className="py-2 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer"
                    >
                      Exact Cash
                    </button>
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="col-span-3 grid grid-cols-3 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(num => (
                        <button
                          key={num}
                          onClick={() => handleKeypad(num.toString())}
                          className="h-10 rounded-lg text-base font-mono font-bold text-slate-100 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        onClick={() => handleKeypad('C')}
                        className="h-10 rounded-lg flex items-center justify-center text-rose-400 bg-slate-800/80 border border-slate-700 hover:bg-rose-500/20 transition-all cursor-pointer"
                      >
                        <Delete size={16} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={handleAddPayment}
                      disabled={currentTenderedAmount <= 0}
                      className="col-span-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 font-semibold flex flex-col items-center justify-center gap-1 transition disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer"
                    >
                      <Plus size={16} />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Split Add</span>
                    </button>
                  </div>
                </div>
              ) : method === 'Credit / Loan' ? (
                <div className="flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen size={14} />
                      Select Customer For Khata / Loan
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold text-amber-200">
                      Amount: Rs. {remaining.toFixed(2)}
                    </span>
                  </div>

                  {/* Customer search filter */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={13} />
                    <input 
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 glass-input rounded-lg text-xs"
                    />
                  </div>

                  {/* Customer selection list */}
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center py-3 text-xs text-slate-500">
                        No customers found. Please add customer in Customers tab first.
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <div 
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`p-2 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${
                            selectedCustomerId === c.id
                              ? 'bg-amber-500/20 border-amber-500/60'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                              {c.name}
                              {selectedCustomerId === c.id && <UserCheck size={13} className="text-amber-400" />}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.phone || 'No phone'}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Prev Udhaar</span>
                            <span className="text-xs font-mono tabular-nums font-bold text-amber-400">
                              Rs. {(c.balance || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedCustomer && (
                    <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-amber-500/30 text-xs">
                      <span className="text-amber-200">
                        Total New Due: <strong className="font-mono tabular-nums">Rs. {((selectedCustomer.balance || 0) + remaining).toLocaleString()}</strong>
                      </span>
                      <button
                        onClick={handleAddPayment}
                        disabled={remaining <= 0}
                        className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-xs active:scale-95 transition cursor-pointer"
                      >
                        Add to Udhaar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="w-14 h-14 mb-2.5 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    {method === 'Card' && <CreditCard size={24} />}
                    {method === 'Mobile' && <Smartphone size={24} />}
                    {method === 'Gift Card' && <Gift size={24} />}
                  </div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-0.5">Process {method}</h3>
                  <p className="text-xs text-slate-400">Tender charge: <strong className="text-white font-mono tabular-nums">Rs. {remaining.toFixed(2)}</strong></p>
                  
                  <button 
                    onClick={handleAddPayment}
                    disabled={remaining <= 0}
                    className="mt-3 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wider transition disabled:opacity-40 active:scale-95 cursor-pointer shadow-sm"
                  >
                    Confirm & Complete
                  </button>
                </div>
              )}
            </div>

            {/* Split Payments Tracker Table */}
            <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-2.5 flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Settled Splits</span>
              <div className="max-h-20 overflow-y-auto pr-1 space-y-1 scrollbar-none">
                {payments.length === 0 ? (
                  <div className="text-center py-1 text-xs text-slate-500 italic">No payments logged yet</div>
                ) : (
                  payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
                        {p.method === 'Cash' && <DollarSign size={13} />}
                        {p.method === 'Card' && <CreditCard size={13} />}
                        {p.method === 'Mobile' && <Smartphone size={13} />}
                        {p.method === 'Gift Card' && <Gift size={13} />}
                        {p.method === 'Credit / Loan' && <BookOpen size={13} className="text-amber-400" />}
                        <span>{p.method}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-white font-mono tabular-nums font-bold">Rs. {p.amount.toFixed(2)}</span>
                        <button onClick={() => removePayment(idx)} className="text-rose-400 hover:text-rose-300 transition cursor-pointer">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Action buttons row */}
            <div className="grid grid-cols-3 gap-2 mt-1">
              <button 
                onClick={onClose}
                className="col-span-1 py-2.5 rounded-lg font-medium text-xs text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
              >
                CANCEL (Esc)
              </button>
              
              <button
                onClick={handlePay}
                disabled={isProcessing || !isEnough}
                className="col-span-2 py-2.5 rounded-lg font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 transition-all flex justify-center items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
              >
                {isProcessing ? (
                  <span className="tracking-widest animate-pulse uppercase">PROCESSING...</span>
                ) : (
                  <span className="tracking-wider uppercase flex items-center gap-1.5">
                    <CheckCircle size={15} /> {isEnough ? 'COMPLETE TRANSACTION (Enter)' : `NEED Rs. ${remaining.toFixed(2)}`}
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 border border-slate-800 bg-slate-900/80 uppercase select-none">
              <Printer size={11} className="text-indigo-400" /> Thermal Preview
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
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <Printer size={13} /> Print Bill
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

