import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, Check, Wand2 } from 'lucide-react';

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id'>) => Promise<void>;
  existingCategories?: string[];
}

const DEFAULT_CATEGORIES = [
  'General',
  'Drinks',
  'Snacks',
  'Groceries',
  'Dairy & Eggs',
  'Bakery',
  'Personal Care',
  'Household & Cleaning',
  'Frozen Foods',
  'Spices & Condiments',
  'Baby Care',
  'Electronics'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ 
  product, 
  onClose, 
  onSave,
  existingCategories = []
}) => {
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    name: '',
    barcode: '',
    price: 0,
    stock: 0,
    category: 'General',
    cost_price: 0
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Combine and deduplicate categories
  const categoryOptions = React.useMemo(() => {
    const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCategories])).filter(Boolean);
    return combined.sort();
  }, [existingCategories]);

  useEffect(() => {
    if (product) {
      const prodCategory = product.category || 'General';
      setFormData({
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        stock: product.stock,
        category: prodCategory,
        cost_price: product.cost_price || 0
      });
      if (!DEFAULT_CATEGORIES.includes(prodCategory) && !existingCategories.includes(prodCategory)) {
        setIsCustomCategory(true);
        setCustomCategoryInput(prodCategory);
      } else {
        setIsCustomCategory(false);
      }
    }
  }, [product, existingCategories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' || name === 'cost_price' ? Number(value) : value
    }));
  };

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__NEW__') {
      setIsCustomCategory(true);
      setCustomCategoryInput('');
    } else {
      setIsCustomCategory(false);
      setFormData(prev => ({ ...prev, category: value }));
    }
  };

  const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCategoryInput(val);
    setFormData(prev => ({ ...prev, category: val.trim() || 'General' }));
  };

  const handleGenerateBarcode = () => {
    // Generate a 12 digit CODE128 compatible string
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.barcode || formData.price <= 0 || formData.cost_price < 0) {
      setError('Please fill in all required fields correctly.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    try {
      await onSave({
        ...formData,
        category: formData.category.trim() || 'General'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4 overflow-hidden">
      <div className="glass-panel rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_50px_rgba(255,255,255,0.15)] border-white/10 relative z-50">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
          <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-white glass-button rounded-full cursor-pointer transition-all active:scale-95"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-6 flex flex-col gap-4 bg-transparent scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md shrink-0">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-widest">Product Name *</label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full glass-input rounded-xl p-3 text-sm"
              placeholder="e.g. Pakola Cream Soda 1.5L"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-widest">Cost Price (Rs.) *</label>
              <input 
                type="number" 
                name="cost_price"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={handleChange}
                className="w-full glass-input rounded-xl p-3 font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-widest">Sale Price (Rs.) *</label>
              <input 
                type="number" 
                name="price"
                step="0.01"
                min="0.01"
                value={formData.price}
                onChange={handleChange}
                className="w-full glass-input rounded-xl p-3 font-mono text-sm"
                required
              />
            </div>
          </div>

          {/* Profit Margin and Total Batch Cost Previews */}
          {(() => {
            const margin = formData.price > 0 && formData.cost_price >= 0
              ? ((formData.price - formData.cost_price) / formData.price) * 100
              : 0;
            const totalCostValue = (formData.cost_price || 0) * (formData.stock || 0);
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Profit Margin</span>
                  <span className={`text-xs font-black tracking-widest ${margin >= 30 ? 'text-emerald-400' : margin >= 15 ? 'text-yellow-400' : margin > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                    {margin.toFixed(2)}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Stock Cost</span>
                  <span className="text-xs font-black tracking-widest text-emerald-400">
                    Rs. {totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-widest">Initial Stock</label>
              <input 
                type="number" 
                name="stock"
                min="0"
                value={formData.stock}
                onChange={handleChange}
                className="w-full glass-input rounded-xl p-3 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-widest">Category *</label>
              {!isCustomCategory ? (
                <select 
                  name="category"
                  value={formData.category}
                  onChange={handleCategorySelect}
                  className="w-full glass-input rounded-xl p-3 text-sm bg-neutral-900 text-white cursor-pointer"
                >
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat} className="bg-neutral-900 text-white py-1">
                      {cat}
                    </option>
                  ))}
                  <option value="__NEW__" className="bg-neutral-900 text-emerald-400 font-bold py-1">
                    ➕ + Create New Category...
                  </option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={customCategoryInput}
                    onChange={handleCustomCategoryChange}
                    className="flex-1 glass-input rounded-xl p-3 text-sm"
                    placeholder="Enter category name..."
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setFormData(prev => ({ ...prev, category: 'General' }));
                    }}
                    className="px-3 glass-button rounded-xl text-xs text-gray-400 hover:text-white"
                    title="Back to dropdown list"
                  >
                    List
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-widest">Barcode *</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                className="flex-1 glass-input rounded-xl p-3 font-mono text-sm"
                placeholder="Scan or type..."
                required
              />
              <button 
                type="button"
                onClick={handleGenerateBarcode}
                className="p-3 glass-button rounded-xl text-neutral-200 hover:text-white hover:border-white/50 flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                title="Auto-Generate Barcode"
              >
                <Wand2 size={18} />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-widest">Scan the item's barcode or auto-generate.</p>
          </div>
        </form>

        {/* Sticky Fixed Bottom Action Bar */}
        <div className="p-4 md:p-5 border-t border-white/10 bg-black/50 backdrop-blur-md flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors cursor-pointer rounded-xl hover:bg-white/5 active:scale-95"
          >
            CANCEL
          </button>
          <button 
            type="submit"
            form="product-form"
            disabled={isProcessing}
            className="px-6 py-3 rounded-xl font-bold tracking-wider text-white shadow-[0_0_20px_rgba(255,255,255,0.3)] bg-gradient-to-r from-neutral-200 to-neutral-500 hover:from-neutral-100 hover:to-neutral-400 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer active:scale-95 text-xs md:text-sm uppercase touch-manipulation select-none"
          >
            <Check size={18} />
            {product ? 'SAVE CHANGES' : 'ADD PRODUCT'}
          </button>
        </div>

      </div>
    </div>
  );
};
