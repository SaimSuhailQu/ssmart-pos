import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';
import { Search, Printer, Plus, Minus, Trash2, X, PackageOpen, ChevronRight, FileText } from 'lucide-react';

interface PrintQueueItem {
  product: Product;
  count: number;
}

export const BarcodePrintManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await window.api.getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Add product to print queue
  const addToQueue = (product: Product) => {
    setPrintResult(null);
    setPrintQueue(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, count: Math.min(item.count + 1, 500) }
            : item
        );
      }
      return [...prev, { product, count: 1 }];
    });
  };

  // Update count for a queue item
  const updateCount = (productId: number, newCount: number) => {
    const clamped = Math.max(1, Math.min(newCount, 500));
    setPrintQueue(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, count: clamped } : item
      )
    );
  };

  // Remove item from queue
  const removeFromQueue = (productId: number) => {
    setPrintQueue(prev => prev.filter(item => item.product.id !== productId));
  };

  // Clear entire queue
  const clearQueue = () => {
    setPrintQueue([]);
    setPrintResult(null);
  };

  // Total labels and pages
  const totalLabels = printQueue.reduce((sum, item) => sum + item.count, 0);
  const totalPages = Math.ceil(totalLabels / 100);

  // Check if product is already in queue
  const isInQueue = (productId: number) => printQueue.some(item => item.product.id === productId);

  // Execute batch print
  const handlePrint = async () => {
    if (printQueue.length === 0) return;
    setIsPrinting(true);
    setPrintResult(null);

    try {
      const items = printQueue.map(item => ({
        name: item.product.name,
        barcode: item.product.barcode,
        price: item.product.price,
        count: item.count
      }));

      const success = await window.api.printBarcodesBatchA4(items);

      if (success) {
        setPrintResult({ success: true, message: `Successfully sent ${totalLabels} barcode labels (${totalPages} A4 page${totalPages > 1 ? 's' : ''}) to the LaserJet printer!` });
      } else {
        setPrintResult({ success: false, message: 'Print job failed. Check if the HP LaserJet P2015 is connected and turned on.' });
      }
    } catch (err) {
      console.error('Batch print error:', err);
      setPrintResult({ success: false, message: 'An unexpected error occurred while printing.' });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-canvas-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Printer size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">A4 Barcode Printer</h1>
            <p className="text-[11px] text-content-secondary font-medium">HP LaserJet P2015 · 100 labels per A4 page</p>
          </div>
        </div>

        {printQueue.length > 0 && (
          <button
            onClick={clearQueue}
            className="px-3 py-1.5 text-xs font-semibold text-status-coral hover:text-status-coral hover:bg-status-coral/10 border border-status-coral/30 rounded-lg transition-all"
          >
            <Trash2 size={12} className="inline mr-1.5" />Clear All
          </button>
        )}
      </div>

      {/* Main content: split panel */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT: Product Search & List */}
        <div className="w-[55%] flex flex-col border-r border-canvas-card overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-canvas-card/60 flex-shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="text"
                placeholder="Search products by name, barcode, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-canvas-subtle/80 border border-canvas-hover/60 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-content-muted font-semibold uppercase tracking-wider">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
              </span>
              <span className="text-[10px] text-violet-400 font-semibold">
                Click a product to add to print queue →
              </span>
            </div>
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-content-muted">
                <PackageOpen size={40} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">No products found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredProducts.map(product => {
                  const inQueue = isInQueue(product.id);
                  const queueItem = printQueue.find(item => item.product.id === product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => addToQueue(product)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all group ${
                        inQueue
                          ? 'bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/15'
                          : 'hover:bg-canvas-card/60 border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{product.name}</span>
                          {product.category && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-canvas-card text-content-secondary font-medium uppercase tracking-wide flex-shrink-0">
                              {product.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] font-mono text-content-secondary">{product.barcode}</span>
                          <span className="text-[11px] font-bold text-status-emerald">Rs. {product.price.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {inQueue && queueItem ? (
                          <span className="text-[10px] font-bold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-md">
                            ×{queueItem.count}
                          </span>
                        ) : (
                          <span className="text-status-slate group-hover:text-violet-400 transition-colors">
                            <Plus size={16} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Print Queue */}
        <div className="w-[45%] flex flex-col overflow-hidden bg-canvas/40">
          {/* Queue header */}
          <div className="px-4 py-3 border-b border-canvas-card/60 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-content-secondary uppercase tracking-widest">Print Queue</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-content-secondary">
                  {printQueue.length} item{printQueue.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Queue items */}
          <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
            {printQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-status-slate">
                <FileText size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-medium text-content-muted">Queue is empty</p>
                <p className="text-xs mt-1">Select products from the left to add barcode labels</p>
              </div>
            ) : (
              <div className="space-y-2">
                {printQueue.map(item => (
                  <div
                    key={item.product.id}
                    className="bg-canvas-subtle/80 border border-canvas-hover/50 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-bold text-white truncate">{item.product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-content-secondary">{item.product.barcode}</span>
                          <span className="text-[10px] font-bold text-status-emerald">Rs. {item.product.price.toFixed(2)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromQueue(item.product.id)}
                        className="text-status-slate hover:text-status-coral p-1 rounded hover:bg-status-coral/10 transition-all flex-shrink-0"
                        title="Remove from queue"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-content-muted font-semibold uppercase tracking-wider w-12">Labels:</span>
                      <button
                        onClick={() => updateCount(item.product.id, item.count - 1)}
                        className="w-8 h-8 rounded-lg bg-canvas-card hover:bg-canvas-hover border border-canvas-hover text-white font-bold text-sm flex items-center justify-center transition-colors active:scale-95"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={item.count}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateCount(item.product.id, isNaN(val) ? 1 : val);
                        }}
                        className="w-16 h-8 text-center bg-canvas border border-canvas-hover rounded-lg text-sm font-bold font-mono text-white focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <button
                        onClick={() => updateCount(item.product.id, item.count + 1)}
                        className="w-8 h-8 rounded-lg bg-canvas-card hover:bg-canvas-hover border border-canvas-hover text-white font-bold text-sm flex items-center justify-center transition-colors active:scale-95"
                      >
                        <Plus size={12} />
                      </button>

                      {/* Quick presets */}
                      <div className="flex items-center gap-1 ml-1">
                        {[1, 5, 10, 24, 48].map(preset => (
                          <button
                            key={preset}
                            onClick={() => updateCount(item.product.id, preset)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold font-mono border transition-all ${
                              item.count === preset
                                ? 'bg-violet-500 text-white border-violet-400 shadow-sm shadow-violet-500/30'
                                : 'bg-canvas-card/60 hover:bg-canvas-hover/60 text-content-secondary border-canvas-hover/60 hover:border-canvas-hover'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Print summary + action */}
          {printQueue.length > 0 && (
            <div className="px-4 py-3 border-t border-canvas-card/60 flex-shrink-0 space-y-3">
              {/* Summary stats */}
              <div className="flex items-center justify-between bg-canvas-subtle/60 border border-canvas-hover/40 rounded-xl px-4 py-2.5">
                <div className="text-center flex-1">
                  <p className="text-[10px] text-content-muted uppercase tracking-wider font-semibold">Products</p>
                  <p className="text-lg font-bold font-mono text-white">{printQueue.length}</p>
                </div>
                <div className="w-px h-8 bg-canvas-hover/60" />
                <div className="text-center flex-1">
                  <p className="text-[10px] text-content-muted uppercase tracking-wider font-semibold">Total Labels</p>
                  <p className="text-lg font-bold font-mono text-violet-400">{totalLabels}</p>
                </div>
                <div className="w-px h-8 bg-canvas-hover/60" />
                <div className="text-center flex-1">
                  <p className="text-[10px] text-content-muted uppercase tracking-wider font-semibold">A4 Pages</p>
                  <p className="text-lg font-bold font-mono text-status-emerald">{totalPages}</p>
                </div>
              </div>

              {/* Print result message */}
              {printResult && (
                <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  printResult.success
                    ? 'bg-status-emerald/15 border border-status-emerald/30 text-status-emerald'
                    : 'bg-status-coral/15 border border-status-coral/30 text-status-coral'
                }`}>
                  {printResult.message}
                </div>
              )}

              {/* Print button */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={18} />
                {isPrinting
                  ? 'Sending to HP LaserJet P2015...'
                  : `Print ${totalLabels} Barcode${totalLabels > 1 ? 's' : ''} on ${totalPages} A4 Page${totalPages > 1 ? 's' : ''}`
                }
                {!isPrinting && <ChevronRight size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
