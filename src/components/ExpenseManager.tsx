import React, { useState, useEffect } from 'react';
import { Expense } from '../types';
import { DollarSign, Receipt, Calendar, User, PlusCircle, Trash2, Search, Filter, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ExpenseManagerProps {
  currentUser: { id: number; name: string; role: string } | null;
}

const CATEGORIES = [
  'Utilities & Bills',
  'Staff Tea & Food',
  'Store Maintenance',
  'Cash Withdrawals',
  'Inventory logistics',
  'Others'
];

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({ currentUser }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadExpenses = async () => {
    try {
      const data = await window.api.getAllExpenses();
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a brief description of the expense.');
      return;
    }

    const loggedBy = currentUser?.name || 'System Cashier';

    try {
      const res = await window.api.addExpense({
        amount: expenseAmount,
        description: description.trim(),
        category,
        loggedBy
      });

      if (res) {
        setSuccess(`Rs. ${expenseAmount.toFixed(2)} logged successfully under "${category}"`);
        setAmount('');
        setDescription('');
        setCategory(CATEGORIES[0]);
        await loadExpenses();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to record expense.');
    }
  };

  const handleDelete = async (id: number, amt: number) => {
    if (currentUser?.role === 'Cashier') {
      setError('Unauthorized: Only Managers and Admins can delete logged expenses.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the expense entry of Rs. ${amt.toFixed(2)}?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const successVal = await window.api.deleteExpense(id);
      if (successVal) {
        setSuccess('Expense entry successfully deleted from register ledger.');
        await loadExpenses();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense.');
    }
  };

  // Filter Logic
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.logged_by.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = filterCategory === 'All' || exp.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = new Date().toISOString().substring(0, 7); // 'YYYY-MM'

  const todayExpensesSum = expenses
    .filter(exp => exp.timestamp.startsWith(todayStr))
    .reduce((sum, exp) => sum + exp.amount, 0);

  const monthExpensesSum = expenses
    .filter(exp => exp.timestamp.substring(0, 7) === thisMonthStr)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const totalExpensesSum = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Helper for Category neon pills styling
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Utilities & Bills':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Staff Tea & Food':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'Store Maintenance':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'Cash Withdrawals':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'Inventory logistics':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-200 p-4 font-outfit">
      
      {/* Metrics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Today's Expenses</span>
            <span className="text-2xl font-black text-white">Rs. {todayExpensesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Receipt size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">This Month's Expenses</span>
            <span className="text-2xl font-black text-white">Rs. {monthExpensesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <PlusCircle size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Total Recorded Expenses</span>
            <span className="text-2xl font-black text-white">Rs. {totalExpensesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Log Expense Form Card */}
        <div className="lg:col-span-1 glass-panel rounded-3xl p-6 border-white/5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] -mr-10 -mt-10 rounded-full"></div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                <Sparkles className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">Record Mart Expense</h2>
                <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-0.5">Logs outflow from register</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-top-2">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-top-2">
                <CheckCircle2 size={14} />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Amount (Rs.)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 font-bold">
                    Rs.
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full glass-input block pl-12 p-3.5 font-mono text-base font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Expense Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full glass-input block p-3.5 text-sm font-semibold"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-slate-900 text-white font-semibold">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Description / Reason</label>
                <textarea
                  placeholder="e.g. Brought tea & snacks for morning shifts, Purchased floor cleaners, Petty cash taken by manager..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  className="w-full glass-input block p-3.5 text-xs leading-relaxed"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(0,240,255,0.25)] flex items-center justify-center gap-2 group"
                >
                  <PlusCircle size={16} />
                  Record Expense
                </button>
              </div>
            </form>
          </div>

          <div className="border-t border-white/5 pt-4 mt-6 text-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Active Logger: <span className="text-gray-300">{currentUser?.name} ({currentUser?.role})</span>
            </span>
          </div>
        </div>

        {/* Ledger logs viewer list */}
        <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col border-white/5 shadow-2xl relative">
          <header className="p-5 border-b border-white/5 bg-black/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Expense Outflow Ledger</h2>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-0.5">{filteredExpenses.length} Records Loaded</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group w-48 flex-1 md:flex-initial">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full glass-input pl-10 p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-xl p-1 shrink-0">
                <Filter size={12} className="text-gray-400 ml-1.5" />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-transparent text-gray-300 font-bold text-[10px] border-none focus:outline-none pr-3 cursor-pointer py-1"
                >
                  <option value="All" className="bg-slate-900 text-white font-bold">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-slate-900 text-white font-bold">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-black/40 backdrop-blur-md z-10">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-white/5">
                  <th className="p-4 pl-6">Category</th>
                  <th className="p-4">Description</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4">Logged By</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4 pr-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors text-xs group">
                    <td className="p-4 pl-6 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-gray-200 max-w-[200px] truncate leading-relaxed" title={exp.description}>
                      {exp.description}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-rose-400">
                      Rs. {exp.amount.toFixed(2)}
                    </td>
                    <td className="p-4 font-medium text-gray-300 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <User size={12} className="text-gray-500" />
                        {exp.logged_by}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 whitespace-nowrap font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-500" />
                        {new Date(exp.timestamp.replace(' ', 'T')).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <button
                        onClick={() => handleDelete(exp.id, exp.amount)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 hover:border-red-500/40 opacity-40 hover:opacity-100 transition-all flex items-center justify-center mx-auto"
                        title={currentUser?.role === 'Cashier' ? 'Cashiers cannot delete entries' : 'Delete entry'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-500 font-medium">
                      No expense logs matching filters found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
