import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, Check, Wand2 } from 'lucide-react';

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id'>) => Promise<void>;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    name: '',
    barcode: '',
    price: 0,
    stock: 0,
    category: 'General'
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        stock: product.stock,
        category: product.category
      });
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? Number(value) : value
    }));
  };

  const handleGenerateBarcode = () => {
    // Generate a 12 digit CODE128 compatible string
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.barcode || formData.price <= 0) {
      setError('Please fill in all required fields correctly.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl">
      <div className="glass-panel rounded-3xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_50px_rgba(0,240,255,0.1)]">
        
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/30 backdrop-blur-md">
          <h2 className="text-2xl font-bold text-white drop-shadow-md">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white glass-button rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5 bg-transparent">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest">Product Name *</label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full glass-input rounded-xl p-3"
              placeholder="e.g. Cola 1L"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest">Category</label>
            <input 
              type="text" 
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full glass-input rounded-xl p-3"
              placeholder="e.g. Drinks"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest">Price ($) *</label>
              <input 
                type="number" 
                name="price"
                step="0.01"
                min="0.01"
                value={formData.price}
                onChange={handleChange}
                className="w-full glass-input rounded-xl p-3 font-mono"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest">Initial Stock</label>
              <input 
                type="number" 
                name="stock"
                min="0"
                value={formData.stock}
                onChange={handleChange}
                className="w-full glass-input rounded-xl p-3 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest">Barcode *</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                className="flex-1 glass-input rounded-xl p-3 font-mono"
                placeholder="Scan or type..."
                required
              />
              <button 
                type="button"
                onClick={handleGenerateBarcode}
                className="p-3 glass-button rounded-xl text-cyan-400 hover:text-white hover:border-cyan-500/50 flex items-center justify-center"
                title="Auto-Generate Barcode"
              >
                <Wand2 size={20} />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest">Scan the item's barcode or generate a new one.</p>
          </div>

          <div className="mt-4 pt-6 border-t border-white/5 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="submit"
              disabled={isProcessing}
              className="px-6 py-3 rounded-xl font-bold tracking-widest text-white shadow-[0_0_15px_rgba(0,240,255,0.3)] bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Check size={18} />
              {product ? 'SAVE CHANGES' : 'ADD PRODUCT'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
