import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Plus, Edit2, Trash2, Printer, Search, PackageOpen } from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';

interface InventoryManagerProps {
  onBackToPOS: () => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ onBackToPOS }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadProducts = async () => {
    try {
      const data = await window.api.getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode.includes(searchQuery) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-200 p-4 font-outfit">
      
      <div className="flex-1 glass-panel rounded-3xl overflow-hidden flex flex-col relative z-10 border-white/5 shadow-2xl">
        <header className="p-6 border-b border-white/5 bg-black/20 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.3)]">
              <PackageOpen className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">INVENTORY</h1>
              <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mt-1">{products.length} Products Found</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group w-72">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-cyan-400 transition-colors">
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
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(0,240,255,0.3)] bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 transition-all relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
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
                <th className="p-5 text-right border-b border-white/5">Price</th>
                <th className="p-5 text-right border-b border-white/5">Stock</th>
                <th className="p-5 pr-8 text-center border-b border-white/5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-5 pl-8 font-semibold text-gray-200">{p.name}</td>
                  <td className="p-5">
                    <span className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-cyan-300 tracking-wider">
                      {p.category}
                    </span>
                  </td>
                  <td className="p-5 font-mono text-sm text-gray-400 tracking-wider">{p.barcode}</td>
                  <td className="p-5 text-right font-bold text-white drop-shadow-md">Rs. {p.price.toFixed(2)}</td>
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
                        className="p-2 text-cyan-400 hover:text-white hover:bg-cyan-500/20 rounded-lg transition-colors border border-transparent hover:border-cyan-500/30"
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
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500 font-medium">
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
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveProduct} 
        />
      )}
    </div>
  );
};
