import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Layers, Coffee, Cookie, Apple, Sparkles, Package, HeartPulse } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'all': return Layers;
    case 'drinks': return Coffee;
    case 'snacks': return Cookie;
    case 'groceries': return Apple;
    case 'personal care': return HeartPulse;
    case 'electronics': return Sparkles;
    default: return Package;
  }
};

export const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['All', ...cats.sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter(p => p.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Categories Tabs */}
      <div className="flex overflow-x-auto p-4 gap-2 border-b border-white/5 bg-black/10 backdrop-blur-sm scrollbar-none z-10 relative shadow-md">
        {categories.map(cat => {
          const Icon = getCategoryIcon(cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
                activeCategory === cat 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.3)]' 
                  : 'glass-button text-gray-300 hover:text-white'
              }`}
            >
              <Icon size={16} className={activeCategory === cat ? 'text-cyan-400' : 'text-gray-400'} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative z-0">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map(p => (
            <div 
              key={p.id} 
              onClick={() => onAddToCart(p)}
              className="glass-panel p-5 cursor-pointer hover:-translate-y-1 hover:bg-white/10 hover:border-cyan-500/55 hover:shadow-[0_10px_30px_-10px_rgba(0,240,255,0.45)] transition-all duration-300 group flex flex-col active:scale-[0.97] rounded-2xl relative overflow-hidden hover-shine"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full -mr-10 -mt-10 group-hover:bg-cyan-500/20 transition-colors"></div>
              
              <div className="flex-1 relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-cyan-300">
                    {p.category}
                  </span>
                </div>
                <h3 className="font-bold text-gray-200 group-hover:text-white transition-colors text-lg">{p.name}</h3>
                <p className="text-xs text-gray-500 mt-1 font-mono tracking-wide">{p.barcode}</p>
              </div>
              <div className="mt-5 flex justify-between items-end relative z-10">
                <span className="text-xl font-extrabold text-cyan-400 drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">Rs. {p.price.toFixed(2)}</span>
                {p.stock === 0 ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-950/40 border border-red-500/30 px-2 py-1 rounded-lg shadow-[0_0_8px_rgba(239,68,68,0.15)]">Out of stock</span>
                ) : p.stock <= 5 ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-950/40 border border-orange-500/30 px-2 py-1 rounded-lg shadow-[0_0_8px_rgba(249,115,22,0.15)] animate-pulse">Low Stock: {p.stock}</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-1 rounded-lg">Stock: {p.stock}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
