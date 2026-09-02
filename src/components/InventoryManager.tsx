import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Plus, Edit2, Trash2, Printer, Search, PackageOpen, Sliders, AlertTriangle, Upload } from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';
import { BulkProductEditorModal } from './BulkProductEditorModal';
import { BulkAddProductModal } from './BulkAddProductModal';
import { Layers } from 'lucide-react';

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
    } catch (err) {
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

  const filteredProducts = products.filter(p => {
    if (lowStockOnly && p.stock > 5) return false;
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.barcode.includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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

                      const updates: any[] = [];
                      const newProducts: any[] = [];
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
                    } catch (err: any) {
                      alert(`Error importing CSV: ${err.message || err}`);
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

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-black/40 backdrop-blur-md z-10 shadow-md">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="p-5 pl-8 border-b border-white/5">Product</th>
                <th className="p-5 border-b border-white/5">Category</th>
                <th className="p-5 border-b border-white/5">Barcode</th>
                <th className="p-5 text-right border-b border-white/5">Cost</th>
                <th className="p-5 text-right border-b border-white/5">Sale Price</th>
                <th className="p-5 text-right border-b border-white/5">Margin %</th>
                <th className="p-5 text-right border-b border-white/5">Stock</th>
                <th className="p-5 pr-8 text-center border-b border-white/5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.map(p => {
                const margin = p.price > 0 && p.cost_price >= 0 
                  ? ((p.price - p.cost_price) / p.price) * 100 
                  : 0;
                return (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5 pl-8 font-semibold text-gray-200">{p.name}</td>
                    <td className="p-5">
                      <span className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-neutral-200 tracking-wider">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-5 font-mono text-sm text-gray-400 tracking-wider">{p.barcode}</td>
                    <td className="p-5 text-right font-medium text-gray-400">Rs. {(p.cost_price || 0).toFixed(2)}</td>
                    <td className="p-5 text-right font-bold text-white drop-shadow-md">Rs. {p.price.toFixed(2)}</td>
                    <td className="p-5 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider border uppercase transition-all duration-300 ${
                        margin >= 30 
                          ? 'bg-white/10 text-neutral-200 border-emerald-500/20' 
                          : margin >= 15 
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
                          : margin > 0 
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                      }`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-5 text-right font-medium text-gray-300">{p.stock}</td>
                    <td className="p-5 pr-8">
                      <div className="flex items-center justify-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handlePrintBarcode(p)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                          title="Print Barcode Label"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(p)}
                          className="p-2 text-neutral-200 hover:text-white hover:bg-white/20 rounded-lg transition-colors border border-transparent hover:border-white/30"
                          title="Edit Product"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                          title="Delete Product"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500 font-medium">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
