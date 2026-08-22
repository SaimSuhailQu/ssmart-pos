import React, { useState } from 'react';
import { Product } from '../types';
import { X, Save, Download, Upload, Filter, CheckCircle, AlertTriangle } from 'lucide-react';

interface BulkProductEditorModalProps {
  products: Product[];
  onClose: () => void;
  onRefresh: () => void;
}

export const BulkProductEditorModal: React.FC<BulkProductEditorModalProps> = ({ products, onClose, onRefresh }) => {
  const [filterMode, setFilterMode] = useState<'UNPRICED' | 'ALL'>('UNPRICED');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for modified rows: id -> { cost_price, price, stock, category }
  const [editedProducts, setEditedProducts] = useState<{ [id: number]: Product }>(() => {
    const initial: { [id: number]: Product } = {};
    products.forEach(p => {
      initial[p.id] = { ...p };
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  const handleFieldChange = (id: number, field: keyof Product, value: any) => {
    setEditedProducts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: field === 'name' || field === 'barcode' || field === 'category' ? value : (parseFloat(value) || 0)
      }
    }));
  };

  const displayedProducts = products.filter(p => {
    const edited = editedProducts[p.id] || p;
    if (filterMode === 'UNPRICED' && edited.price > 0 && edited.cost_price > 0) return false;
    if (selectedCategory !== 'ALL' && edited.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        edited.name.toLowerCase().includes(q) ||
        edited.barcode.includes(q) ||
        edited.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updates = Object.values(editedProducts).map(p => ({
        id: p.id,
        cost_price: p.cost_price,
        price: p.price,
        stock: p.stock,
        category: p.category
      }));
      
      await window.api.bulkUpdateProducts(updates);
      setMessage({ type: 'success', text: `Successfully updated ${updates.length} products!` });
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 1200);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save bulk product updates.' });
    } finally {
      setSaving(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['ID', 'Barcode', 'Name', 'Category', 'CostPrice', 'SalePrice', 'Stock'];
    const rows = products.map(p => {
      const edited = editedProducts[p.id] || p;
      return [
        edited.id,
        `"${edited.barcode}"`,
        `"${edited.name.replace(/"/g, '""')}"`,
        `"${edited.category.replace(/"/g, '""')}"`,
        edited.cost_price,
        edited.price,
        edited.stock
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mart_inventory_bulk_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return;

        let updatedCount = 0;
        const newEdited = { ...editedProducts };

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 7) {
            const id = parseInt(cols[0], 10);
            const cost_price = parseFloat(cols[4]) || 0;
            const price = parseFloat(cols[5]) || 0;
            const stock = parseInt(cols[6], 10) || 0;

            if (id && newEdited[id]) {
              newEdited[id] = {
                ...newEdited[id],
                cost_price,
                price,
                stock
              };
              updatedCount++;
            }
          }
        }

        setEditedProducts(newEdited);
        setMessage({ type: 'success', text: `Imported changes for ${updatedCount} products from CSV! Click "Save All Changes" to persist.` });
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Error parsing CSV file.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6 font-outfit">
      <div className="glass-panel w-full max-w-6xl max-h-[90vh] rounded-3xl flex flex-col overflow-hidden border-white/10 shadow-2xl">
        
        {/* Header */}
        <header className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Filter className="text-emerald-400" size={24} />
              Bulk Price & Stock Editor
            </h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
              Quickly edit retail prices, cost prices, and stock quantities across all inventory items
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </header>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-white/5 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/40 p-1">
              <button
                onClick={() => setFilterMode('UNPRICED')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'UNPRICED' 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Unpriced Items ($0.00)
              </button>
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'ALL' 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All Products ({products.length})
              </button>
            </div>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="glass-input rounded-xl px-3 py-1.5 text-xs font-semibold text-white bg-black/60 border-white/10"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input rounded-xl px-3 py-1.5 text-xs text-white w-64"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
              title="Export visible items to CSV for Excel editing"
            >
              <Download size={16} /> Export CSV
            </button>

            <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10">
              <Upload size={16} /> Import CSV
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
            </label>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`p-3 text-xs font-bold flex items-center justify-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-b border-red-500/30'
          }`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        )}

        {/* Batch Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-black/80 backdrop-blur-md z-10">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/10">
                <th className="p-3 pl-4">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 font-mono">Barcode</th>
                <th className="p-3 text-right">Cost Price (Rs.)</th>
                <th className="p-3 text-right">Sale Price (Rs.)</th>
                <th className="p-3 text-right">Stock Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayedProducts.map(p => {
                const item = editedProducts[p.id] || p;
                return (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 pl-4 font-semibold text-white text-sm">{item.name}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-gray-300 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-gray-400">{item.barcode}</td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost_price}
                        onChange={e => handleFieldChange(p.id, 'cost_price', e.target.value)}
                        className="w-28 text-right glass-input rounded-lg px-2 py-1 text-xs text-white bg-black/40 border-white/10 focus:border-emerald-400"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={e => handleFieldChange(p.id, 'price', e.target.value)}
                        className="w-28 text-right glass-input rounded-lg px-2 py-1 text-xs font-bold text-emerald-300 bg-black/40 border-emerald-500/30 focus:border-emerald-400"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.stock}
                        onChange={e => handleFieldChange(p.id, 'stock', e.target.value)}
                        className="w-24 text-right glass-input rounded-lg px-2 py-1 text-xs text-white bg-black/40 border-white/10 focus:border-emerald-400"
                      />
                    </td>
                  </tr>
                );
              })}
              {displayedProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 font-medium">
                    No products match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <footer className="p-4 border-t border-white/10 bg-black/40 flex justify-between items-center">
          <span className="text-xs text-gray-400 font-semibold">
            Showing {displayedProducts.length} of {products.length} products
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-gray-300 bg-white/10 hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
