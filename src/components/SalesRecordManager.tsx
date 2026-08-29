import React, { useState, useEffect } from 'react';
import { Sale, SaleItemDetails } from '../types';
import { Search, Receipt, Calendar, User, Undo2, CheckCircle, Ban, ArrowRightLeft, DollarSign, X, ShoppingBag } from 'lucide-react';

export const SalesRecordManager: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // Custom return quantities per product ID for the currently open modal
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: number]: number }>({});
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSales = async () => {
    try {
      const data = await window.api.getAllSales();
      setSales(data);
      
      // Update currently selected sale in modal if it's open to refresh details
      if (selectedSale) {
        const updated = data.find(s => s.id === selectedSale.id);
        if (updated) setSelectedSale(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const handleOpenSaleDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setError(null);
    setSuccess(null);
    
    // Reset return quantity inputs
    const initialQtys: { [productId: number]: number } = {};
    if (sale.items) {
      sale.items.forEach(item => {
        const maxReturn = item.qty - item.returned_qty;
        initialQtys[item.product_id] = maxReturn > 0 ? 1 : 0;
      });
    }
    setReturnQuantities(initialQtys);
  };

  const handleQtyChange = (productId: number, val: number, max: number) => {
    setReturnQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, Math.min(max, val))
    }));
  };

  const handleReturnItem = async (productId: number) => {
    if (!selectedSale) return;
    setError(null);
    setSuccess(null);

    const qty = returnQuantities[productId] || 0;
    if (qty <= 0) return;

    try {
      const returnsList = [{ productId, qtyToReturn: qty }];
      const res = await window.api.returnSaleItems(selectedSale.id, returnsList);
      if (res) {
        setSuccess(`Successfully returned ${qty} unit(s) of product.`);
        await loadSales();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process return.');
    }
  };

  const handleReturnAll = async () => {
    if (!selectedSale || !selectedSale.items) return;
    if (!window.confirm('Are you sure you want to return the remaining items on this order?')) return;
    
    setError(null);
    setSuccess(null);

    const returnsList = selectedSale.items
      .map(item => ({
        productId: item.product_id,
        qtyToReturn: item.qty - item.returned_qty
      }))
      .filter(item => item.qtyToReturn > 0);

    if (returnsList.length === 0) {
      setError('No items remaining to return.');
      return;
    }

    try {
      const res = await window.api.returnSaleItems(selectedSale.id, returnsList);
      if (res) {
        setSuccess('Successfully returned entire remaining order.');
        await loadSales();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process return.');
    }
  };

  // Filter sales
  const filteredSales = sales.filter(s => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      s.id.toString().includes(query) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(query)) ||
      s.payment_method.toLowerCase().includes(query);

    const matchesStatus = 
      statusFilter === 'All' || 
      s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalSalesCount = sales.length;
  const totalGrossRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalRefunds = sales.reduce((sum, s) => sum + (s.refund_amount || 0), 0);
  const netRevenue = totalGrossRevenue - totalRefunds;

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-200 font-outfit overflow-hidden">
      
      {/* Top statistics banners */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 flex-shrink-0">
        <div className="glass-panel p-3.5 rounded-2xl flex items-center gap-3 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/30 flex items-center justify-center text-neutral-200">
            <Receipt size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Total Sales</span>
            <span className="text-2xl font-black text-white">{totalSalesCount} Orders</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-emerald-500/30 flex items-center justify-center text-neutral-200">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Gross Revenue</span>
            <span className="text-2xl font-black text-white">Rs. {totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <Undo2 size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Refunded Amount</span>
            <span className="text-2xl font-black text-white">Rs. {totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-[30px] rounded-full -mr-6 -mt-6"></div>
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/30 flex items-center justify-center text-neutral-300">
            <ShoppingBag size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Net Revenue</span>
            <span className="text-2xl font-black text-white">Rs. {netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-3xl overflow-hidden flex flex-col relative z-10 border-white/5 shadow-2xl">
        <header className="p-6 border-b border-white/5 bg-black/20 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-500 flex items-center justify-center shadow-[0_0_20px_rgba(255, 255, 255, 0.3)]">
              <ArrowRightLeft className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">SALES RECORDS</h1>
              <p className="text-xs text-neutral-200 font-bold uppercase tracking-widest mt-1">{filteredSales.length} Transactions Found</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group w-72">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-neutral-200 transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Search Sale ID, Cashier, Method..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full glass-input rounded-xl block pl-12 p-3"
              />
            </div>

            <div className="flex gap-1.5 bg-black/40 border border-white/5 rounded-xl p-1">
              {['All', 'Completed', 'Partially Returned', 'Returned'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === status
                      ? 'bg-white/20 text-neutral-200 border border-white/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-black/40 backdrop-blur-md z-10 shadow-md">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="p-5 pl-8 border-b border-white/5">Order ID</th>
                <th className="p-5 border-b border-white/5">Timestamp</th>
                <th className="p-5 border-b border-white/5">Cashier</th>
                <th className="p-5 border-b border-white/5">Payment Method</th>
                <th className="p-5 text-right border-b border-white/5">Original Total</th>
                <th className="p-5 text-right border-b border-white/5">Refunded</th>
                <th className="p-5 border-b border-white/5 text-center">Status</th>
                <th className="p-5 pr-8 text-center border-b border-white/5">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSales.map(s => (
                <tr 
                  key={s.id} 
                  onClick={() => handleOpenSaleDetails(s)}
                  className="hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <td className="p-5 pl-8 font-black text-neutral-200 tracking-wider">#{s.id}</td>
                  <td className="p-5 font-medium text-gray-300">
                    <span className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-500" />
                      {new Date(s.timestamp.replace(' ', 'T')).toLocaleString()}
                    </span>
                  </td>
                  <td className="p-5 font-semibold text-gray-200">
                    <span className="flex items-center gap-2">
                      <User size={14} className="text-gray-500" />
                      {s.cashier_name || 'System Cashier'}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className="px-2.5 py-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-neutral-300 tracking-wider uppercase">
                      {s.payment_method}
                    </span>
                  </td>
                  <td className="p-5 text-right font-bold text-white drop-shadow-md">Rs. {s.total.toFixed(2)}</td>
                  <td className="p-5 text-right font-semibold text-red-400">
                    {s.refund_amount > 0 ? `-Rs. ${s.refund_amount.toFixed(2)}` : 'Rs. 0.00'}
                  </td>
                  <td className="p-5 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      s.status === 'Completed'
                        ? 'bg-white/10 text-neutral-200 border-emerald-500/20'
                        : s.status === 'Partially Returned'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-5 pr-8 text-center">
                    <button 
                      className="px-4 py-1.5 bg-white/5 border border-white/10 hover:border-white/40 hover:bg-white/10 hover:text-neutral-200 text-xs font-black tracking-widest uppercase rounded-lg transition-all"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500 font-medium">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Details Modal Overlay */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl">
          <div className="glass-panel rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_50px_rgba(255, 255, 255, 0.15)] max-h-[85vh] border-white/10">
            
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/30 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Receipt className="text-neutral-200" size={24} />
                <div>
                  <h2 className="text-2xl font-bold text-white drop-shadow-md">
                    Transaction History Detail
                  </h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sale Order ID: #{selectedSale.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="p-2 text-gray-400 hover:text-white glass-button rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-8 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-white/10">
              
              {/* Toasts */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="p-3 bg-white/10 border border-emerald-500/20 text-neutral-200 rounded-xl text-sm backdrop-blur-md flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span>{success}</span>
                </div>
              )}

              {/* Order Info Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Timestamp</span>
                  <span className="text-sm font-semibold text-gray-200 mt-1">{new Date(selectedSale.timestamp.replace(' ', 'T')).toLocaleString()}</span>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cashier / Staff</span>
                  <span className="text-sm font-semibold text-gray-200 mt-1">{selectedSale.cashier_name || 'System Cashier'}</span>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Status / Payment Method</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                      selectedSale.status === 'Completed'
                        ? 'bg-white/10 text-neutral-200 border-emerald-500/20'
                        : selectedSale.status === 'Partially Returned'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {selectedSale.status}
                    </span>
                    <span className="text-xs text-gray-400 font-extrabold uppercase">({selectedSale.payment_method})</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Ordered Products</h3>
                  {selectedSale.status !== 'Returned' && (
                    <button
                      onClick={handleReturnAll}
                      className="px-3.5 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all"
                    >
                      Return Remaining Items
                    </button>
                  )}
                </div>
                <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-black/40 border-b border-white/5">
                        <th className="p-4">Item</th>
                        <th className="p-4 text-right">Price</th>
                        <th className="p-4 text-center">Purchased</th>
                        <th className="p-4 text-center">Returned</th>
                        <th className="p-4 pr-6 text-center">Return Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedSale.items?.map((item: SaleItemDetails) => {
                        const remaining = item.qty - item.returned_qty;
                        const returnVal = returnQuantities[item.product_id] || 0;
                        return (
                          <tr key={item.id} className="hover:bg-white/[0.02] transition-colors text-sm">
                            <td className="p-4">
                              <div className="font-semibold text-gray-200">{item.product_name}</div>
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5">{item.product_barcode}</div>
                            </td>
                            <td className="p-4 text-right font-medium text-white">Rs. {item.price.toFixed(2)}</td>
                            <td className="p-4 text-center text-gray-300 font-semibold">{item.qty}</td>
                            <td className="p-4 text-center font-bold text-red-400">{item.returned_qty}</td>
                            <td className="p-4 pr-6 text-center">
                              {remaining > 0 ? (
                                <div className="flex items-center justify-center gap-2">
                                  <input 
                                    type="number"
                                    min="1"
                                    max={remaining}
                                    value={returnVal}
                                    onChange={e => handleQtyChange(item.product_id, parseInt(e.target.value) || 1, remaining)}
                                    className="w-16 text-center glass-input rounded-lg py-1 px-2 text-xs font-mono font-bold"
                                  />
                                  <button
                                    onClick={() => handleReturnItem(item.product_id)}
                                    className="p-1 px-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-black tracking-widest uppercase rounded-lg transition-all"
                                  >
                                    Return
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                  <CheckCircle size={12} className="text-gray-600" /> Fully Returned
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Costing Breakdowns */}
              <div className="grid grid-cols-2 gap-6 mt-2">
                <div className="bg-black/25 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-4">Refund Transaction History</span>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 font-medium">Refund Limit (Total Paid)</span>
                      <span className="text-gray-200 font-bold">Rs. {selectedSale.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                      <span className="text-red-400 font-bold uppercase tracking-wider text-[11px]">Total Refund Given</span>
                      <span className="text-red-400 font-black text-base">Rs. {(selectedSale.refund_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/25 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-4">Order Financial Breakdown</span>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs text-gray-400 font-medium">
                      <span>Subtotal</span>
                      <span>Rs. {selectedSale.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400 font-medium">
                      <span>Promo Discount</span>
                      <span>-Rs. {selectedSale.discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 font-bold text-sm text-gray-200">
                      <span>Paid Total</span>
                      <span className="text-neutral-200 font-extrabold text-lg drop-shadow-md">Rs. {selectedSale.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
