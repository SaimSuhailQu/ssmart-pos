import React, { useState, useEffect, useMemo } from 'react';
import { Sale, SaleItemDetails } from '../types';
import { Search, Receipt, Calendar, User, Undo2, CheckCircle, ArrowRightLeft, DollarSign, X, ShoppingBag, Printer, Copy, Sparkles, PlusCircle, Trash2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { rowsToCsv, downloadCsv, exportTimestamp } from '../lib/csv';
import { money } from '../core/format';

export const SalesRecordManager: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  
  // Custom return quantities per product ID for the currently open modal
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: number]: number }>({});
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual Daily Closing Sale Modal state
  const [showManualClosingModal, setShowManualClosingModal] = useState(false);
  const [closingTotal, setClosingTotal] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closingOnline, setClosingOnline] = useState('');
  const [closingDate, setClosingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closingNotes, setClosingNotes] = useState('');
  const [isSubmittingClosing, setIsSubmittingClosing] = useState(false);

  const loadSales = async () => {
    try {
      const data = await window.api.getAllSales();
      setSales(data);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setError(errMessage || 'Failed to load sales.');
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
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setError(errMessage || 'Failed to process return.');
    }
  };

  const handleReturnAll = async () => {
    if (!selectedSale || !selectedSale.items) return;
    setError(null);
    setSuccess(null);

    const returnsList = selectedSale.items
      .map(item => {
        const maxReturn = item.qty - item.returned_qty;
        return { productId: item.product_id, qtyToReturn: maxReturn };
      })
      .filter(item => item.qtyToReturn > 0);

    if (returnsList.length === 0) {
      setError('All items have already been fully returned.');
      return;
    }

    if (!window.confirm(`Are you sure you want to process a full return for Order #${selectedSale.id}? This will restock all remaining items.`)) {
      return;
    }

    try {
      const res = await window.api.returnSaleItems(selectedSale.id, returnsList);
      if (res) {
        setSuccess('Full order returned and inventory restocked successfully.');
        await loadSales();
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setError(errMessage || 'Failed to process full return.');
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    if (window.confirm(`Are you sure you want to delete Sale #${saleId}? This will remove it from history.`)) {
      try {
        await window.api.deleteSale(saleId);
        if (selectedSale && selectedSale.id === saleId) {
          setSelectedSale(null);
        }
        await loadSales();
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        setError(errMessage || 'Failed to delete sale.');
      }
    }
  };

  // Filter sales with memoization
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const idMatch = s.id.toString().includes(searchQuery);
      const cashierMatch = s.cashier_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const itemMatch = s.items?.some(i => 
        i.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.product_barcode.includes(searchQuery)
      );
      const matchesSearch = idMatch || cashierMatch || itemMatch;

      const matchesStatus = statusFilter === 'All' 
        ? true 
        : statusFilter === 'Returned' 
        ? (s.status === 'Returned' || s.status === 'Partially Returned')
        : s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sales, searchQuery, statusFilter]);

  // Pagination states for high-density rendering performance
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  // Export the currently filtered orders to CSV (respects search + status filters)
  const handleExportCsv = () => {
    if (filteredSales.length === 0) {
      setError('No transactions match the current filters to export.');
      return;
    }
    const rows: (string | number | null | undefined)[][] = [
      ['Sale ID', 'Date', 'Time', 'Cashier', 'Payment Method', 'Status', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Refunded', 'Net'],
    ];
    for (const s of filteredSales) {
      const dt = new Date(s.timestamp);
      const datePart = isNaN(dt.getTime()) ? s.timestamp : dt.toLocaleDateString();
      const timePart = isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push([
        s.id,
        datePart,
        timePart,
        s.cashier_name || '',
        s.payment_method,
        s.status,
        s.items?.length ?? 0,
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.tax.toFixed(2),
        s.total.toFixed(2),
        s.refund_amount.toFixed(2),
        (s.total - s.refund_amount).toFixed(2),
      ]);
    }
    downloadCsv(`ssmart-sales-${exportTimestamp()}.csv`, rowsToCsv(rows));
    setSuccess(`Exported ${filteredSales.length} transactions to CSV.`);
  };

  // Memoize statistics
  const {
    totalSalesCount,
    totalGrossRevenue,
    totalRefunds,
    netRevenue,
    todayGross,
    todayRefunds,
    todayNet,
    todayOrders,
    todayCash,
    todayOnline,
    todayKhata
  } = useMemo(() => {
    const totalSalesCount = sales.length;
    const totalGrossRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalRefunds = sales.reduce((sum, s) => sum + (s.refund_amount || 0), 0);
    const netRevenue = totalGrossRevenue - totalRefunds;

    const now = new Date();
    const todayDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todaySales = sales.filter(s => (s.timestamp ? s.timestamp.substring(0, 10) : '') === todayDateString);
    const gross = todaySales.reduce((sum, s) => sum + s.total, 0);
    const refunds = todaySales.reduce((sum, s) => sum + (s.refund_amount || 0), 0);
    const net = gross - refunds;
    const orders = todaySales.length;
    const cash = todaySales
      .filter(s => s.payment_method?.toLowerCase().includes('cash'))
      .reduce((sum, s) => sum + (s.total - (s.refund_amount || 0)), 0);
    const online = todaySales
      .filter(s => {
        const pm = (s.payment_method || '').toLowerCase();
        return pm.includes('online') || pm.includes('bank') || pm.includes('card') || pm.includes('easypaisa') || pm.includes('jazzcash');
      })
      .reduce((sum, s) => sum + (s.total - (s.refund_amount || 0)), 0);
    const khata = todaySales
      .filter(s => (s.payment_method || '').toLowerCase().includes('khata') || (s.payment_method || '').toLowerCase().includes('credit'))
      .reduce((sum, s) => sum + (s.total - (s.refund_amount || 0)), 0);

    return {
      totalSalesCount,
      totalGrossRevenue,
      totalRefunds,
      netRevenue,
      todayGross: gross,
      todayRefunds: refunds,
      todayNet: net,
      todayOrders: orders,
      todayCash: cash,
      todayOnline: online,
      todayKhata: khata
    };
  }, [sales]);

  const handleCopyDailyNote = () => {
    const dateFormatted = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    const timeFormatted = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

    const note = `🏪 *SS MART*\n` +
      `📅 *DAILY CLOSING SALES NOTE*\n` +
      `──────────────────────\n` +
      `🗓️ *Date:* ${dateFormatted}\n` +
      `⏰ *Time Recorded:* ${timeFormatted}\n` +
      `──────────────────────\n` +
      `📦 *Total Orders Completed:* ${todayOrders}\n` +
      `💵 *Gross Daily Sales:* Rs. ${money(todayGross)}\n` +
      `↩️ *Total Refunds/Returns:* Rs. ${money(todayRefunds)}\n` +
      `✨ *NET DAILY SALES:* Rs. ${money(todayNet)}\n` +
      `──────────────────────\n` +
      `💳 *PAYMENT BREAKDOWN:*\n` +
      `• Cash in Drawer: Rs. ${money(todayCash)}\n` +
      `• Online / Bank / Card: Rs. ${money(todayOnline)}\n` +
      `• Khata / Credit: Rs. ${todayKhata.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `──────────────────────\n` +
      `✅ *Generated via SS Mart POS*`;

    navigator.clipboard.writeText(note).then(() => {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 3000);
    });
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-content-primary font-sans overflow-hidden">
      
      {/* Dedicated "Note Down Today's Sales" Banner */}
      <div className="mb-3 p-4 rounded-xl border border-canvas-card/80 bg-canvas-subtle/60 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-status-emerald/10 border border-status-emerald/30 flex items-center justify-center text-status-emerald">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-status-emerald">Daily Closing Note</span>
              <span className="text-[10px] bg-status-emerald/10 text-status-emerald font-semibold px-2 py-0.5 rounded border border-status-emerald/20 font-mono">
                Today ({todayOrders} {todayOrders === 1 ? 'sale' : 'sales'})
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-0.5 flex items-baseline gap-2">
              <span className="font-mono tabular-nums tracking-tight">Rs. {todayNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-normal text-content-secondary">Net Sales Today</span>
            </div>
          </div>
        </div>

        {/* Breakdown chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-canvas/60 border border-canvas-card flex items-center gap-2">
            <span className="text-content-secondary font-medium">Cash:</span>
            <span className="font-mono tabular-nums font-bold text-status-emerald">Rs. {todayCash.toLocaleString()}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-canvas/60 border border-canvas-card flex items-center gap-2">
            <span className="text-content-secondary font-medium">Online/Card:</span>
            <span className="font-mono tabular-nums font-bold text-indigo-400">Rs. {todayOnline.toLocaleString()}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-canvas/60 border border-canvas-card flex items-center gap-2">
            <span className="text-content-secondary font-medium">Khata:</span>
            <span className="font-mono tabular-nums font-bold text-status-amber">Rs. {todayKhata.toLocaleString()}</span>
          </div>
          {todayRefunds > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-status-coral/10 border border-status-coral/20 flex items-center gap-2">
              <span className="text-status-coral font-medium">Refunds:</span>
              <span className="font-mono tabular-nums font-bold text-status-coral">Rs. {todayRefunds.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowManualClosingModal(true)}
            className="px-3.5 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 bg-status-emerald hover:brightness-110 text-white shadow-sm"
            title="Manually log daily closing sales directly into the ledger"
          >
            <PlusCircle size={15} />
            <span>+ Add Daily Closing</span>
          </button>

          <button
            onClick={handleCopyDailyNote}
            className={`px-3.5 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 ${
              copiedNote 
                ? 'bg-status-emerald text-canvas font-bold' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
            }`}
            title="Copies a formatted daily closing note to clipboard for WhatsApp/SMS"
          >
            {copiedNote ? <CheckCircle size={15} /> : <Copy size={15} />}
            <span>{copiedNote ? 'Note Copied!' : 'Copy Daily Note'}</span>
          </button>
        </div>
      </div>

      {/* Top statistics banners */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 flex-shrink-0">
        <div className="enterprise-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-canvas-card/80 border border-canvas-hover flex items-center justify-center text-content-secondary">
            <Receipt size={20} />
          </div>
          <div>
            <span className="text-[11px] text-content-secondary font-medium uppercase tracking-wider block">All-Time Orders</span>
            <span className="text-xl font-bold font-mono tabular-nums text-white">{totalSalesCount}</span>
          </div>
        </div>

        <div className="enterprise-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-status-emerald/10 border border-status-emerald/20 flex items-center justify-center text-status-emerald">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[11px] text-content-secondary font-medium uppercase tracking-wider block">Gross Revenue</span>
            <span className="text-xl font-bold font-mono tabular-nums text-white">Rs. {totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="enterprise-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-status-coral/10 border border-status-coral/20 flex items-center justify-center text-status-coral">
            <Undo2 size={20} />
          </div>
          <div>
            <span className="text-[11px] text-content-secondary font-medium uppercase tracking-wider block">Refunded Amount</span>
            <span className="text-xl font-bold font-mono tabular-nums text-status-coral">Rs. {totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="enterprise-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShoppingBag size={20} />
          </div>
          <div>
            <span className="text-[11px] text-content-secondary font-medium uppercase tracking-wider block">Net Revenue</span>
            <span className="text-xl font-bold font-mono tabular-nums text-status-emerald">Rs. {netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 enterprise-card rounded-xl overflow-hidden flex flex-col relative z-10">
        <header className="p-4 border-b border-canvas-card bg-canvas-subtle/70 sticky top-0 z-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">SALES AUDIT & TRANSACTIONS</h1>
              <p className="text-[10px] text-content-secondary font-mono mt-0.5">{filteredSales.length} Transactions Recorded</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-status-emerald/10 text-status-emerald border border-status-emerald/30 hover:bg-status-emerald/20 hover:border-status-emerald/50"
              title="Export the currently filtered transactions to a CSV file"
            >
              <Download size={14} /> Export CSV
            </button>

            <div className="relative group w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-content-muted group-focus-within:text-indigo-400 transition-colors">
                <Search size={15} />
              </div>
              <input 
                type="text" 
                placeholder="Search ID, cashier, method..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full glass-input rounded-lg block pl-9 py-1.5 px-3 text-xs"
              />
            </div>

            <div className="flex gap-1 bg-canvas/80 border border-canvas-card rounded-lg p-1">
              {['All', 'Completed', 'Partially Returned', 'Returned'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-canvas-card text-white font-semibold border border-canvas-hover shadow-sm'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-canvas/90 backdrop-blur-md z-10 border-b border-canvas-card">
              <tr className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
                <th className="py-2.5 px-4 pl-6">Order ID</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Cashier</th>
                <th className="py-2.5 px-4">Payment Method</th>
                <th className="py-2.5 px-4 text-right">Original Total</th>
                <th className="py-2.5 px-4 text-right">Refunded</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 pr-6 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-card/60">
              {paginatedSales.map(s => (
                <tr 
                  key={s.id} 
                  onClick={() => handleOpenSaleDetails(s)}
                  className="hover:bg-canvas-card/40 transition-colors group cursor-pointer"
                >
                  <td className="py-2.5 px-4 pl-6 font-mono font-bold text-indigo-400 tracking-wider">#{s.id}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-content-secondary">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-content-muted" />
                      {new Date(s.timestamp.replace(' ', 'T')).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs font-medium text-content-secondary">
                    <span className="flex items-center gap-1.5">
                      <User size={13} className="text-content-muted" />
                      {s.cashier_name || 'System Cashier'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 bg-canvas-subtle border border-canvas-hover/80 rounded text-[11px] font-medium text-content-secondary uppercase">
                      {s.payment_method}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-content-primary">Rs. {s.total.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-status-coral">
                    {s.refund_amount > 0 ? `-Rs. ${s.refund_amount.toFixed(2)}` : 'Rs. 0.00'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      s.status === 'Completed'
                        ? 'bg-status-emerald/10 text-status-emerald border-status-emerald/20'
                        : s.status === 'Partially Returned'
                        ? 'bg-status-amber/10 text-status-amber border-status-amber/20'
                        : 'bg-status-coral/10 text-status-coral border-status-coral/20'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 pr-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSaleDetails(s);
                        }}
                        className="px-3 py-1 bg-canvas-card/80 border border-canvas-hover hover:border-canvas-hover hover:bg-canvas-hover text-[10px] font-bold tracking-wider uppercase rounded transition-all text-content-primary cursor-pointer"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSale(s.id);
                        }}
                        className="p-1 text-content-muted hover:text-status-coral hover:bg-status-coral/10 rounded transition-colors cursor-pointer"
                        title="Delete Sale"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-content-muted font-medium">
                    No transactions found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-canvas-card/80 bg-canvas/60 flex items-center justify-between text-xs text-content-secondary">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredSales.length)} of {filteredSales.length} orders
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg bg-canvas-subtle border border-canvas-card text-content-secondary hover:bg-canvas-card disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono font-medium text-content-primary">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg bg-canvas-subtle border border-canvas-card text-content-secondary hover:bg-canvas-card disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sale Details Modal Overlay */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="enterprise-card rounded-xl w-full max-w-3xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 shadow-2xl max-h-[85vh] border-canvas-hover">
            
            <div className="flex justify-between items-center p-5 border-b border-canvas-card bg-canvas-subtle/90">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Receipt size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Transaction Audit Detail
                  </h2>
                  <p className="text-[11px] text-content-secondary font-mono">Sale Order ID: #{selectedSale.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    try {
                      const items = (selectedSale.items || []).map((it) => ({
                        id: it.product_id,
                        barcode: it.product_barcode,
                        name: it.product_name,
                        price: it.price,
                        cost_price: 0,
                        stock: 0,
                        category: it.product_category,
                        qty: it.qty
                      }));
                      await window.api.printReceipt({
                        items,
                        paymentData: {
                          subtotal: selectedSale.subtotal,
                          discount: selectedSale.discount,
                          tax: selectedSale.tax,
                          total: selectedSale.total,
                          change: 0,
                          payments: [{ method: selectedSale.payment_method, amount: selectedSale.total }]
                        },
                        saleId: selectedSale.id,
                        cashierName: selectedSale.cashier_name
                      });
                      setSuccess(`Receipt for Sale #${selectedSale.id} sent to thermal printer!`);
                    } catch (err: unknown) {
                      const errMessage = err instanceof Error ? err.message : String(err);
                      setError(errMessage || 'Failed to print receipt.');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-sm"
                  title="Print Thermal Receipt from Desktop Printer"
                >
                  <Printer size={14} /> Reprint Bill
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSale(selectedSale.id)}
                  className="px-3.5 py-1.5 bg-status-coral/20 hover:bg-status-coral/30 text-status-coral border border-status-coral/40 font-semibold rounded-lg text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
                  title="Permanently Delete Transaction"
                >
                  <Trash2 size={14} /> Delete Sale
                </button>
                <button 
                  onClick={() => setSelectedSale(null)} 
                  className="p-1.5 text-content-secondary hover:text-white rounded-lg hover:bg-canvas-card cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 flex flex-col gap-5 scrollbar-thin scrollbar-thumb-slate-800">
              
              {/* Toasts */}
              {error && (
                <div className="p-3 bg-status-coral/10 border border-status-coral/20 text-status-coral rounded-lg text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="p-3 bg-status-emerald/10 border border-status-emerald/20 text-status-emerald rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle size={15} />
                  <span>{success}</span>
                </div>
              )}

              {/* Order Info Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-canvas/60 border border-canvas-card rounded-xl p-3 flex flex-col">
                  <span className="text-[10px] text-content-secondary font-semibold uppercase tracking-wider">Timestamp</span>
                  <span className="text-xs font-mono text-content-primary mt-1">{new Date(selectedSale.timestamp.replace(' ', 'T')).toLocaleString()}</span>
                </div>
                <div className="bg-canvas/60 border border-canvas-card rounded-xl p-3 flex flex-col">
                  <span className="text-[10px] text-content-secondary font-semibold uppercase tracking-wider">Cashier / Staff</span>
                  <span className="text-xs font-medium text-content-primary mt-1">{selectedSale.cashier_name || 'System Cashier'}</span>
                </div>
                <div className="bg-canvas/60 border border-canvas-card rounded-xl p-3 flex flex-col">
                  <span className="text-[10px] text-content-secondary font-semibold uppercase tracking-wider">Status / Payment Method</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      selectedSale.status === 'Completed'
                        ? 'bg-status-emerald/10 text-status-emerald border-status-emerald/20'
                        : selectedSale.status === 'Partially Returned'
                        ? 'bg-status-amber/10 text-status-amber border-status-amber/20'
                        : 'bg-status-coral/10 text-status-coral border-status-coral/20'
                    }`}>
                      {selectedSale.status}
                    </span>
                    <span className="text-xs text-content-secondary font-mono uppercase">({selectedSale.payment_method})</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-xs font-bold text-content-secondary uppercase tracking-wider">Ordered Products</h3>
                  {selectedSale.status !== 'Returned' && (
                    <button
                      onClick={handleReturnAll}
                      className="px-3 py-1 bg-status-coral/10 border border-status-coral/20 hover:bg-status-coral/20 text-status-coral text-[10px] font-bold tracking-wider uppercase rounded-md transition-all cursor-pointer"
                    >
                      Return Remaining Items
                    </button>
                  )}
                </div>
                <div className="bg-canvas/60 border border-canvas-card rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-semibold text-content-secondary uppercase tracking-wider bg-canvas-subtle/80 border-b border-canvas-card">
                        <th className="py-2.5 px-4">Item</th>
                        <th className="py-2.5 px-4 text-right">Price</th>
                        <th className="py-2.5 px-4 text-center">Purchased</th>
                        <th className="py-2.5 px-4 text-center">Returned</th>
                        <th className="py-2.5 px-4 pr-6 text-center">Return Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-canvas-card/60">
                      {selectedSale.items?.map((item: SaleItemDetails) => {
                        const remaining = item.qty - item.returned_qty;
                        const returnVal = returnQuantities[item.product_id] || 0;
                        return (
                          <tr key={item.id} className="hover:bg-canvas-card/30 transition-colors text-xs">
                            <td className="py-2.5 px-4">
                              <div className="font-medium text-content-primary">{item.product_name}</div>
                              <div className="text-[10px] text-content-muted font-mono mt-0.5">{item.product_barcode}</div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-content-primary">Rs. {item.price.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-center text-content-secondary font-mono">{item.qty}</td>
                            <td className="py-2.5 px-4 text-center font-mono font-bold text-status-coral">{item.returned_qty}</td>
                            <td className="py-2.5 px-4 pr-6 text-center">
                              {remaining > 0 ? (
                                <div className="flex items-center justify-center gap-2">
                                  <input 
                                    type="number"
                                    min="1"
                                    max={remaining}
                                    value={returnVal}
                                    onChange={e => handleQtyChange(item.product_id, parseInt(e.target.value) || 1, remaining)}
                                    className="w-14 text-center glass-input rounded-md py-1 px-2 text-xs font-mono font-bold"
                                  />
                                  <button
                                    onClick={() => handleReturnItem(item.product_id)}
                                    className="py-1 px-2.5 bg-status-coral/10 border border-status-coral/20 hover:bg-status-coral/20 text-status-coral text-[11px] font-bold uppercase rounded-md transition-all cursor-pointer"
                                  >
                                    Return
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-content-muted uppercase tracking-wider">
                                  <CheckCircle size={12} className="text-status-emerald/60" /> Fully Returned
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
              <div className="grid grid-cols-2 gap-4 mt-1">
                <div className="bg-canvas/60 border border-canvas-card rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] text-content-secondary font-semibold uppercase tracking-wider block mb-3">Refund Transaction Audit</span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-content-secondary">Total Tendered</span>
                      <span className="text-content-primary font-mono tabular-nums font-semibold">Rs. {selectedSale.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-canvas-card">
                      <span className="text-status-coral font-medium uppercase tracking-wider text-[11px]">Total Refund Given</span>
                      <span className="text-status-coral font-mono tabular-nums font-bold text-sm">Rs. {(selectedSale.refund_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-canvas/60 border border-canvas-card rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] text-content-secondary font-semibold uppercase tracking-wider block mb-3">Order Financial Breakdown</span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-content-secondary">
                      <span>Subtotal</span>
                      <span className="font-mono tabular-nums">Rs. {selectedSale.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-content-secondary">
                      <span>Promo Discount</span>
                      <span className="font-mono tabular-nums text-status-amber">-Rs. {selectedSale.discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-canvas-card font-bold text-xs text-content-primary">
                      <span>Net Paid</span>
                      <span className="text-status-emerald font-mono tabular-nums font-bold text-base">Rs. {selectedSale.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Manual Daily Closing Sale Modal */}
      {showManualClosingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-canvas-subtle border border-canvas-hover/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-canvas-card flex justify-between items-center bg-canvas/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-status-emerald/20 border border-status-emerald/30 flex items-center justify-center text-status-emerald">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Add Daily Closing Sale</h3>
                  <p className="text-[11px] text-content-secondary">Log closing revenue manually into the sales ledger</p>
                </div>
              </div>
              <button 
                onClick={() => setShowManualClosingModal(false)}
                className="p-1 rounded-lg text-content-secondary hover:text-white hover:bg-canvas-card transition"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const totalNum = parseFloat(closingTotal) || (parseFloat(closingCash) || 0) + (parseFloat(closingOnline) || 0);
                if (totalNum <= 0) {
                  alert('Please enter a valid closing sales amount greater than 0');
                  return;
                }

                setIsSubmittingClosing(true);
                try {
                  await window.api.addManualDailyClosingSale({
                    total: totalNum,
                    cashAmount: parseFloat(closingCash) || 0,
                    onlineAmount: parseFloat(closingOnline) || 0,
                    date: closingDate,
                    notes: closingNotes.trim() || 'Manual Daily Closing Sales Note',
                  });

                  setShowManualClosingModal(false);
                  setClosingTotal('');
                  setClosingCash('');
                  setClosingOnline('');
                  setClosingNotes('');
                  await loadSales();
                } catch (err: unknown) {
                  const errMessage = err instanceof Error ? err.message : String(err);
                  alert(`Failed to add closing sale: ${errMessage}`);
                } finally {
                  setIsSubmittingClosing(false);
                }
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
                  Closing Date
                </label>
                <input 
                  type="date"
                  value={closingDate}
                  onChange={e => setClosingDate(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
                  Net Closing Sales Total (Rs.) *
                </label>
                <input 
                  type="number"
                  step="any"
                  placeholder="e.g. 25000"
                  value={closingTotal}
                  onChange={e => setClosingTotal(e.target.value)}
                  className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm font-bold text-status-emerald font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-content-secondary mb-1">
                    Cash in Drawer (Rs.)
                  </label>
                  <input 
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={closingCash}
                    onChange={e => setClosingCash(e.target.value)}
                    className="w-full glass-input rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-content-secondary mb-1">
                    Online / Card (Rs.)
                  </label>
                  <input 
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={closingOnline}
                    onChange={e => setClosingOnline(e.target.value)}
                    className="w-full glass-input rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-content-secondary mb-1">
                  Notes / Register Info (Optional)
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Evening shift closing register"
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  className="w-full glass-input rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-canvas-card">
                <button
                  type="button"
                  onClick={() => setShowManualClosingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-content-secondary hover:text-white hover:bg-canvas-card transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClosing}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-status-emerald hover:brightness-110 text-canvas shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingClosing ? 'Saving...' : 'Save Closing Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
