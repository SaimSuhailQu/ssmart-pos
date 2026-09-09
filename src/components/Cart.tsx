import React from 'react';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { CartItem } from '../types';

interface CartProps {
  cart: CartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onRemoveItem: (id: number) => void;
}

export const Cart: React.FC<CartProps> = ({ cart, onUpdateQty, onRemoveItem }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent font-sans">
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20 select-none">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
            <ShoppingCart size={28} />
          </div>
          <p className="font-bold tracking-wider uppercase text-xs text-slate-300">No items in current order</p>
          <p className="text-xs text-slate-500 mt-1 tracking-normal font-normal">Scan barcodes or toggle the catalog drawer to add items.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md z-10 border-b border-slate-800">
              <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 pl-6">Item Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Line Total</th>
                <th className="py-3 px-4 pr-6 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cart.map(item => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-3 px-4 pl-6">
                    <div className="font-semibold text-slate-100 text-sm leading-tight">{item.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono tracking-tight mt-0.5">{item.barcode}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-300">
                    Rs. {item.price.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-slate-900 rounded-lg p-1 border border-slate-700/60">
                      <button 
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-7 text-center font-mono font-bold text-slate-100 text-xs tabular-nums">{item.qty}</span>
                      <button 
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors cursor-pointer shadow-xs"
                        title="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-100 tabular-nums">
                    Rs. {(item.price * item.qty).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 pr-6 text-center">
                    <button 
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors border border-transparent hover:border-rose-500/20 cursor-pointer"
                      title="Remove Item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
