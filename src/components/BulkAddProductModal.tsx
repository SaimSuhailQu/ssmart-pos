import React, { useState } from 'react';
import { Product } from '../types';
import { X, Plus, Trash2, Save, Wand2, FileSpreadsheet, CheckCircle, AlertTriangle, Layers } from 'lucide-react';

interface BulkAddProductModalProps {
  onClose: () => void;
  onRefresh: () => void;
  existingCategories?: string[];
}

interface NewProductRow {
  id: string;
  barcode: string;
  name: string;
  category: string;
  cost_price: number | '';
  price: number | '';
  stock: number | '';
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

export const BulkAddProductModal: React.FC<BulkAddProductModalProps> = ({
  onClose,
  onRefresh,
  existingCategories = []
}) => {
  const [rows, setRows] = useState<NewProductRow[]>([
    { id: '1', barcode: '', name: '', category: 'General', cost_price: '', price: '', stock: 10 },
    { id: '2', barcode: '', name: '', category: 'General', cost_price: '', price: '', stock: 10 },
    { id: '3', barcode: '', name: '', category: 'General', cost_price: '', price: '', stock: 10 },
  ]);

  const [pasteText, setPasteText] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categoryOptions = React.useMemo(() => {
    const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCategories])).filter(Boolean);
    return combined.sort();
  }, [existingCategories]);

  // Generate unique numeric barcode
  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 900 + 100);
    return `896${timestamp}${random}`.slice(0, 12);
  };

  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        barcode: '',
        name: '',
        category: 'General',
        cost_price: '',
        price: '',
        stock: 10
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([{ id: '1', barcode: '', name: '', category: 'General', cost_price: '', price: '', stock: 10 }]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof NewProductRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleAutoGenerateBarcode = (id: string) => {
    handleRowChange(id, 'barcode', generateBarcode());
  };

  const handleAutoFillAllBarcodes = () => {
    setRows(prev => prev.map(r => {
      if (!r.barcode.trim()) {
        return { ...r, barcode: generateBarcode() };
      }
      return r;
    }));
  };

  // Parse pasted CSV / Excel data (Tab or Comma separated)
  const handleParsePastedData = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newRows: NewProductRow[] = [];

    for (const line of lines) {
      const delimiter = line.includes('\t') ? '\t' : ',';
      const cols = line.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());

      if (cols.length === 0 || !cols.some(Boolean)) continue;

      let barcode = '';
      let name = '';
      let category = 'General';
      let cost_price: number | '' = '';
      let price: number | '' = '';
      let stock: number | '' = 10;

      if (cols.length >= 5) {
        if (/^\d{5,}$/.test(cols[0])) {
          barcode = cols[0];
          name = cols[1];
          category = cols[2] || 'General';
          cost_price = parseFloat(cols[3]) || '';
          price = parseFloat(cols[4]) || '';
          stock = parseInt(cols[5], 10) || 10;
        } else {
          name = cols[0];
          barcode = cols[1] || generateBarcode();
          category = cols[2] || 'General';
          cost_price = parseFloat(cols[3]) || '';
          price = parseFloat(cols[4]) || '';
          stock = parseInt(cols[5], 10) || 10;
        }
      } else if (cols.length >= 2) {
        if (/^\d{5,}$/.test(cols[0])) {
          barcode = cols[0];
          name = cols[1];
          price = parseFloat(cols[2]) || '';
        } else {
          name = cols[0];
          price = parseFloat(cols[1]) || '';
          barcode = cols[2] || generateBarcode();
        }
      } else if (cols.length === 1 && cols[0]) {
        name = cols[0];
        barcode = generateBarcode();
      }

      if (name) {
        newRows.push({
          id: Math.random().toString(36).substring(2, 9),
          barcode: barcode || generateBarcode(),
          name,
          category,
          cost_price,
          price,
          stock
        });
      }
    }

    if (newRows.length > 0) {
      setRows(prev => [...prev.filter(r => r.name.trim() || r.barcode.trim()), ...newRows]);
      setPasteText('');
      setShowPasteArea(false);
      setMessage({ type: 'success', text: `Parsed and imported ${newRows.length} items to the table.` });
    } else {
      setMessage({ type: 'error', text: 'Could not detect product rows from pasted text.' });
    }
  };

  const handleSaveAll = async () => {
    const validRows = rows.filter(r => r.name.trim() && r.barcode.trim());
    if (validRows.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in at least one product with a Name and Barcode.' });
      return;
    }

    const barcodesSeen = new Set<string>();
    for (const r of validRows) {
      const b = r.barcode.trim();
      if (barcodesSeen.has(b)) {
        setMessage({ type: 'error', text: `Duplicate barcode in table: "${b}". Each product must have a unique barcode.` });
        return;
      }
      barcodesSeen.add(b);
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = validRows.map(r => ({
        barcode: r.barcode.trim(),
        name: r.name.trim(),
        category: r.category.trim() || 'General',
        cost_price: Number(r.cost_price) || 0,
        price: Number(r.price) || 0,
        stock: Number(r.stock) || 0
      }));

      const added = await window.api.bulkAddProducts(payload);
      setMessage({ type: 'success', text: `Successfully added/updated ${added} products in inventory!` });
      onRefresh();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to bulk add products.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="glass-panel w-full max-w-6xl h-[88vh] rounded-3xl border border-white/10 flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-black/30 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Bulk Add Products</h2>
              <p className="text-xs text-gray-400">Add multiple inventory items rapidly via table or Excel/CSV paste.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPasteArea(prev => !prev)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {showPasteArea ? 'Hide Paste Box' : 'Paste from Excel / CSV'}
            </button>

            <button
              onClick={handleAutoFillAllBarcodes}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition cursor-pointer"
              title="Generate barcodes for any blank rows"
            >
              <Wand2 size={15} />
              Auto-Fill Blank Barcodes
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white glass-button rounded-xl transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {message && (
          <div className={`mx-6 mt-4 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border flex-shrink-0 animate-in zoom-in-95 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Paste from Excel/CSV Area */}
        {showPasteArea && (
          <div className="mx-6 mt-4 p-4 bg-white/5 rounded-2xl border border-white/10 flex-shrink-0 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-300">Paste tab-separated rows from Excel or comma-separated lines:</span>
              <span className="text-[10px] text-gray-500">Columns: Name, Barcode (optional), Category, Cost Price, Sale Price, Stock</span>
            </div>
            <textarea
              rows={3}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="e.g. Lays Masala 50g	8961029384	Snacks	40	50	24"
              className="w-full p-3 glass-input rounded-xl text-xs font-mono text-white resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setPasteText(''); setShowPasteArea(false); }}
                className="px-3 py-1.5 glass-button rounded-lg text-xs font-bold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleParsePastedData}
                className="px-4 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                Parse & Add to Table
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3 min-w-[190px]">Product Name *</th>
                <th className="py-3 px-3 min-w-[180px]">Barcode *</th>
                <th className="py-3 px-3 min-w-[140px]">Category</th>
                <th className="py-3 px-3 w-28 text-right">Cost (Rs.)</th>
                <th className="py-3 px-3 w-28 text-right">Sale Price (Rs.)</th>
                <th className="py-3 px-3 w-24 text-right">Stock</th>
                <th className="py-3 px-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-2.5 px-3 text-center text-xs font-bold text-gray-500">
                    {idx + 1}
                  </td>

                  {/* Product Name */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      placeholder="e.g. Olpers Milk 1L"
                      value={row.name}
                      onChange={e => handleRowChange(row.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs font-bold text-white placeholder:text-gray-600 focus:border-emerald-400"
                    />
                  </td>

                  {/* Barcode with Auto-Gen Button */}
                  <td className="py-2.5 px-3">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Scan or Generate..."
                        value={row.barcode}
                        onChange={e => handleRowChange(row.id, 'barcode', e.target.value)}
                        className="w-full pl-3 pr-8 py-2 glass-input rounded-xl text-xs font-mono text-emerald-400 placeholder:text-gray-600 border-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoGenerateBarcode(row.id)}
                        className="absolute right-2 text-gray-500 hover:text-emerald-400 p-1"
                        title="Auto-generate 12-digit barcode"
                      >
                        <Wand2 size={13} />
                      </button>
                    </div>
                  </td>

                  {/* Category Dropdown */}
                  <td className="py-2.5 px-3">
                    <select
                      value={row.category}
                      onChange={e => handleRowChange(row.id, 'category', e.target.value)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs text-gray-200 bg-neutral-900 border-white/10"
                    >
                      {categoryOptions.map(cat => (
                        <option key={cat} value={cat} className="bg-neutral-900 text-white">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Cost Price */}
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={row.cost_price}
                      onChange={e => handleRowChange(row.id, 'cost_price', e.target.value)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs text-right text-gray-300 font-bold placeholder:text-gray-600"
                    />
                  </td>

                  {/* Sale Price */}
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={row.price}
                      onChange={e => handleRowChange(row.id, 'price', e.target.value)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs text-right text-emerald-400 font-bold placeholder:text-gray-600"
                    />
                  </td>

                  {/* Stock */}
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      min="0"
                      placeholder="10"
                      value={row.stock}
                      onChange={e => handleRowChange(row.id, 'stock', e.target.value)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs text-right text-white font-bold placeholder:text-gray-600"
                    />
                  </td>

                  {/* Delete Row */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition"
                      title="Remove Row"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add Row Button */}
          <div className="mt-4">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Plus size={15} /> Add Another Row (+1)
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/30 flex justify-between items-center flex-shrink-0">
          <div className="text-xs text-gray-400">
            <span className="font-bold text-white">{rows.filter(r => r.name.trim() && r.barcode.trim()).length}</span> valid product(s) ready to save
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 glass-button rounded-xl font-bold text-xs text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-neutral-200 to-emerald-600 hover:from-white hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Saving Products...' : 'Save All Products'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
