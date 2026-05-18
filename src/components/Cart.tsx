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
    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
          <ShoppingCart size={48} className="mb-4 text-cyan-500/30 drop-shadow-[0_0_10px_rgba(0,240,255,0.2)]" />
          <p className="font-medium tracking-wider uppercase text-sm">Cart is empty</p>
        </div>
      ) : (
        cart.map(item => (
          <div key={item.id} className="glass-panel p-3 rounded-xl border border-white/5 flex gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-200 truncate leading-tight">{item.name}</h4>
              <p className="text-cyan-400 font-bold mt-1">Rs. {(item.price * item.qty).toFixed(2)}</p>
            </div>
            
            <div className="flex flex-col items-end justify-between gap-2">
              <button 
                onClick={() => onRemoveItem(item.id)}
                className="text-red-400/50 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
              
              <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                <button 
                  onClick={() => onUpdateQty(item.id, -1)}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-gray-300 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-bold text-white text-sm">{item.qty}</span>
                <button 
                  onClick={() => onUpdateQty(item.id, 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
