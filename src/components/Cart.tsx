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
    <div className="flex-1 flex flex-col min-h-0 bg-transparent font-outfit">
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-60 py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-200/30 drop-shadow-[0_0_15px_rgba(255, 255, 255, 0.2)] mb-4 animate-pulse">
            <ShoppingCart size={32} />
          </div>
          <p className="font-bold tracking-widest uppercase text-sm text-gray-400">No items in current order</p>
          <p className="text-xs text-gray-500 mt-2 tracking-wide font-medium">Scan barcodes or toggle the catalog sidebar to add items manually.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-black/40 backdrop-blur-md z-10 shadow-sm">
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-white/5">
                <th className="p-5 pl-6">Product Item</th>
                <th className="p-5">Category</th>
                <th className="p-5 text-right">Unit Price</th>
                <th className="p-5 text-center">Quantity</th>
                <th className="p-5 text-right">Total Price</th>
                <th className="p-5 pr-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cart.map(item => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-5 pl-6">
                    <div className="font-bold text-gray-200">{item.name}</div>
                    <div className="text-[10px] text-neutral-200/70 font-mono tracking-wider mt-0.5">{item.barcode}</div>
                  </td>
                  <td className="p-5 text-sm">
                    <span className="px-2.5 py-1 bg-black/40 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-200">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-5 text-right font-semibold text-gray-300">Rs. {item.price.toFixed(2)}</td>
                  <td className="p-5 text-center">
                    <div className="inline-flex items-center gap-2.5 bg-black/40 rounded-xl p-1 border border-white/5 shadow-inner">
                      <button 
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center font-black text-white text-sm">{item.qty}</span>
                      <button 
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/40 text-neutral-200 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="p-5 text-right font-black text-white drop-shadow-md">Rs. {(item.price * item.qty).toFixed(2)}</td>
                  <td className="p-5 pr-6 text-center">
                    <button 
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 text-red-400/50 hover:text-white hover:bg-red-500/25 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                      title="Remove Item"
                    >
                      <Trash2 size={16} />
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
