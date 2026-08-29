import React, { useState, useEffect } from 'react';
import { Customer, CustomerKhataEntry } from '../types';
import { Search, Edit2, Trash2, Award, UserPlus, Phone, Mail, BookOpen, CreditCard, Send, PlusCircle, CheckCircle2, History, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Khata / Loan Ledger Modal State
  const [selectedCustomerForKhata, setSelectedCustomerForKhata] = useState<Customer | null>(null);
  const [khataEntries, setKhataEntries] = useState<CustomerKhataEntry[]>([]);
  const [isPayLoanModalOpen, setIsPayLoanModalOpen] = useState(false);
  const [isAddLoanModalOpen, setIsAddLoanModalOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [loanPayMethod, setLoanPayMethod] = useState('Cash');

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [points, setPoints] = useState(0);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await window.api.getAllCustomers();
      setCustomers(data);
      if (selectedCustomerForKhata) {
        const updated = data.find(c => c.id === selectedCustomerForKhata.id);
        if (updated) {
          setSelectedCustomerForKhata(updated);
          loadCustomerKhata(updated.id);
        }
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadCustomerKhata = async (customerId: number) => {
    try {
      const entries = await window.api.getCustomerKhata(customerId);
      setKhataEntries(entries);
    } catch (err) {
      console.error('Failed to load customer khata:', err);
    }
  };

  const handleOpenKhata = (customer: Customer) => {
    setSelectedCustomerForKhata(customer);
    loadCustomerKhata(customer.id);
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setPoints(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setPoints(customer.points);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await window.api.updateCustomer(editingCustomer.id, { name, phone, email, points });
      } else {
        await window.api.addCustomer({ name, phone, email, points, balance: 0 });
      }
      setIsModalOpen(false);
      loadCustomers();
    } catch (err) {
      console.error('Failed to save customer:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this customer profile and their khata history?')) {
      await window.api.deleteCustomer(id);
      loadCustomers();
    }
  };

  const handleClearAllKhata = async () => {
    if (window.confirm('Are you sure you want to clear all Khata records and reset all customer balances to Rs. 0 in local & cloud database? This cannot be undone.')) {
      try {
        await window.api.clearAllKhata();
        await loadCustomers();
        if (selectedCustomerForKhata) {
          loadCustomerKhata(selectedCustomerForKhata.id);
        }
      } catch (err) {
        console.error('Failed to clear khata:', err);
      }
    }
  };

  const handlePayLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForKhata) return;
    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      await window.api.addCustomerLoanPayment({
        customerId: selectedCustomerForKhata.id,
        amount: amt,
        paymentMethod: loanPayMethod,
        notes: loanNotes.trim() || 'Udhaar Repayment'
      });
      setIsPayLoanModalOpen(false);
      setLoanAmount('');
      setLoanNotes('');
      await loadCustomers();
    } catch (err) {
      console.error('Failed to record loan payment:', err);
    }
  };

  const handleAddLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForKhata) return;
    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      await window.api.addCustomerLoanEntry({
        customerId: selectedCustomerForKhata.id,
        amount: amt,
        notes: loanNotes.trim() || 'Manual Credit / Loan Taken'
      });
      setIsAddLoanModalOpen(false);
      setLoanAmount('');
      setLoanNotes('');
      await loadCustomers();
    } catch (err) {
      console.error('Failed to add loan entry:', err);
    }
  };

  // 1-Click WhatsApp Ledger / Statement sender for Customer Loan
  const sendCustomerWhatsAppStatement = (customer: Customer, entries: CustomerKhataEntry[]) => {
    let cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10) {
      cleanPhone = '92' + cleanPhone;
    }

    const todayStr = new Date().toLocaleDateString('en-PK', { dateStyle: 'medium' });
    const currentBalance = customer.balance || 0;

    let message = `🏪 *SS MART & GENERAL STORE*\n`;
    message += `📋 *CUSTOMER UDHAAR / LOAN STATEMENT*\n`;
    message += `──────────────────────\n`;
    message += `👤 *Customer:* ${customer.name}\n`;
    message += `📱 *Phone:* ${customer.phone || 'N/A'}\n`;
    message += `📅 *Date:* ${todayStr}\n`;
    message += `──────────────────────\n`;
    message += `💰 *TOTAL OUTSTANDING DUE (UDHAAR): Rs. ${currentBalance.toLocaleString()}*\n\n`;

    if (entries.length > 0) {
      message += `📜 *Recent Transaction History:*\n`;
      const recent = entries.slice(0, 8);
      recent.forEach((item, idx) => {
        const itemDate = new Date(item.timestamp).toLocaleDateString();
        if (item.type === 'LOAN') {
          message += `🔺 *[CREDIT / LOAN]* ${itemDate}: +Rs. ${item.amount.toLocaleString()} (${item.notes || 'Purchased on Credit'})\n`;
        } else {
          message += `🟢 *[REPAID / WASOOL]* ${itemDate}: -Rs. ${item.amount.toLocaleString()} (${item.payment_method || 'Cash'})\n`;
        }
      });
    }

    message += `\n──────────────────────\n`;
    message += `🙏 *Thank you for your valued business!*\n`;
    message += `For any inquiries, contact SS Mart.`;

    // Attempt silent direct Meta WhatsApp Cloud API send first
    window.api.sendWhatsAppMessage(cleanPhone, message).then((res) => {
      if (res.success) {
        alert(`✅ WhatsApp Statement sent silently & automatically to ${customer.name} (${customer.phone})!`);
      } else {
        // If Meta Cloud API credentials are not set up, seamlessly open wa.me as fallback
        const encoded = encodeURIComponent(message);
        const waUrl = cleanPhone 
          ? `https://wa.me/${cleanPhone}?text=${encoded}`
          : `https://wa.me/?text=${encoded}`;

        window.open(waUrl, '_blank');
      }
    }).catch(() => {
      const encoded = encodeURIComponent(message);
      const waUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;

      window.open(waUrl, '_blank');
    });
  };

  const totalOutstandingUdhaar = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255, 255, 255, 0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 blur-[100px] -mr-40 -mt-40 rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 blur-[100px] -ml-40 -mb-40 rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <BookOpen className="text-amber-400 drop-shadow-[0_0_8px_rgba(245, 158, 11, 0.4)]" size={32} />
              Customer CRM & Khata (Udhaar) Register
            </h2>
            <p className="text-gray-400 mt-1">Manage customer loans, credit records, repayments, and automated WhatsApp statements.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-right">
              <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">Total Outstanding Udhaar</span>
              <span className="text-lg font-black text-amber-400 font-mono">Rs. {totalOutstandingUdhaar.toLocaleString()}</span>
            </div>

            <button
              onClick={handleClearAllKhata}
              className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95 text-sm"
              title="Reset all customer Khata loan/payment transactions and zero balances"
            >
              <Trash2 size={16} /> Reset Khata
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-5 py-3 bg-gradient-to-r from-neutral-200 to-neutral-400 hover:from-neutral-100 hover:to-neutral-300 text-black font-bold rounded-xl transition flex items-center gap-2 shadow-[0_0_20px_rgba(255, 255, 255, 0.3)] cursor-pointer active:scale-95"
            >
              <UserPlus size={18} /> Add Customer
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl text-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-200" size={20} />
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-neutral-200 font-bold text-xs tracking-wider uppercase">
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Contact</th>
                <th className="py-4 px-4 text-center">Khata / Loan Balance (Udhaar)</th>
                <th className="py-4 px-4 text-center">Loyalty Points</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="font-extrabold text-white text-base">{c.name}</div>
                    <div className="text-xs text-neutral-400">Customer ID: #{c.id}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1">
                      {c.phone ? (
                        <span className="text-gray-300 text-sm flex items-center gap-1.5 font-mono">
                          <Phone size={12} className="text-neutral-400" /> {c.phone}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs italic">No phone registered</span>
                      )}
                      {c.email && <span className="text-gray-400 text-xs flex items-center gap-1.5"><Mail size={12} className="text-neutral-400" /> {c.email}</span>}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {(c.balance || 0) > 0 ? (
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full font-black text-sm font-mono">
                          Rs. {(c.balance || 0).toLocaleString()} Due
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-bold uppercase tracking-widest">Udhaar Pending</span>
                      </div>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-bold text-xs">
                        ✓ Clear (Rs. 0)
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/30 text-neutral-200 rounded-full font-bold text-xs">
                      <Award size={14} /> {c.points} pts
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        onClick={() => handleOpenKhata(c)}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                        title="View Full Khata Ledger & Send WhatsApp Statement"
                      >
                        <BookOpen size={14} />
                        <span>Khata / Ledger</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-2 text-neutral-200 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition cursor-pointer"
                        title="Edit profile"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition cursor-pointer"
                        title="Delete profile"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No customers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Full Khata / Loan Ledger Modal */}
      {selectedCustomerForKhata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] p-6 md:p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-4 flex-shrink-0 pb-4 border-b border-white/5">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">Customer Khata Ledger</span>
                <h3 className="text-2xl font-extrabold text-white mt-0.5">{selectedCustomerForKhata.name}</h3>
                <span className="text-xs text-gray-400 font-mono">Phone: {selectedCustomerForKhata.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendCustomerWhatsAppStatement(selectedCustomerForKhata, khataEntries)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition cursor-pointer active:scale-95"
                  title="Automate send ledger statement to Customer on WhatsApp"
                >
                  <Send size={14} />
                  <span>WhatsApp Statement</span>
                </button>
                <button
                  onClick={() => setSelectedCustomerForKhata(null)}
                  className="p-2 text-gray-400 hover:text-white glass-button rounded-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Khata Balance Summary Card */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-black/40 rounded-2xl border border-amber-500/20 mb-4 flex-shrink-0">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Current Loan (Udhaar)</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  Rs. {(selectedCustomerForKhata.balance || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Total Transactions</span>
                <span className="text-xl font-black text-white font-mono">{khataEntries.length}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setLoanAmount(''); setLoanNotes(''); setIsPayLoanModalOpen(true); }}
                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer active:scale-95"
                >
                  <ArrowDownLeft size={14} /> Pay / Wasool
                </button>
                <button
                  onClick={() => { setLoanAmount(''); setLoanNotes(''); setIsAddLoanModalOpen(true); }}
                  className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer active:scale-95"
                >
                  <ArrowUpRight size={14} /> Add Loan
                </button>
              </div>
            </div>

            {/* Khata Entries List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <History size={14} className="text-cyan-400" />
                Ledger Transaction History
              </h4>

              {khataEntries.length === 0 ? (
                <div className="p-8 bg-white/5 rounded-2xl text-center text-xs text-gray-500">
                  No Khata transactions logged yet for this customer.
                </div>
              ) : (
                khataEntries.map((entry) => (
                  <div 
                    key={entry.id}
                    className={`p-3.5 rounded-xl border flex justify-between items-center text-xs transition ${
                      entry.type === 'LOAN'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black uppercase tracking-wider text-[11px] px-2 py-0.5 rounded-md ${
                          entry.type === 'LOAN'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {entry.type === 'LOAN' ? '🔺 Borrowed / Sale on Credit' : '🟢 Repayment / Wasool'}
                        </span>
                        <span className="text-gray-400 text-[10px]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-gray-300 mt-1 font-medium">
                        {entry.notes || (entry.type === 'LOAN' ? 'Goods taken on credit' : 'Loan repayment')}
                        {entry.payment_method && <span className="text-gray-500 text-[11px]"> • Via {entry.payment_method}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-black font-mono ${
                        entry.type === 'LOAN' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {entry.type === 'LOAN' ? '+' : '-'}Rs. {entry.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-white/5 flex justify-between items-center flex-shrink-0 mt-4">
              <button
                onClick={() => sendCustomerWhatsAppStatement(selectedCustomerForKhata, khataEntries)}
                className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send size={13} /> Send Ledger to WhatsApp
              </button>
              <button
                onClick={() => setSelectedCustomerForKhata(null)}
                className="px-6 py-2 glass-button rounded-xl font-bold text-xs text-white cursor-pointer"
              >
                Close Ledger
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Pay Loan / Repayment Wasool Modal */}
      {isPayLoanModalOpen && selectedCustomerForKhata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-emerald-500/30 shadow-2xl relative">
            <h3 className="text-xl font-black text-emerald-400 mb-1 flex items-center gap-2">
              <ArrowDownLeft size={20} />
              Receive Loan Repayment (Wasool)
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Customer: <strong className="text-white">{selectedCustomerForKhata.name}</strong> • Current Due: <strong className="text-amber-400 font-mono">Rs. {(selectedCustomerForKhata.balance || 0).toLocaleString()}</strong>
            </p>

            <form onSubmit={handlePayLoanSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Repayment Amount (Rs.)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-lg font-mono font-bold text-emerald-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Payment Method</label>
                <select
                  value={loanPayMethod}
                  onChange={e => setLoanPayMethod(e.target.value)}
                  className="w-full px-4 py-2.5 glass-input rounded-xl text-xs font-bold"
                >
                  <option value="Cash" className="bg-slate-900 text-white">Cash</option>
                  <option value="Bank Transfer" className="bg-slate-900 text-white">Bank Transfer / Online</option>
                  <option value="JazzCash / EasyPaisa" className="bg-slate-900 text-white">JazzCash / EasyPaisa</option>
                  <option value="Card" className="bg-slate-900 text-white">Card</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Notes / Remarks</label>
                <input 
                  type="text"
                  placeholder="e.g. Partial cash payment received"
                  value={loanNotes}
                  onChange={e => setLoanNotes(e.target.value)}
                  className="w-full px-4 py-2.5 glass-input rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayLoanModalOpen(false)}
                  className="px-4 py-2.5 glass-button rounded-xl text-xs font-bold text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg cursor-pointer active:scale-95"
                >
                  Save Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Loan Modal */}
      {isAddLoanModalOpen && selectedCustomerForKhata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-amber-500/30 shadow-2xl relative">
            <h3 className="text-xl font-black text-amber-400 mb-1 flex items-center gap-2">
              <ArrowUpRight size={20} />
              Add Loan (Udhaar)
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Customer: <strong className="text-white">{selectedCustomerForKhata.name}</strong> • Current Due: <strong className="text-amber-400 font-mono">Rs. {(selectedCustomerForKhata.balance || 0).toLocaleString()}</strong>
            </p>

            <form onSubmit={handleAddLoanSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Loan Amount (Rs.)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-lg font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Reason / Item Description</label>
                <input 
                  type="text"
                  placeholder="e.g. 5kg Rice and Ghee taken on credit"
                  value={loanNotes}
                  onChange={e => setLoanNotes(e.target.value)}
                  className="w-full px-4 py-2.5 glass-input rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLoanModalOpen(false)}
                  className="px-4 py-2.5 glass-button rounded-xl text-xs font-bold text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs shadow-lg cursor-pointer active:scale-95"
                >
                  Add to Khata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Award className="text-neutral-200" />
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. Muhammad Ali"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">WhatsApp / Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. 03001234567"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. customer@gmail.com"
                />
              </div>

              {editingCustomer && (
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Loyalty Points</label>
                  <input
                    type="number"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 glass-button rounded-xl font-bold text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-neutral-200 to-neutral-400 hover:from-neutral-100 hover:to-neutral-300 text-black rounded-xl font-bold shadow-lg cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
