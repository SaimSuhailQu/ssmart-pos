import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, X } from 'lucide-react';

interface CustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: { name: string; price: number; qty: number; category: string }) => Promise<void>;
  existingCategories?: string[];
}

export const CustomItemModal: React.FC<CustomItemModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingCategories = []
}) => {
  const [name, setName] = useState('General Item');
  const [priceStr, setPriceStr] = useState('');
  const [qty, setQty] = useState(1);
  const [category, setCategory] = useState('General');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('General Item');
      setPriceStr('');
      setQty(1);
      setCategory('General');
      setError(null);
      setIsSubmitting(false);

      // Auto-focus price field since name is already defaulted
      setTimeout(() => {
        if (priceInputRef.current) {
          priceInputRef.current.focus();
          priceInputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const capitalizeWords = (str: string) => {
    return str.replace(/\b[a-z]/g, char => char.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = capitalizeWords(name.trim()) || 'General Item';
    const parsedPrice = parseFloat(priceStr);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Please enter a valid price greater than 0.');
      return;
    }

    if (qty <= 0) {
      setError('Quantity must be at least 1.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onAdd({
        name: cleanName,
        price: parsedPrice,
        qty,
        category: category.trim() || 'General'
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to add custom item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="enterprise-card border-slate-700 bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <PlusCircle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add Custom Item</h3>
              <p className="text-[11px] text-slate-400">Quickly add an unlisted or ad-hoc product to the cart</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Item Name / Description
            </label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(capitalizeWords(e.target.value))}
              placeholder="e.g. Loose Sugar, Fresh Pastry, Ad-hoc Item"
              required
              className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unit Price (PKR / Rs.)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono text-slate-400">Rs.</span>
                <input 
                  ref={priceInputRef}
                  type="number"
                  step="any"
                  min="0.01"
                  value={priceStr}
                  onChange={e => setPriceStr(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full glass-input rounded-lg pl-10 pr-3 py-2 text-sm font-mono text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantity
              </label>
              <input 
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
                className="w-full glass-input rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none bg-slate-900 cursor-pointer"
            >
              <option value="General">General</option>
              {existingCategories.filter(c => c && c !== 'General').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Quick preset price buttons */}
          <div>
            <span className="block text-[11px] text-slate-400 font-medium mb-1.5">Quick Prices</span>
            <div className="flex gap-2">
              {[50, 100, 200, 500, 1000].map(amt => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setPriceStr(amt.toString())}
                  className="flex-1 py-1 text-xs font-mono font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <PlusCircle size={14} />
              {isSubmitting ? 'Adding...' : 'Add to Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
