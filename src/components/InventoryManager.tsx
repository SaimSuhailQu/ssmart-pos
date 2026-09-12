import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';
import { Plus, Edit2, Trash2, Printer, Search, PackageOpen, Sliders, AlertTriangle, Upload, Layers, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';
import { BulkProductEditorModal } from './BulkProductEditorModal';
import { BulkAddProductModal } from './BulkAddProductModal';

interface InventoryManagerProps {
  initialLowStockOnly?: boolean;
  onProductsUpdated?: () => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ 
  initialLowStockOnly = false,
  onProductsUpdated
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isBulkEditorOpen, setIsBulkEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadProducts = async () => {
    try {
      const data = await window.api.getAllProducts();
      setProducts(data);
      if (onProductsUpdated) {
        onProductsUpdated();
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (initialLowStockOnly) {
      setLowStockOnly(true);
    }
  }, [initialLowStockOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, lowStockOnly]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (productData: Omit<Product, 'id'>) => {
    if (editingProduct) {
      await window.api.updateProduct(editingProduct.id, productData);
    } else {
      await window.api.addProduct(productData);
    }
    setIsModalOpen(false);
    loadProducts();
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      await window.api.deleteProduct(id);
      loadProducts();
    }
  };

  const handlePrintBarcode = async (product: Product) => {
    const success = await window.api.printBarcode(product);
    if (!success) {
      alert("Failed to print barcode. Check printer connection.");
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (lowStockOnly && p.stock > 5) return false;
      return (
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.barcode.includes(searchQuery) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [products, lowStockOnly, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  return (
    <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255, 255, 255, 0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 blur-[100px] -mr-40 -mt-40 rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 blur-[100px] -ml-40 -mb-40 rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <header className="p-6 border-b border-white/5 bg-black/20 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-200 to-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(255, 255, 255, 0.3)]">
              <PackageOpen className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">INVENTORY</h1>
              <p className="text-xs text-neutral-200 font-bold uppercase tracking-widest mt-1">{products.length} Products Found</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group w-72">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-neutral-200 transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Search items..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full glass-input rounded-xl block pl-12 p-3"
              />
            </div>
            
            <button
              onClick={() => setLowStockOnly(prev => !prev)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all border ${
                lowStockOnly 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                  : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
              }`}
              title="Toggle Low Stock Filter (≤ 5 units)"
            >
              <AlertTriangle size={16} />
              Low Stock Only
            </button>

            <button
              onClick={() => setIsBulkEditorOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs text-white bg-white/10 hover:bg-white/20 transition-all border border-white/15 shadow-md"
              title="Open Bulk Price & Stock Batch Editor"
            >
              <Sliders size={16} />
              Bulk Editor
            </button>

            {/* Direct CSV Import */}
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/30 shadow-md cursor-pointer active:scale-95">
              <Upload size={16} />
              <span>Import CSV</span>
              <input 
                type="file" 
                accept=".csv" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    try {
                      const text = event.target?.result as string;
                      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                      if (lines.length < 2) {
                        alert('CSV file is empty or invalid.');
                        return;
                      }

                      const updates: { id: number; cost_price: number; price: number; stock: number; category: string }[] = [];
                      const newProducts: Omit<Product, 'id'>[] = [];
                      for (let i = 1; i < lines.length; i++) {
                        const rawLine = lines[i];
                        const cols: string[] = [];
                        let cur = '';
                        let inQuotes = false;
                        for (let j = 0; j < rawLine.length; j++) {
                          const c = rawLine[j];
                          if (c === '"') inQuotes = !inQuotes;
                          else if (c === ',' && !inQuotes) {
                            cols.push(cur.trim());
                            cur = '';
                          } else {
                            cur += c;
                          }
                        }
                        cols.push(cur.trim());

                        if (cols.length < 6) continue;
                        const barcode = cols[1]?.trim();
                        const name = cols[2]?.trim();
                        const category = cols[3]?.trim() || 'General';
                        const cost_price = parseFloat(cols[4]) || 0;
                        const price = parseFloat(cols[5]) || 0;
                        const stock = parseInt(cols[6], 10) || 0;

                        if (!barcode || !name) continue;

                        const existing = products.find(p => p.barcode === barcode);
                        if (existing) {
                          updates.push({
                            id: existing.id,
                            cost_price,
                            price,
                            stock,
                            category
                          });
                        } else {
                          newProducts.push({
                            name,
                            barcode,
                            category,
                            cost_price,
                            price,
                            stock
                          });
                        }
                      }

                      if (newProducts.length > 0) {
                        await window.api.bulkAddProducts(newProducts);
                      }

                      if (updates.length > 0) {
                        await window.api.bulkUpdateProducts(updates);
                      }

                      await loadProducts();
                      alert(`Successfully imported and updated products from CSV!`);
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      alert(`Error importing CSV: ${msg}`);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} 
                className="hidden" 
              />
            </label>
            
            <button 
              type="button"
              onClick={() => setIsBulkAddOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shadow-md"
              title="Add multiple products at once"
            >
              <Layers size={17} /> 
              <span>Bulk Add</span>
            </button>

            <button 
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(255,255,255,0.3)] bg-gradient-to-r from-neutral-200 to-emerald-600 hover:from-neutral-100 hover:to-emerald-500 transition-all relative overflow-hidden group cursor-pointer active:scale-95 touch-manipulation select-none"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none"></div>
              <Plus size={18} className="relative z-10" /> 
              <span className="relative z-10">New Product</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md z-10 border-b border-slate-800">
              <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 pl-6">Product Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">Margin</th>
                <th className="py-3 px-4 text-right">Inventory Stock</th>
                <th className="py-3 px-4 pr-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedProducts.map(p => {
                const margin = p.price > 0 && p.cost_price >= 0 
                  ? ((p.price - p.cost_price) / p.price) * 100 
                  : 0;
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= 5;
                
                return (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3 px-4 pl-6 font-semibold text-slate-100 text-sm leading-tight">{p.name}</td>
                    <td className="py-3 px-4 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400 tabular-nums">{p.barcode}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-400">Rs. {(p.cost_price || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-bold tabular-nums text-slate-100">Rs. {p.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        margin >= 30 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : margin >= 15 
                          ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' 
                          : margin > 0 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      <span className={`inline-flex items-center gap-1.5 font-bold ${
                        isOutOfStock 
                          ? 'text-rose-400' 
                          : isLowStock 
                          ? 'text-amber-400' 
                          : 'text-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-rose-400' : isLowStock ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                        {p.stock} units
                      </span>
                    </td>
                    <td className="py-3 px-4 pr-6">
                      <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handlePrintBarcode(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
                          title="Print Barcode Label"
                        >
                          <Printer size={15} />
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-500/15 rounded-md transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-500/15 rounded-md transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3 text-gray-400">
                        <Package size={22} />
                      </div>
                      <p className="text-sm font-semibold text-gray-300">No products found</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        {searchQuery 
                          ? `No items match "${searchQuery}". Check the barcode or title.` 
                          : 'Your inventory list is currently empty. Click "+ Add Product" to get started.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredProducts.length > itemsPerPage && (
          <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              Showing <strong className="text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-white">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> of <strong className="text-white">{filteredProducts.length}</strong> products
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs text-gray-400 px-2 font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProductFormModal 
          product={editingProduct} 
          existingCategories={Array.from(new Set(products.map(p => p.category))).filter(Boolean)}
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveProduct} 
        />
      )}

      {isBulkAddOpen && (
        <BulkAddProductModal
          existingCategories={Array.from(new Set(products.map(p => p.category))).filter(Boolean)}
          onClose={() => setIsBulkAddOpen(false)}
          onRefresh={loadProducts}
        />
      )}

      {isBulkEditorOpen && (
        <BulkProductEditorModal
          products={products}
          onClose={() => setIsBulkEditorOpen(false)}
          onRefresh={loadProducts}
        />
      )}
    </div>
  );
};
